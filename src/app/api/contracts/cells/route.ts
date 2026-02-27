import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CellType } from "@prisma/client";

// ──────────────────────────────────────────────
// Cell type classification for pipeline deals
// ──────────────────────────────────────────────

function classifyCellType(weeklyHours: number): CellType {
  if (weeklyHours <= 15) return "A";
  if (weeklyHours <= 30) return "B";
  return "C";
}

// ──────────────────────────────────────────────
// GET /api/contracts/cells — Cell Type Dashboard
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const cellTypes: CellType[] = ["A", "B", "C"];

    // Fetch all active/mobilising contracts grouped by cellType
    const [contracts, pipelineDeals] = await Promise.all([
      prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: { in: ["mobilising", "active", "on_hold"] },
        },
        select: {
          id: true,
          contractName: true,
          unitId: true,
          cellType: true,
          weeklyHours: true,
          monthlyRevenue: true,
          healthStatus: true,
          teamLead: true,
          latestAuditScore: true,
          status: true,
          account: {
            select: { id: true, name: true },
          },
        },
        orderBy: { unitId: "asc" },
      }),
      // Pipeline deals that have quotes (potential future contracts)
      prisma.deal.findMany({
        where: {
          deletedAt: null,
          stage: {
            in: [
              "SiteSurveyBooked",
              "SurveyComplete",
              "QuoteSent",
              "Negotiation",
            ],
          },
          weeklyHours: { not: null },
        },
        select: {
          id: true,
          name: true,
          weeklyHours: true,
          weeklyValue: true,
          monthlyValue: true,
          stage: true,
          probability: true,
          account: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // Build cell groups
    const cells = cellTypes.map((cellType) => {
      // Filter contracts for this cell
      const cellContracts = contracts.filter((c) => c.cellType === cellType);

      const totalContracts = cellContracts.length;
      const totalHours = cellContracts.reduce(
        (sum, c) => sum + Number(c.weeklyHours),
        0
      );
      const totalMonthlyRevenue = cellContracts.reduce(
        (sum, c) => sum + Number(c.monthlyRevenue),
        0
      );

      // Pipeline deals that would become this cell type
      const cellPipeline = pipelineDeals.filter((d) => {
        const wh = Number(d.weeklyHours);
        return classifyCellType(wh) === cellType;
      });

      const pipelineCount = cellPipeline.length;
      const pipelineHours = cellPipeline.reduce(
        (sum, d) => sum + Number(d.weeklyHours),
        0
      );
      const pipelineMonthlyValue = cellPipeline.reduce(
        (sum, d) => sum + (d.monthlyValue ? Number(d.monthlyValue) : 0),
        0
      );

      return {
        cellType,
        summary: {
          totalContracts,
          totalHours: parseFloat(totalHours.toFixed(1)),
          totalMonthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
        },
        pipeline: {
          count: pipelineCount,
          totalHours: parseFloat(pipelineHours.toFixed(1)),
          totalMonthlyValue: parseFloat(pipelineMonthlyValue.toFixed(2)),
          deals: cellPipeline.map((d) => ({
            id: d.id,
            name: d.name,
            weeklyHours: Number(d.weeklyHours),
            monthlyValue: d.monthlyValue ? Number(d.monthlyValue) : null,
            stage: d.stage,
            probability: d.probability,
            account: d.account,
          })),
        },
        contracts: cellContracts.map((c) => ({
          id: c.id,
          contractName: c.contractName,
          unitId: c.unitId,
          weeklyHours: Number(c.weeklyHours),
          monthlyRevenue: Number(c.monthlyRevenue),
          healthStatus: c.healthStatus,
          teamLead: c.teamLead,
          latestAuditScore: Number(c.latestAuditScore),
          status: c.status,
          account: c.account,
        })),
      };
    });

    // Grand totals
    const grandTotal = {
      totalContracts: contracts.length,
      totalHours: parseFloat(
        contracts.reduce((sum, c) => sum + Number(c.weeklyHours), 0).toFixed(1)
      ),
      totalMonthlyRevenue: parseFloat(
        contracts
          .reduce((sum, c) => sum + Number(c.monthlyRevenue), 0)
          .toFixed(2)
      ),
      pipelineCount: pipelineDeals.length,
      pipelineHours: parseFloat(
        pipelineDeals
          .reduce((sum, d) => sum + Number(d.weeklyHours), 0)
          .toFixed(1)
      ),
    };

    return NextResponse.json({
      data: {
        cells,
        grandTotal,
      },
    });
  } catch (error) {
    console.error("GET /api/contracts/cells error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cell dashboard" },
      { status: 500 }
    );
  }
}
