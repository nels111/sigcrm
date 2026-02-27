import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/deals/forecast — Pipeline forecast with weighted values and conversion rates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get("assignedTo");

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Base where clause for active (non-closed, non-deleted) deals
    const baseWhere: Record<string, unknown> = {
      deletedAt: null,
      stage: {
        notIn: [
          "ClosedWonRecurring",
          "ClosedWonOneOff",
          "ClosedLostRecurring",
          "ClosedLostOneOff",
        ],
      },
    };

    if (assignedTo) {
      baseWhere.assignedTo = assignedTo;
    }

    // Fetch all active deals for forecast calculations
    const activeDeals = await prisma.deal.findMany({
      where: baseWhere,
      select: {
        id: true,
        amount: true,
        monthlyValue: true,
        probability: true,
        expectedCloseDate: true,
        stage: true,
        createdAt: true,
      },
    });

    // Calculate probability-weighted values for 30/60/90 day windows
    const calculateWindowForecast = (windowEnd: Date) => {
      const windowDeals = activeDeals.filter((deal) => {
        if (!deal.expectedCloseDate) return false;
        return new Date(deal.expectedCloseDate) <= windowEnd;
      });

      const weightedAmount = windowDeals.reduce((sum, deal) => {
        const amount = deal.amount ? parseFloat(deal.amount.toString()) : 0;
        return sum + amount * (deal.probability / 100);
      }, 0);

      const weightedMonthlyValue = windowDeals.reduce((sum, deal) => {
        const monthly = deal.monthlyValue
          ? parseFloat(deal.monthlyValue.toString())
          : 0;
        return sum + monthly * (deal.probability / 100);
      }, 0);

      const totalUnweightedAmount = windowDeals.reduce((sum, deal) => {
        return sum + (deal.amount ? parseFloat(deal.amount.toString()) : 0);
      }, 0);

      const totalUnweightedMonthly = windowDeals.reduce((sum, deal) => {
        return sum + (deal.monthlyValue ? parseFloat(deal.monthlyValue.toString()) : 0);
      }, 0);

      return {
        dealCount: windowDeals.length,
        weightedAmount: Math.round(weightedAmount * 100) / 100,
        weightedMonthlyValue: Math.round(weightedMonthlyValue * 100) / 100,
        totalAmount: Math.round(totalUnweightedAmount * 100) / 100,
        totalMonthlyValue: Math.round(totalUnweightedMonthly * 100) / 100,
      };
    };

    const forecast30 = calculateWindowForecast(thirtyDays);
    const forecast60 = calculateWindowForecast(sixtyDays);
    const forecast90 = calculateWindowForecast(ninetyDays);

    // Build where for all deals (including closed) for conversion rate calculations
    const allDealsWhere: Record<string, unknown> = {
      deletedAt: null,
    };
    if (assignedTo) {
      allDealsWhere.assignedTo = assignedTo;
    }

    // Fetch all deals for conversion rate calculations
    const allDeals = await prisma.deal.findMany({
      where: allDealsWhere,
      select: {
        id: true,
        stage: true,
        createdAt: true,
        actualCloseDate: true,
        stageChangedAt: true,
      },
    });

    // Calculate conversion rates
    const totalDeals = allDeals.length;

    // Leads = all deals that ever existed (every deal starts as NewLead)
    const totalLeads = totalDeals;

    // Meetings = deals that reached SiteSurveyBooked or beyond
    const meetingStages = new Set([
      "SiteSurveyBooked",
      "SurveyComplete",
      "QuoteSent",
      "Negotiation",
      "ClosedWonRecurring",
      "ClosedWonOneOff",
      "ClosedLostRecurring",
      "ClosedLostOneOff",
    ]);
    const totalMeetings = allDeals.filter((d) =>
      meetingStages.has(d.stage)
    ).length;

    // Quotes = deals that reached QuoteSent or beyond
    const quoteStages = new Set([
      "QuoteSent",
      "Negotiation",
      "ClosedWonRecurring",
      "ClosedWonOneOff",
      "ClosedLostRecurring",
      "ClosedLostOneOff",
    ]);
    const totalQuotes = allDeals.filter((d) =>
      quoteStages.has(d.stage)
    ).length;

    // Wins
    const winStages = new Set(["ClosedWonRecurring", "ClosedWonOneOff"]);
    const totalWins = allDeals.filter((d) => winStages.has(d.stage)).length;

    const leadsToMeetings =
      totalLeads > 0
        ? Math.round((totalMeetings / totalLeads) * 10000) / 100
        : 0;
    const meetingsToQuotes =
      totalMeetings > 0
        ? Math.round((totalQuotes / totalMeetings) * 10000) / 100
        : 0;
    const quotesToWins =
      totalQuotes > 0
        ? Math.round((totalWins / totalQuotes) * 10000) / 100
        : 0;

    // Average sales cycle: days from createdAt to actualCloseDate for won deals
    const wonDeals = allDeals.filter(
      (d) => winStages.has(d.stage) && d.actualCloseDate
    );
    const averageSalesCycleDays =
      wonDeals.length > 0
        ? Math.round(
            wonDeals.reduce((sum, d) => {
              const created = new Date(d.createdAt).getTime();
              const closed = new Date(d.actualCloseDate!).getTime();
              return sum + (closed - created) / (1000 * 60 * 60 * 24);
            }, 0) / wonDeals.length
          )
        : null;

    return NextResponse.json({
      data: {
        forecast: {
          thirtyDay: forecast30,
          sixtyDay: forecast60,
          ninetyDay: forecast90,
        },
        conversionRates: {
          leadsToMeetings,
          meetingsToQuotes,
          quotesToWins,
          counts: {
            totalLeads,
            totalMeetings,
            totalQuotes,
            totalWins,
          },
        },
        averageSalesCycleDays,
        activePipelineCount: activeDeals.length,
        activePipelineTotalAmount: Math.round(
          activeDeals.reduce(
            (sum, d) =>
              sum + (d.amount ? parseFloat(d.amount.toString()) : 0),
            0
          ) * 100
        ) / 100,
        activePipelineWeightedAmount: Math.round(
          activeDeals.reduce(
            (sum, d) =>
              sum +
              (d.amount ? parseFloat(d.amount.toString()) : 0) *
                (d.probability / 100),
            0
          ) * 100
        ) / 100,
      },
    });
  } catch (error) {
    console.error("GET /api/deals/forecast error:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast data" },
      { status: 500 }
    );
  }
}
