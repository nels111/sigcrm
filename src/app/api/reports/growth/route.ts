import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TARGET_WEEKLY_HOURS = 1000;

// GET /api/reports/growth — Weekly hours progress toward 1,000 target
export async function GET() {
  try {
    const activeContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["mobilising", "active"] },
      },
      select: {
        id: true,
        contractName: true,
        weeklyHours: true,
        startDate: true,
        createdAt: true,
        cellType: true,
        account: { select: { id: true, name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    const currentTotalHours = activeContracts.reduce(
      (sum, c) => sum + Number(c.weeklyHours),
      0
    );

    const progress = parseFloat(
      ((currentTotalHours / TARGET_WEEKLY_HOURS) * 100).toFixed(1)
    );
    const remainingHours = parseFloat(
      Math.max(0, TARGET_WEEKLY_HOURS - currentTotalHours).toFixed(1)
    );

    // Build monthly trend data: hours added per month based on contract start dates
    const monthlyTrend: Record<string, number> = {};
    for (const contract of activeContracts) {
      const date = contract.startDate || contract.createdAt;
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      monthlyTrend[monthKey] =
        (monthlyTrend[monthKey] || 0) + Number(contract.weeklyHours);
    }

    // Sort by month and build cumulative trend
    const sortedMonths = Object.keys(monthlyTrend).sort();
    let cumulative = 0;
    const trend = sortedMonths.map((month) => {
      cumulative += monthlyTrend[month];
      return {
        month,
        hoursAdded: parseFloat(monthlyTrend[month].toFixed(1)),
        cumulativeHours: parseFloat(cumulative.toFixed(1)),
      };
    });

    // Project date to reach 1,000 hours based on average monthly growth
    let projectedDate: string | null = null;
    if (
      currentTotalHours < TARGET_WEEKLY_HOURS &&
      sortedMonths.length >= 2
    ) {
      // Calculate average monthly hours added over the last 6 months (or all available)
      const recentMonths = sortedMonths.slice(-6);
      const totalRecentHours = recentMonths.reduce(
        (sum, m) => sum + monthlyTrend[m],
        0
      );
      const avgMonthlyGrowth = totalRecentHours / recentMonths.length;

      if (avgMonthlyGrowth > 0) {
        const monthsToTarget = Math.ceil(remainingHours / avgMonthlyGrowth);
        const projected = new Date();
        projected.setMonth(projected.getMonth() + monthsToTarget);
        projectedDate = projected.toISOString().split("T")[0];
      }
    } else if (currentTotalHours >= TARGET_WEEKLY_HOURS) {
      projectedDate = "Achieved";
    }

    return NextResponse.json({
      data: {
        target: TARGET_WEEKLY_HOURS,
        currentTotalHours: parseFloat(currentTotalHours.toFixed(1)),
        progress,
        remainingHours,
        projectedDate,
        contractCount: activeContracts.length,
        trend,
        contracts: activeContracts.map((c) => ({
          id: c.id,
          contractName: c.contractName,
          weeklyHours: Number(c.weeklyHours),
          cellType: c.cellType,
          startDate: c.startDate,
          account: c.account,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/reports/growth error:", error);
    return NextResponse.json(
      { error: "Failed to generate growth report" },
      { status: 500 }
    );
  }
}
