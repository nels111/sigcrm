import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DealStage } from "@prisma/client";

// All pipeline stages in display order
const PIPELINE_STAGES: DealStage[] = [
  "NewLead",
  "Contacted",
  "SiteSurveyBooked",
  "SurveyComplete",
  "QuoteSent",
  "Negotiation",
  "ClosedWonRecurring",
  "ClosedWonOneOff",
  "ClosedLostRecurring",
  "ClosedLostOneOff",
];

// GET /api/deals/pipeline — Optimized for Kanban board
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get("assignedTo");
    const dealType = searchParams.get("dealType");

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (dealType) {
      where.dealType = dealType;
    }

    // Fetch all active deals with minimal fields for Kanban performance
    const deals = await prisma.deal.findMany({
      where,
      select: {
        id: true,
        name: true,
        amount: true,
        monthlyValue: true,
        weeklyHours: true,
        cellType: true,
        stage: true,
        stageChangedAt: true,
        assignee: {
          select: { id: true, name: true },
        },
        account: {
          select: { id: true, name: true },
        },
        activities: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
      },
      orderBy: { stageChangedAt: "desc" },
    });

    // Group by stage and calculate daysInStage
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: Record<string, any[]> = {};

    // Initialize all stages (so empty stages still show on the board)
    for (const stage of PIPELINE_STAGES) {
      pipeline[stage] = [];
    }

    for (const deal of deals) {
      const daysInStage = Math.floor(
        (now.getTime() - new Date(deal.stageChangedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const lastActivityDate =
        deal.activities.length > 0 ? deal.activities[0].createdAt : null;

      pipeline[deal.stage].push({
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        monthlyValue: deal.monthlyValue,
        weeklyHours: deal.weeklyHours,
        cellType: deal.cellType,
        stage: deal.stage,
        stageChangedAt: deal.stageChangedAt,
        daysInStage,
        assignee: deal.assignee,
        account: deal.account,
        lastActivityDate,
      });
    }

    // Summary stats per stage
    const stageSummaries = PIPELINE_STAGES.map((stage) => {
      const stageDeals = pipeline[stage];
      return {
        stage,
        count: stageDeals.length,
        totalAmount: stageDeals.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum: number, d: any) =>
            sum + (d.amount ? parseFloat(String(d.amount)) : 0),
          0
        ),
        totalMonthlyValue: stageDeals.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum: number, d: any) =>
            sum + (d.monthlyValue ? parseFloat(String(d.monthlyValue)) : 0),
          0
        ),
      };
    });

    return NextResponse.json({
      data: {
        pipeline,
        stages: PIPELINE_STAGES,
        summary: stageSummaries,
        totalDeals: deals.length,
      },
    });
  } catch (error) {
    console.error("GET /api/deals/pipeline error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline data" },
      { status: 500 }
    );
  }
}
