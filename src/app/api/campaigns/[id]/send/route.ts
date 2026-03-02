import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { EmailDirection, EmailStatus, ActivityType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/campaigns/[id]/send — Execute campaign send
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        emailTemplate: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!campaign.emailTemplate) {
      return NextResponse.json(
        { error: "Campaign has no email template assigned" },
        { status: 400 }
      );
    }

    if (campaign.status === "completed" || campaign.status === "sending") {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    // Mark as sending
    await prisma.campaign.update({
      where: { id },
      data: { status: "sending" },
    });

    // Query matching leads based on audience filter
    const filter = campaign.audienceFilter as Record<string, unknown>;
    const leadWhere: Record<string, unknown> = {
      deletedAt: null,
      contactEmail: { not: null },
    };

    if (filter.leadStatus) leadWhere.leadStatus = filter.leadStatus;
    if (filter.engagementStage) leadWhere.engagementStage = filter.engagementStage;
    if (filter.industry) leadWhere.industry = filter.industry;
    if (filter.cadenceStatus) leadWhere.cadenceStatus = filter.cadenceStatus;

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
      },
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      if (!lead.contactEmail) continue;

      try {
        // Merge fields in template
        let subject = campaign.emailTemplate.subject;
        let bodyHtml = campaign.emailTemplate.bodyHtml;

        subject = subject.replace(/\{\{companyName\}\}/g, lead.companyName);
        subject = subject.replace(/\{\{contactName\}\}/g, lead.contactName);
        bodyHtml = bodyHtml.replace(/\{\{companyName\}\}/g, lead.companyName);
        bodyHtml = bodyHtml.replace(/\{\{contactName\}\}/g, lead.contactName);

        const fromUser = campaign.emailTemplate.fromAddress.includes("nelson")
          ? "nelson"
          : "nick";

        await sendEmail({
          from: fromUser,
          to: lead.contactEmail,
          subject,
          html: bodyHtml,
        });

        // Record email
        await prisma.email.create({
          data: {
            direction: EmailDirection.outbound,
            fromAddress: campaign.emailTemplate.fromAddress,
            toAddress: lead.contactEmail,
            subject,
            bodyHtml,
            leadId: lead.id,
            status: EmailStatus.sent,
            sentAt: new Date(),
          },
        });

        // Record activity
        await prisma.activity.create({
          data: {
            activityType: ActivityType.email_sent,
            subject: `Campaign "${campaign.name}": ${subject}`,
            leadId: lead.id,
            metadata: { campaignId: campaign.id },
          },
        });

        sentCount++;
      } catch (err) {
        errors.push(`${lead.contactEmail}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Update campaign stats
    await prisma.campaign.update({
      where: { id },
      data: {
        status: "completed",
        totalRecipients: leads.length,
        sentCount,
      },
    });

    return NextResponse.json({
      data: {
        totalRecipients: leads.length,
        sentCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("POST /api/campaigns/[id]/send error:", error);
    return NextResponse.json(
      { error: "Failed to execute campaign send" },
      { status: 500 }
    );
  }
}
