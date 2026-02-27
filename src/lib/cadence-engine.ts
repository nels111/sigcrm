import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { CadenceStatus } from "@prisma/client";

const CALENDLY_LINK =
  process.env.CALENDLY_LINK ||
  "https://calendly.com/nick-signaturecleans";

const FROM_ADDRESS = "nick@signature-cleans.co.uk";

interface CadenceResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
  details: Array<{
    leadId: string;
    companyName: string;
    action: "sent" | "skipped" | "error";
    reason?: string;
    cadenceStep?: number;
  }>;
}

function replaceMergeFields(
  template: string,
  contactName: string,
  companyName: string
): string {
  return template
    .replace(/\{\{contact_name\}\}/g, contactName)
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{calendly_link\}\}/g, CALENDLY_LINK);
}

export async function runCadenceEngine(): Promise<CadenceResult> {
  const result: CadenceResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  console.log("[CadenceEngine] Starting cadence engine run...");

  try {
    // 1. Query all leads that are active in cadence, under step 20, not deleted
    const leads = await prisma.lead.findMany({
      where: {
        cadenceStatus: CadenceStatus.ActiveInCadence,
        cadenceStep: { lt: 20 },
        deletedAt: null,
      },
      include: {
        convertedAccount: {
          select: { isProtected: true },
        },
      },
    });

    console.log(`[CadenceEngine] Found ${leads.length} leads in active cadence`);

    for (const lead of leads) {
      result.processed++;

      // 2. Check pause triggers before sending
      // Check if cadenceStatus starts with 'Paused' or 'Stopped'
      const statusValue = lead.cadenceStatus as string;
      if (statusValue.startsWith("Paused") || statusValue.startsWith("Stopped")) {
        result.skipped++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "skipped",
          reason: `Cadence status is ${lead.cadenceStatus}`,
        });
        continue;
      }

      // Check for 'Do Not Contact' tag
      if (lead.tags.includes("Do Not Contact")) {
        result.skipped++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "skipped",
          reason: "Lead has 'Do Not Contact' tag",
        });
        continue;
      }

      // Check if converted account is protected
      if (lead.convertedAccount?.isProtected) {
        result.skipped++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "skipped",
          reason: "Converted account is protected",
        });
        continue;
      }

      // 3. Find the email template for the next cadence step
      const nextStep = lead.cadenceStep + 1;
      const template = await prisma.emailTemplate.findFirst({
        where: {
          templateType: "sales_cadence",
          sequenceNumber: nextStep,
          isActive: true,
        },
      });

      if (!template) {
        result.skipped++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "skipped",
          reason: `No active template found for cadence step ${nextStep}`,
        });
        continue;
      }

      // Ensure lead has an email address
      if (!lead.contactEmail) {
        result.skipped++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "skipped",
          reason: "Lead has no contact email",
        });
        continue;
      }

      try {
        // 4. Replace merge fields in template
        const subject = replaceMergeFields(
          template.subject,
          lead.contactName,
          lead.companyName
        );
        const html = replaceMergeFields(
          template.bodyHtml,
          lead.contactName,
          lead.companyName
        );

        // 5. Send email
        await sendEmail({
          from: "nick",
          to: lead.contactEmail,
          subject,
          html,
        });

        const now = new Date();

        // 6. Update lead: increment cadenceStep, set lastCadenceEmailAt
        // 8. If cadenceStep reaches 20, set status to LongTermNurture
        const newCadenceStatus =
          nextStep >= 20
            ? CadenceStatus.LongTermNurture
            : CadenceStatus.ActiveInCadence;

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            cadenceStep: nextStep,
            lastCadenceEmailAt: now,
            cadenceStatus: newCadenceStatus,
          },
        });

        // 7. Create Email record and Activity record
        await prisma.email.create({
          data: {
            direction: "outbound",
            fromAddress: FROM_ADDRESS,
            toAddress: lead.contactEmail,
            subject,
            bodyHtml: html,
            leadId: lead.id,
            isCadenceEmail: true,
            cadenceStep: nextStep,
            status: "sent",
            sentAt: now,
          },
        });

        await prisma.activity.create({
          data: {
            activityType: "cadence_email_sent",
            subject: `Cadence email step ${nextStep} sent`,
            body: `Sent cadence email step ${nextStep} to ${lead.contactEmail}`,
            leadId: lead.id,
            metadata: {
              cadenceStep: nextStep,
              templateId: template.id,
              templateName: template.name,
            },
          },
        });

        result.sent++;
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "sent",
          cadenceStep: nextStep,
        });

        console.log(
          `[CadenceEngine] Sent step ${nextStep} to ${lead.companyName} (${lead.contactEmail})`
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        result.errors.push(
          `Failed to send cadence email to ${lead.companyName}: ${errorMessage}`
        );
        result.details.push({
          leadId: lead.id,
          companyName: lead.companyName,
          action: "error",
          reason: errorMessage,
        });
        console.error(
          `[CadenceEngine] Error sending to ${lead.companyName}:`,
          err
        );
      }
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    result.errors.push(`Cadence engine failed: ${errorMessage}`);
    console.error("[CadenceEngine] Fatal error:", err);
  }

  console.log(
    `[CadenceEngine] Complete — Processed: ${result.processed}, Sent: ${result.sent}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`
  );

  return result;
}
