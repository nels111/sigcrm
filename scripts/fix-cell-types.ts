/**
 * Fix Cell Types
 *
 * Recalculates cellType based on weeklyHours (not visits) for all contracts.
 * Also regenerates unitId, auditFrequency, and supervisorHoursAlloc.
 *
 * Cell A: 1–15 hrs/wk  | Cell B: 16–30 hrs/wk  | Cell C: 31+ hrs/wk
 *
 * Usage:
 *   npx tsx scripts/fix-cell-types.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CellType = "A" | "B" | "C";

function calculateCellType(weeklyHours: number): CellType {
  if (weeklyHours <= 15) return "A";
  if (weeklyHours <= 30) return "B";
  return "C";
}

function getAuditFrequency(cellType: CellType): string {
  switch (cellType) {
    case "A": return "monthly";
    case "B": return "fortnightly";
    case "C": return "weekly";
  }
}

function getSupervisorAllocPercent(cellType: CellType): number {
  switch (cellType) {
    case "A": return 0.1;
    case "B": return 0.15;
    case "C": return 0.2;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Fix Cell Types — weeklyHours-based classification");
  console.log("  A: 1-15h | B: 16-30h | C: 31+h");
  console.log("=".repeat(60));

  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      contractName: true,
      weeklyHours: true,
      cellType: true,
      unitId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nFound ${contracts.length} contracts to check.\n`);

  // Track unit ID counters per cell type
  const unitCounters: Record<CellType, number> = { A: 0, B: 0, C: 0 };

  let updated = 0;
  let unchanged = 0;

  for (const contract of contracts) {
    const hours = Number(contract.weeklyHours);
    const correctCell = calculateCellType(hours);

    // Increment counter for this cell type
    unitCounters[correctCell]++;
    const newUnitId = `${correctCell}-${unitCounters[correctCell].toString().padStart(3, "0")}`;
    const newAuditFreq = getAuditFrequency(correctCell);
    const newSupervisorAlloc = getSupervisorAllocPercent(correctCell) * hours;

    const needsUpdate =
      contract.cellType !== correctCell ||
      contract.unitId !== newUnitId;

    if (needsUpdate) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          cellType: correctCell as any,
          unitId: newUnitId,
          auditFrequency: newAuditFreq,
          supervisorHoursAlloc: parseFloat(newSupervisorAlloc.toFixed(2)),
        },
      });

      console.log(
        `  FIXED: ${contract.contractName.padEnd(22)} ${hours}h/wk → Cell ${correctCell} (was ${contract.cellType}) | ${newUnitId}`
      );
      updated++;
    } else {
      // Still update unitId to keep sequence clean
      if (contract.unitId !== newUnitId) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { unitId: newUnitId },
        });
      }
      unchanged++;
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`  Results: ${updated} fixed, ${unchanged} already correct`);
  console.log(`  Cell A: ${unitCounters.A} | Cell B: ${unitCounters.B} | Cell C: ${unitCounters.C}`);
  console.log("-".repeat(60));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("\nFATAL:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
