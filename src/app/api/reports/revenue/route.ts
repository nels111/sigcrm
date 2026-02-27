import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CellType } from "@prisma/client";

// GET /api/reports/revenue — Revenue breakdown by cell type (A vs B vs C)
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
        cellType: true,
        weeklyHours: true,
        monthlyRevenue: true,
        annualValue: true,
        grossMarginPercent: true,
        account: { select: { id: true, name: true } },
      },
    });

    const cellTypes: CellType[] = ["A", "B", "C"];

    const breakdown = cellTypes.map((cellType) => {
      const cellContracts = contracts.filter((c) => c.cellType === cellType);
      const contractCount = cellContracts.length;

      const totalHours = cellContracts.reduce(
        (sum, c) => sum + Number(c.weeklyHours),
        0
      );

      const totalMonthlyRevenue = cellContracts.reduce(
        (sum, c) => sum + Number(c.monthlyRevenue),
        0
      );

      const totalAnnualValue = cellContracts.reduce(
        (sum, c) => sum + Number(c.annualValue),
        0
      );

      const avgMargin =
        contractCount > 0
          ? cellContracts.reduce(
              (sum, c) => sum + Number(c.grossMarginPercent),
              0
            ) / contractCount
          : 0;

      return {
        cellType,
        contractCount,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalMonthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
        totalAnnualValue: parseFloat(totalAnnualValue.toFixed(2)),
        avgMargin: parseFloat(avgMargin.toFixed(1)),
        contracts: cellContracts.map((c) => ({
          id: c.id,
          contractName: c.contractName,
          weeklyHours: Number(c.weeklyHours),
          monthlyRevenue: Number(c.monthlyRevenue),
          annualValue: Number(c.annualValue),
          grossMarginPercent: Number(c.grossMarginPercent),
          account: c.account,
        })),
      };
    });

    // Grand totals
    const grandTotal = {
      contractCount: contracts.length,
      totalHours: parseFloat(
        contracts
          .reduce((sum, c) => sum + Number(c.weeklyHours), 0)
          .toFixed(1)
      ),
      totalMonthlyRevenue: parseFloat(
        contracts
          .reduce((sum, c) => sum + Number(c.monthlyRevenue), 0)
          .toFixed(2)
      ),
      totalAnnualValue: parseFloat(
        contracts
          .reduce((sum, c) => sum + Number(c.annualValue), 0)
          .toFixed(2)
      ),
      avgMargin:
        contracts.length > 0
          ? parseFloat(
              (
                contracts.reduce(
                  (sum, c) => sum + Number(c.grossMarginPercent),
                  0
                ) / contracts.length
              ).toFixed(1)
            )
          : 0,
    };

    return NextResponse.json({
      data: {
        breakdown,
        grandTotal,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/revenue error:", error);
    return NextResponse.json(
      { error: "Failed to generate revenue report" },
      { status: 500 }
    );
  }
}
