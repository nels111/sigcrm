/**
 * Fix Engagement Stages
 *
 * One-time script to map leadStatus → engagementStage for all leads
 * that currently have NeverEngaged or null engagement stages.
 *
 * Usage:
 *   npx tsx scripts/fix-engagement-stages.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// LeadStatus → EngagementStage mapping
// ---------------------------------------------------------------------------

function mapStatusToEngagement(leadStatus: string): string {
  const mapping: Record<string, string> = {
    NewLead: "ColdProspect",
    Contacted: "WarmProspect",
    IncomingCall: "WarmProspect",
    MeetingBooked: "MeetingBooked",
    MeetingAttended: "MeetingBooked",
    QuoteSent: "Quoted",
    QuoteAccepted: "Negotiating",
    QuoteRejected: "ColdProspect",
    FollowUpSent: "WarmProspect",
    PreviousCustomer: "WorkCeased",
    OngoingCustomer: "CurrentOngoing",
  };

  return mapping[leadStatus] || "ColdProspect";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("  Fix Engagement Stages — leadStatus → engagementStage");
  console.log("=".repeat(60));

  // Find all leads with default NeverEngaged engagement stage
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      engagementStage: "NeverEngaged",
    },
    select: {
      id: true,
      companyName: true,
      leadStatus: true,
      engagementStage: true,
    },
  });

  console.log(
    `\nFound ${leads.length} leads with NeverEngaged/null engagement stage.\n`
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const lead of leads) {
    try {
      if (!lead.leadStatus) {
        console.log(`  SKIP: ${lead.companyName || lead.id} — no leadStatus`);
        skipped++;
        continue;
      }

      const newStage = mapStatusToEngagement(lead.leadStatus);

      // Skip if already correct
      if (lead.engagementStage === newStage) {
        skipped++;
        continue;
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { engagementStage: newStage as any },
      });

      console.log(
        `  UPDATED: ${lead.companyName || lead.id} | ${lead.leadStatus} → ${newStage}`
      );
      updated++;
    } catch (err: any) {
      console.error(
        `  ERROR: ${lead.companyName || lead.id}: ${err.message}`
      );
      errors++;
    }
  }

  // Summary
  console.log("\n" + "-".repeat(60));
  console.log(
    `  Results: ${updated} updated, ${skipped} skipped, ${errors} errors`
  );
  console.log("-".repeat(60));

  // Show distribution
  const distribution = await prisma.lead.groupBy({
    by: ["engagementStage"],
    where: { deletedAt: null },
    _count: { id: true },
  });

  console.log("\nEngagement stage distribution:");
  for (const row of distribution) {
    console.log(`  ${row.engagementStage || "null"}: ${row._count.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("\nFATAL:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
