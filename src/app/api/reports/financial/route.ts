import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Margin traffic light thresholds
function getMarginStatus(marginPercent: number): "GREEN" | "AMBER" | "RED" {
  if (marginPercent >= 35) return "GREEN";
  if (marginPercent >= 25) return "AMBER";
  return "RED";
}

// GET /api/reports/financial — Financial summary: revenue, costs, margins by contract
export async function GET() {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["mobilising", "active", "on_hold"] },
      },
      select: {
        id: true,
        contractName: true,
        unitId: true,
        cellType: true,
        monthlyRevenue: true,
        monthlyLabourCost: true,
        consumablesPercent: true,
        grossMarginPercent: true,
        healthStatus: true,
        weeklyHours: true,
        annualValue: true,
        account: { select: { id: true, name: true } },
      },
      orderBy: { contractName: "asc" },
    });

    const contractDetails = contracts.map((c) => {
      const monthlyRevenue = Number(c.monthlyRevenue);
      const monthlyLabourCost = Number(c.monthlyLabourCost);
      const consumablesPercent = Number(c.consumablesPercent);
      const consumablesCost = monthlyRevenue * (consumablesPercent / 100);
      const grossMarginPercent = Number(c.grossMarginPercent);
      const marginStatus = getMarginStatus(grossMarginPercent);

      return {
        id: c.id,
        contractName: c.contractName,
        unitId: c.unitId,
        cellType: c.cellType,
        monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
        monthlyLabourCost: parseFloat(monthlyLabourCost.toFixed(2)),
        consumablesPercent: parseFloat(consumablesPercent.toFixed(2)),
        consumablesCost: parseFloat(consumablesCost.toFixed(2)),
        grossMarginPercent: parseFloat(grossMarginPercent.toFixed(1)),
        marginStatus,
        healthStatus: c.healthStatus,
        weeklyHours: Number(c.weeklyHours),
        annualValue: Number(c.annualValue),
        account: c.account,
      };
    });

    // Summary totals
    const totalMonthlyRevenue = contractDetails.reduce(
      (sum, c) => sum + c.monthlyRevenue,
      0
    );
    const totalMonthlyLabourCost = contractDetails.reduce(
      (sum, c) => sum + c.monthlyLabourCost,
      0
    );
    const totalConsumablesCost = contractDetails.reduce(
      (sum, c) => sum + c.consumablesCost,
      0
    );
    const totalGrossProfit =
      totalMonthlyRevenue - totalMonthlyLabourCost - totalConsumablesCost;
    const overallMarginPercent =
      totalMonthlyRevenue > 0
        ? (totalGrossProfit / totalMonthlyRevenue) * 100
        : 0;
    const overallMarginStatus = getMarginStatus(overallMarginPercent);

    // Count by margin status
    const marginDistribution = {
      green: contractDetails.filter((c) => c.marginStatus === "GREEN").length,
      amber: contractDetails.filter((c) => c.marginStatus === "AMBER").length,
      red: contractDetails.filter((c) => c.marginStatus === "RED").length,
    };

    return NextResponse.json({
      data: {
        contracts: contractDetails,
        summary: {
          contractCount: contractDetails.length,
          totalMonthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
          totalMonthlyLabourCost: parseFloat(totalMonthlyLabourCost.toFixed(2)),
          totalConsumablesCost: parseFloat(totalConsumablesCost.toFixed(2)),
          totalGrossProfit: parseFloat(totalGrossProfit.toFixed(2)),
          overallMarginPercent: parseFloat(overallMarginPercent.toFixed(1)),
          overallMarginStatus,
          marginDistribution,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/reports/financial error:", error);
    return NextResponse.json(
      { error: "Failed to generate financial report" },
      { status: 500 }
    );
  }
}
