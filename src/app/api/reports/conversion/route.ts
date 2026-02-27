import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Target conversion rates
const TARGETS = {
  leadsToMeetings: 30,
  meetingsToQuotes: 80,
  quotesToWins: 25,
};

// Stages that indicate a deal reached the "meeting" milestone or beyond
const MEETING_AND_BEYOND = new Set([
  "SiteSurveyBooked",
  "SurveyComplete",
  "QuoteSent",
  "Negotiation",
  "ClosedWonRecurring",
  "ClosedWonOneOff",
  "ClosedLostRecurring",
  "ClosedLostOneOff",
]);

// Stages that indicate a deal reached the "quote" milestone or beyond
const QUOTE_AND_BEYOND = new Set([
  "QuoteSent",
  "Negotiation",
  "ClosedWonRecurring",
  "ClosedWonOneOff",
  "ClosedLostRecurring",
  "ClosedLostOneOff",
]);

// Stages that indicate a deal was won
const WON_STAGES = new Set(["ClosedWonRecurring", "ClosedWonOneOff"]);

// GET /api/reports/conversion — Stage-to-stage conversion rates vs targets
export async function GET() {
  try {
    const deals = await prisma.deal.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        stage: true,
      },
    });

    const totalLeads = deals.length;
    const totalMeetings = deals.filter((d) =>
      MEETING_AND_BEYOND.has(d.stage)
    ).length;
    const totalQuotes = deals.filter((d) =>
      QUOTE_AND_BEYOND.has(d.stage)
    ).length;
    const totalWins = deals.filter((d) => WON_STAGES.has(d.stage)).length;

    const leadsToMeetingsRate =
      totalLeads > 0
        ? parseFloat(((totalMeetings / totalLeads) * 100).toFixed(1))
        : 0;
    const meetingsToQuotesRate =
      totalMeetings > 0
        ? parseFloat(((totalQuotes / totalMeetings) * 100).toFixed(1))
        : 0;
    const quotesToWinsRate =
      totalQuotes > 0
        ? parseFloat(((totalWins / totalQuotes) * 100).toFixed(1))
        : 0;

    const conversions = [
      {
        from: "Leads",
        to: "Meetings",
        actual: leadsToMeetingsRate,
        target: TARGETS.leadsToMeetings,
        variance: parseFloat(
          (leadsToMeetingsRate - TARGETS.leadsToMeetings).toFixed(1)
        ),
        counts: { from: totalLeads, to: totalMeetings },
      },
      {
        from: "Meetings",
        to: "Quotes",
        actual: meetingsToQuotesRate,
        target: TARGETS.meetingsToQuotes,
        variance: parseFloat(
          (meetingsToQuotesRate - TARGETS.meetingsToQuotes).toFixed(1)
        ),
        counts: { from: totalMeetings, to: totalQuotes },
      },
      {
        from: "Quotes",
        to: "Wins",
        actual: quotesToWinsRate,
        target: TARGETS.quotesToWins,
        variance: parseFloat(
          (quotesToWinsRate - TARGETS.quotesToWins).toFixed(1)
        ),
        counts: { from: totalQuotes, to: totalWins },
      },
    ];

    // Overall lead-to-win conversion
    const overallConversion =
      totalLeads > 0
        ? parseFloat(((totalWins / totalLeads) * 100).toFixed(1))
        : 0;

    return NextResponse.json({
      data: {
        conversions,
        summary: {
          totalLeads,
          totalMeetings,
          totalQuotes,
          totalWins,
          overallConversion,
        },
        targets: TARGETS,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/conversion error:", error);
    return NextResponse.json(
      { error: "Failed to generate conversion report" },
      { status: 500 }
    );
  }
}
