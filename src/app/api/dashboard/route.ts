import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ──────────────────────────────────────────────
// GET /api/dashboard — Aggregated dashboard data
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      // Pipeline KPIs
      activeDeals,
      // Operations KPIs
      activeContracts,
      // Lead/Quote KPIs
      leadsInCadence,
      quotesAwaiting,
      // Tasks
      todaysTasks,
      overdueTaskCount,
      // Recent Activity
      recentActivities,
      // Upcoming Meetings
      upcomingMeetings,
      // Stale Deals
      staleDeals,
      // Win/Loss
      wonDeals,
      lostDeals,
      // Overdue audits
      overdueAudits,
    ] = await Promise.all([
      // Active deals with amounts
      prisma.deal.findMany({
        where: {
          deletedAt: null,
          stage: {
            notIn: [
              "ClosedWonRecurring",
              "ClosedWonOneOff",
              "ClosedLostRecurring",
              "ClosedLostOneOff",
            ],
          },
        },
        select: {
          id: true,
          name: true,
          amount: true,
          monthlyValue: true,
          probability: true,
          expectedCloseDate: true,
          stage: true,
          account: { select: { id: true, name: true } },
        },
      }),

      // Active contracts with financial data
      prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: { in: ["mobilising", "active", "on_hold"] },
        },
        select: {
          weeklyHours: true,
          monthlyRevenue: true,
          annualValue: true,
        },
      }),

      // Leads in cadence
      prisma.lead.count({
        where: { deletedAt: null, cadenceStatus: "ActiveInCadence" },
      }),

      // Quotes awaiting response
      prisma.quote.count({
        where: { status: "sent" },
      }),

      // Today's tasks (limit 8)
      prisma.task.findMany({
        where: {
          status: { in: ["pending", "in_progress"] },
          dueDate: { gte: startOfDay, lt: endOfDay },
        },
        select: {
          id: true,
          title: true,
          priority: true,
          taskType: true,
          dueDate: true,
          deal: { select: { id: true, name: true } },
          lead: { select: { id: true, companyName: true } },
          account: { select: { id: true, name: true } },
          contract: { select: { id: true, contractName: true } },
        },
        orderBy: [
          { priority: "desc" },
          { dueDate: "asc" },
        ],
        take: 8,
      }),

      // Overdue task count
      prisma.task.count({
        where: {
          status: { in: ["pending", "in_progress"] },
          dueDate: { lt: startOfDay },
        },
      }),

      // Recent activities (last 8)
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          activityType: true,
          subject: true,
          createdAt: true,
          deal: { select: { id: true, name: true } },
          lead: { select: { id: true, companyName: true } },
          account: { select: { id: true, name: true } },
          contract: { select: { id: true, contractName: true } },
          performer: { select: { id: true, name: true } },
        },
      }),

      // Upcoming meetings (next 5)
      prisma.calendarEvent.findMany({
        where: {
          startTime: { gte: now },
          status: "scheduled",
        },
        orderBy: { startTime: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          eventType: true,
          contact: { select: { id: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true } },
        },
      }),

      // Stale deals (no activity 14+ days, limit 5)
      prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          stage_changed_at: Date | null;
          created_at: Date;
          account_id: string | null;
          account_name: string | null;
        }>
      >`
        SELECT d.id, d.name, d.stage_changed_at, d.created_at,
               a.id as account_id, a.name as account_name
        FROM deals d
        LEFT JOIN accounts a ON d.account_id = a.id
        WHERE d.deleted_at IS NULL
          AND d.stage NOT IN ('Closed Won Recurring', 'Closed Won One-Off', 'Closed Lost Recurring', 'Closed Lost One-Off')
          AND COALESCE(d.stage_changed_at, d.created_at) < ${fourteenDaysAgo}
        ORDER BY COALESCE(d.stage_changed_at, d.created_at) ASC
        LIMIT 5
      `,

      // Won deals count
      prisma.deal.count({
        where: {
          deletedAt: null,
          stage: { in: ["ClosedWonRecurring", "ClosedWonOneOff"] },
        },
      }),

      // Lost deals count
      prisma.deal.count({
        where: {
          deletedAt: null,
          stage: { in: ["ClosedLostRecurring", "ClosedLostOneOff"] },
        },
      }),

      // Overdue audits
      prisma.contract.count({
        where: {
          deletedAt: null,
          status: "active",
          nextAuditDate: { lt: now },
        },
      }),
    ]);

    // --- Compute pipeline KPIs ---
    const pipelineValue = activeDeals.reduce(
      (sum, d) => sum + (d.amount ? Number(d.amount) : 0),
      0
    );
    const weightedForecast = activeDeals.reduce(
      (sum, d) =>
        sum +
        (d.amount ? Number(d.amount) : 0) * ((d.probability ?? 0) / 100),
      0
    );
    const dealsClosingThisMonth = activeDeals.filter((d) => {
      if (!d.expectedCloseDate) return false;
      const close = new Date(d.expectedCloseDate);
      return close >= startOfMonth && close <= endOfMonth;
    }).length;

    // --- Compute operations KPIs ---
    const totalWeeklyHours = activeContracts.reduce(
      (sum, c) => sum + Number(c.weeklyHours),
      0
    );
    const totalMonthlyRevenue = activeContracts.reduce(
      (sum, c) => sum + Number(c.monthlyRevenue),
      0
    );

    // --- Compute stale deals with days ---
    const staleDealsList = staleDeals.map((d) => {
      const lastDate = d.stage_changed_at || d.created_at;
      const daysStale = Math.floor(
        (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: d.id,
        name: d.name,
        daysStale,
        account: d.account_id
          ? { id: d.account_id, name: d.account_name || "" }
          : null,
      };
    });

    // --- Win rate ---
    const totalClosed = wonDeals + lostDeals;
    const winRate = totalClosed > 0 ? Math.round((wonDeals / totalClosed) * 100) : 0;

    return NextResponse.json({
      data: {
        pipeline: {
          value: parseFloat(pipelineValue.toFixed(2)),
          weightedForecast: parseFloat(weightedForecast.toFixed(2)),
          dealsClosingThisMonth,
          activeDealCount: activeDeals.length,
        },
        operations: {
          activeContracts: activeContracts.length,
          weeklyHours: parseFloat(totalWeeklyHours.toFixed(1)),
          monthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
          overdueAudits,
        },
        leads: {
          inCadence: leadsInCadence,
          quotesAwaiting,
        },
        tasks: {
          today: todaysTasks,
          overdueCount: overdueTaskCount,
        },
        recentActivity: recentActivities,
        upcomingMeetings,
        staleDeals: staleDealsList,
        winLoss: {
          won: wonDeals,
          lost: lostDeals,
          winRate,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
