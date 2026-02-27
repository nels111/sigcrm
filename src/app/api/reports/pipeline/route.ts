import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DealStage } from "@prisma/client";

// Pipeline stages in funnel order (excludes closed stages for active pipeline)
const ACTIVE_STAGES: DealStage[] = [
  "NewLead",
  "Contacted",
  "SiteSurveyBooked",
  "SurveyComplete",
  "QuoteSent",
  "Negotiation",
];

const CLOSED_WON_STAGES: DealStage[] = [
  "ClosedWonRecurring",
  "ClosedWonOneOff",
];

const CLOSED_LOST_STAGES: DealStage[] = [
  "ClosedLostRecurring",
  "ClosedLostOneOff",
];

const ALL_STAGES: DealStage[] = [
  ...ACTIVE_STAGES,
  ...CLOSED_WON_STAGES,
  ...CLOSED_LOST_STAGES,
];

// GET /api/reports/pipeline — Pipeline report with value, forecast, and avg days per stage
export async function GET() {
  try {
    const deals = await prisma.deal.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        stage: true,
        amount: true,
        monthlyValue: true,
        probability: true,
        stageChangedAt: true,
        account: { select: { id: true, name: true } },
      },
    });

    const now = new Date();

    const stages = ALL_STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const count = stageDeals.length;

      const totalValue = stageDeals.reduce(
        (sum, d) => sum + (d.amount ? Number(d.amount) : 0),
        0
      );

      const totalMonthlyValue = stageDeals.reduce(
        (sum, d) => sum + (d.monthlyValue ? Number(d.monthlyValue) : 0),
        0
      );

      const weightedForecast = stageDeals.reduce((sum, d) => {
        const amount = d.amount ? Number(d.amount) : 0;
        return sum + amount * (d.probability / 100);
      }, 0);

      const avgDaysInStage =
        count > 0
          ? Math.round(
              stageDeals.reduce((sum, d) => {
                const days =
                  (now.getTime() - new Date(d.stageChangedAt).getTime()) /
                  (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0) / count
            )
          : 0;

      return {
        stage,
        count,
        totalValue: parseFloat(totalValue.toFixed(2)),
        totalMonthlyValue: parseFloat(totalMonthlyValue.toFixed(2)),
        weightedForecast: parseFloat(weightedForecast.toFixed(2)),
        avgDaysInStage,
        deals: stageDeals.map((d) => ({
          id: d.id,
          name: d.name,
          amount: d.amount ? Number(d.amount) : null,
          monthlyValue: d.monthlyValue ? Number(d.monthlyValue) : null,
          probability: d.probability,
          daysInStage: Math.floor(
            (now.getTime() - new Date(d.stageChangedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
          account: d.account,
        })),
      };
    });

    const activePipeline = stages.filter((s) =>
      ACTIVE_STAGES.includes(s.stage as DealStage)
    );
    const totalActiveValue = activePipeline.reduce(
      (sum, s) => sum + s.totalValue,
      0
    );
    const totalWeightedForecast = activePipeline.reduce(
      (sum, s) => sum + s.weightedForecast,
      0
    );
    const totalActiveDeals = activePipeline.reduce(
      (sum, s) => sum + s.count,
      0
    );

    return NextResponse.json({
      data: {
        stages,
        summary: {
          totalActiveDeals,
          totalActiveValue: parseFloat(totalActiveValue.toFixed(2)),
          totalWeightedForecast: parseFloat(totalWeightedForecast.toFixed(2)),
          totalDeals: deals.length,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/reports/pipeline error:", error);
    return NextResponse.json(
      { error: "Failed to generate pipeline report" },
      { status: 500 }
    );
  }
}
