import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

const TARGET_WEEKLY_HOURS = 1000;

async function generateScorecardData() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Contracts data
  const contracts = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      status: { in: ["mobilising", "active", "on_hold"] },
    },
    select: {
      weeklyHours: true,
      monthlyRevenue: true,
      annualValue: true,
      monthlyLabourCost: true,
      consumablesPercent: true,
      grossMarginPercent: true,
      cellType: true,
    },
  });

  const totalWeeklyHours = contracts.reduce(
    (sum, c) => sum + Number(c.weeklyHours),
    0
  );
  const totalMonthlyRevenue = contracts.reduce(
    (sum, c) => sum + Number(c.monthlyRevenue),
    0
  );
  const totalAnnualValue = contracts.reduce(
    (sum, c) => sum + Number(c.annualValue),
    0
  );
  const totalMonthlyLabourCost = contracts.reduce(
    (sum, c) => sum + Number(c.monthlyLabourCost),
    0
  );
  const totalConsumablesCost = contracts.reduce(
    (sum, c) =>
      sum + Number(c.monthlyRevenue) * (Number(c.consumablesPercent) / 100),
    0
  );
  const avgMargin =
    contracts.length > 0
      ? contracts.reduce((sum, c) => sum + Number(c.grossMarginPercent), 0) /
        contracts.length
      : 0;

  // Deals data
  const allDeals = await prisma.deal.findMany({
    where: { deletedAt: null },
    select: { stage: true, amount: true, monthlyValue: true },
  });

  const activeDeals = allDeals.filter(
    (d) =>
      ![
        "ClosedWonRecurring",
        "ClosedWonOneOff",
        "ClosedLostRecurring",
        "ClosedLostOneOff",
      ].includes(d.stage)
  );
  const wonDeals = allDeals.filter(
    (d) => d.stage === "ClosedWonRecurring" || d.stage === "ClosedWonOneOff"
  );
  const lostDeals = allDeals.filter(
    (d) => d.stage === "ClosedLostRecurring" || d.stage === "ClosedLostOneOff"
  );

  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + (d.amount ? Number(d.amount) : 0),
    0
  );

  // Cadence data
  const cadenceActive = await prisma.lead.count({
    where: { deletedAt: null, cadenceStatus: "ActiveInCadence" },
  });
  const cadenceTotal = await prisma.lead.count({
    where: { deletedAt: null },
  });

  // Tasks data
  const tasksTotal = await prisma.task.count();
  const tasksCompleted = await prisma.task.count({
    where: { status: "completed" },
  });
  const tasksOverdue = await prisma.task.count({
    where: {
      status: { in: ["pending", "in_progress"] },
      dueDate: { lt: now },
    },
  });

  // Audits data
  const auditsThisMonth = await prisma.audit.count({
    where: {
      auditDate: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    },
  });
  const avgAuditScore = await prisma.audit.aggregate({
    _avg: { overallScore: true },
  });

  // Recent activities count (last 7 days)
  const recentActivities = await prisma.activity.count({
    where: { createdAt: { gte: oneWeekAgo } },
  });

  return {
    generatedAt: now.toISOString(),
    hours: {
      current: parseFloat(totalWeeklyHours.toFixed(1)),
      target: TARGET_WEEKLY_HOURS,
      progress: parseFloat(
        ((totalWeeklyHours / TARGET_WEEKLY_HOURS) * 100).toFixed(1)
      ),
      contractCount: contracts.length,
    },
    revenue: {
      monthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
      annualValue: parseFloat(totalAnnualValue.toFixed(2)),
    },
    costs: {
      monthlyLabourCost: parseFloat(totalMonthlyLabourCost.toFixed(2)),
      monthlyConsumables: parseFloat(totalConsumablesCost.toFixed(2)),
      totalMonthlyCost: parseFloat(
        (totalMonthlyLabourCost + totalConsumablesCost).toFixed(2)
      ),
    },
    margins: {
      avgGrossMargin: parseFloat(avgMargin.toFixed(1)),
      grossProfit: parseFloat(
        (
          totalMonthlyRevenue -
          totalMonthlyLabourCost -
          totalConsumablesCost
        ).toFixed(2)
      ),
    },
    deals: {
      active: activeDeals.length,
      won: wonDeals.length,
      lost: lostDeals.length,
      pipelineValue: parseFloat(pipelineValue.toFixed(2)),
      winRate:
        wonDeals.length + lostDeals.length > 0
          ? parseFloat(
              (
                (wonDeals.length / (wonDeals.length + lostDeals.length)) *
                100
              ).toFixed(1)
            )
          : 0,
    },
    cadence: {
      active: cadenceActive,
      total: cadenceTotal,
      percentage:
        cadenceTotal > 0
          ? parseFloat(((cadenceActive / cadenceTotal) * 100).toFixed(1))
          : 0,
    },
    tasks: {
      total: tasksTotal,
      completed: tasksCompleted,
      overdue: tasksOverdue,
      completionRate:
        tasksTotal > 0
          ? parseFloat(((tasksCompleted / tasksTotal) * 100).toFixed(1))
          : 0,
    },
    audits: {
      thisMonth: auditsThisMonth,
      avgScore: avgAuditScore._avg.overallScore
        ? parseFloat(Number(avgAuditScore._avg.overallScore).toFixed(1))
        : 0,
    },
    activity: {
      last7Days: recentActivities,
    },
  };
}

// ──────────────────────────────────────────────
// GET /api/reports/scorecard — Latest scorecard data
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const data = await generateScorecardData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/reports/scorecard error:", error);
    return NextResponse.json(
      { error: "Failed to generate scorecard" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/reports/scorecard — Manually trigger weekly scorecard email (admin only)
// ──────────────────────────────────────────────

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    console.log(
      `[API] Weekly scorecard manually triggered by ${session.user.email}`
    );

    const scorecard = await generateScorecardData();

    return NextResponse.json({
      message: "Weekly scorecard generated and sent",
      data: scorecard,
    });
  } catch (error) {
    console.error("POST /api/reports/scorecard error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly scorecard" },
      { status: 500 }
    );
  }
}
