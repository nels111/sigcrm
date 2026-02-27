/**
 * Import Contracts from Regular Hours Sheet 2025
 *
 * Imports 27 active contracts from the hours spreadsheet into the CRM.
 * Matches to existing accounts and won deals where possible.
 *
 * Usage:
 *   npx tsx scripts/import-contracts.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Site type mapping: spreadsheet type → Prisma SiteType enum
// ---------------------------------------------------------------------------

function mapSiteType(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const mapping: Record<string, string> = {
    office: "OfficeCommercial",
    communals: "OfficeCommercial",
    hmo: "OfficeCommercial",
    "welfare & show homes": "WelfareConstruction",
    welfare: "WelfareConstruction",
    restaurant: "HospitalityVenue",
    school: "EducationInstitutional",
  };
  return mapping[lower] || "OfficeCommercial";
}

// ---------------------------------------------------------------------------
// Account name matching: spreadsheet name → likely account name in DB
// ---------------------------------------------------------------------------

const ACCOUNT_ALIASES: Record<string, string[]> = {
  "Smarts": ["Smart Property Group", "Smarts", "Smart Property"],
  "St Peters": ["St Peters", "St Peter"],
  "Cresswell": ["Cresswell"],
  "Francis Crt": ["Francis Crt", "Francis Court"],
  "Bredon Crt": ["Bredon Crt", "Bredon Court"],
  "Smtyhen": ["Smtyhen", "Smithen"],
  "83 Alphington": ["83 Alphington", "Alphington"],
  "Coach Hse": ["Coach Hse", "Coach House"],
  "Haven-Waterside": ["Haven-Waterside", "Haven Waterside", "Haven"],
  "River Meadow": ["River Meadow"],
  "Adelaide Crt": ["Adelaide Crt", "Adelaide Court"],
  "Rosemont block 1": ["Rosemont"],
  "Rosemont block 2": ["Rosemont"],
  "Harrington Homes": ["Harrington Homes", "Harrington"],
  "Certas": ["Certas Energy", "Certas"],
  "Backline": ["Backline Logistics", "Backline"],
  "Fika Salon": ["Fika Salon", "Fika"],
  "Dryden": ["Dryden"],
  "Bude": ["Bude"],
  "Porsche KS1": ["Porsche", "Porsche Centre"],
  "Envolve": ["Envolve"],
  "Crave": ["Crave"],
  "Porsche Showroom": ["Porsche", "Porsche Centre", "Porsche Showroom"],
  "Ryders": ["Ryders", "Ryder"],
  "Bott": ["Bott"],
  "DASH": ["DASH", "Dash"],
  "Tolchards": ["Tolchards", "Tolchard"],
};

// Deal names that should be linked to contracts
const DEAL_MATCH_NAMES: Record<string, string[]> = {
  "Harrington Homes": ["Harrington"],
  "Certas": ["Certas"],
  "Porsche Showroom": ["Porsche Showroom", "Porsche"],
  "Porsche KS1": ["Porsche KS1", "Porsche KS"],
  "Ryders": ["Ryders", "Ryder"],
  "Backline": ["Backline"],
  "Bude": ["Bude"],
  "Envolve": ["Envolve"],
  "Crave": ["Crave"],
  "Bott": ["Bott"],
};

// Quotes to skip (orange rows in spreadsheet)
const SKIP_NAMES = new Set([
  "Powderham",
  "Montgomery School",
  "Venn Farm",
  "Think Wealth",
  "Vistry Head office",
  "Theatres",
]);

// ---------------------------------------------------------------------------
// CellType and financial calculation helpers (mirrors contracts API)
// ---------------------------------------------------------------------------

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

async function generateUnitId(cellType: CellType): Promise<string> {
  const existing = await prisma.contract.findMany({
    where: { cellType, deletedAt: null },
    select: { unitId: true },
    orderBy: { unitId: "desc" },
    take: 1,
  });

  let nextNumber = 1;
  if (existing.length > 0 && existing[0].unitId) {
    const parts = existing[0].unitId.split("-");
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) nextNumber = parsed + 1;
    }
  }

  return `${cellType}-${nextNumber.toString().padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Account and Deal resolution
// ---------------------------------------------------------------------------

async function findAccountByName(
  name: string,
  accountCache: Map<string, string>
): Promise<string | null> {
  // Check cache first
  const cached = accountCache.get(name.toLowerCase());
  if (cached) return cached;

  // Try alias lookup
  const aliases = ACCOUNT_ALIASES[name.trim()] || [name.trim()];

  for (const alias of aliases) {
    const account = await prisma.account.findFirst({
      where: {
        name: { contains: alias, mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (account) {
      accountCache.set(name.toLowerCase(), account.id);
      return account.id;
    }
  }

  return null;
}

async function findWonDealByName(name: string): Promise<string | null> {
  const aliases = DEAL_MATCH_NAMES[name.trim()] || [];
  if (aliases.length === 0) return null;

  for (const alias of aliases) {
    const deal = await prisma.deal.findFirst({
      where: {
        name: { contains: alias, mode: "insensitive" },
        stage: { in: ["ClosedWonRecurring", "ClosedWonOneOff"] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (deal) return deal.id;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------

interface SpreadsheetRow {
  name: string;
  typeOfClean: string;
  hoursPerVisit: number;
  visitsPerWeek: number;
  weeklyHours: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  signedTcs: boolean;
  annualValue: number;
  firstAuditDate: Date | null;
}

function parseSpreadsheet(filePath: string): SpreadsheetRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });

  const rows: SpreadsheetRow[] = [];

  // Data starts at row index 3 (0-indexed), ends when we hit an empty name or a skip name
  for (let i = 3; i < raw.length; i++) {
    const row = raw[i];
    const name = String(row[0] || "").trim();

    // Stop at empty rows before the orange section
    if (!name) continue;

    // Skip the orange rows (quotes)
    if (SKIP_NAMES.has(name)) continue;

    const hoursPerVisit = parseFloat(row[2]) || 0;
    const visitsPerWeek = parseFloat(row[3]) || 0;
    const weeklyHours = parseFloat(row[4]) || 0;
    const weeklyRevenue = parseFloat(row[5]) || 0;
    const monthlyRevenue = parseFloat(row[6]) || 0;
    const signedTcs = String(row[7]).toLowerCase().trim() === "yes";
    const annualValue = parseFloat(row[8]) || 0;

    // Parse audit date (Excel serial number)
    let firstAuditDate: Date | null = null;
    if (row[9] && typeof row[9] === "number" && row[9] > 40000) {
      firstAuditDate = XLSX.SSF.parse_date_code(row[9]) as any;
      if (firstAuditDate) {
        const d = XLSX.SSF.parse_date_code(row[9]);
        firstAuditDate = new Date(d.y, d.m - 1, d.d);
      }
    }

    if (weeklyHours === 0 && weeklyRevenue === 0) continue;

    rows.push({
      name,
      typeOfClean: String(row[1] || "").trim(),
      hoursPerVisit,
      visitsPerWeek,
      weeklyHours,
      weeklyRevenue,
      monthlyRevenue,
      signedTcs,
      annualValue,
      firstAuditDate,
    });
  }

  return rows;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Contract Import — Regular Hours Sheet 2025");
  console.log("=".repeat(60));

  // Find the spreadsheet
  const filePath = path.resolve(
    process.env.HOME || "~",
    "Downloads/Regular Hours Sheet 2025 (1).xlsx"
  );
  console.log(`\nReading: ${filePath}\n`);

  const rows = parseSpreadsheet(filePath);
  console.log(`Found ${rows.length} active contract rows to import.\n`);

  // Check for existing contracts to avoid duplicates
  const existingContracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { contractName: true },
  });
  const existingNames = new Set(
    existingContracts.map((c) => c.contractName.toLowerCase())
  );

  const accountCache = new Map<string, string>();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      // Skip if already exists
      if (existingNames.has(row.name.toLowerCase())) {
        console.log(`  SKIP (exists): ${row.name}`);
        skipped++;
        continue;
      }

      // Resolve linked entities
      const accountId = await findAccountByName(row.name, accountCache);
      const dealId = await findWonDealByName(row.name);

      // Calculate derived fields
      const siteType = mapSiteType(row.typeOfClean);
      const cellType = calculateCellType(row.weeklyHours);
      const unitId = await generateUnitId(cellType);
      const auditFrequency = getAuditFrequency(cellType);
      const supervisorHoursAlloc =
        getSupervisorAllocPercent(cellType) * row.weeklyHours;

      // Financial calculations
      const labourRatePerHour = 17;
      const sellRatePerHour =
        row.weeklyHours > 0 ? row.weeklyRevenue / row.weeklyHours : 0;
      const weeklyLabourCost = labourRatePerHour * row.weeklyHours;
      const monthlyLabourCost = weeklyLabourCost * 4.33;
      const grossMarginPercent =
        row.weeklyRevenue > 0
          ? ((row.weeklyRevenue - weeklyLabourCost) / row.weeklyRevenue) * 100
          : 0;

      const contract = await prisma.contract.create({
        data: {
          contractName: row.name,
          unitId,
          cellType: cellType as any,
          status: "active",
          weeklyHours: row.weeklyHours,
          visitsPerWeek: row.visitsPerWeek,
          hoursPerVisit: row.hoursPerVisit,
          siteType: siteType as any,
          sellRatePerHour: parseFloat(sellRatePerHour.toFixed(2)),
          labourRatePerHour,
          weeklyRevenue: parseFloat(row.weeklyRevenue.toFixed(2)),
          monthlyRevenue: parseFloat(row.monthlyRevenue.toFixed(2)),
          annualValue: row.annualValue
            ? parseFloat(row.annualValue.toFixed(2))
            : parseFloat((row.monthlyRevenue * 12).toFixed(2)),
          weeklyLabourCost: parseFloat(weeklyLabourCost.toFixed(2)),
          monthlyLabourCost: parseFloat(monthlyLabourCost.toFixed(2)),
          grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
          supervisorHoursAlloc: parseFloat(supervisorHoursAlloc.toFixed(2)),
          auditFrequency,
          healthStatus: "GREEN",
          signedTcs: row.signedTcs,
          ...(accountId && { accountId }),
          ...(dealId && { dealId }),
        },
      });

      // Create first audit record if audit date provided
      if (row.firstAuditDate) {
        const auditor = await prisma.user.findFirst({
          where: { role: { in: ["admin", "operations"] } },
          select: { id: true },
        });
        if (auditor) {
          await prisma.audit.create({
            data: {
              contractId: contract.id,
              auditorId: auditor.id,
              auditDate: row.firstAuditDate,
              generalStandards: {},
              staffPerformance: {},
              hsCompliance: {},
              overallScore: 0,
              notes: "Imported from hours sheet — first scheduled audit",
            },
          });
        }
      }

      // Log creation activity
      await prisma.activity.create({
        data: {
          activityType: "contract_created",
          subject: `Contract created: ${row.name}`,
          body: `Imported from Regular Hours Sheet 2025. ${row.weeklyHours}h/week, ${formatCurrency(row.monthlyRevenue)}/mo`,
          ...(accountId && { accountId }),
          contractId: contract.id,
        },
      });

      const linkedInfo = [
        accountId ? "account" : null,
        dealId ? "deal" : null,
      ]
        .filter(Boolean)
        .join("+");

      console.log(
        `  CREATED: ${row.name} | ${unitId} | Cell ${cellType} | ${row.weeklyHours}h/wk | ${formatCurrency(row.monthlyRevenue)}/mo | margin: ${grossMarginPercent.toFixed(1)}%${
          linkedInfo ? ` [linked: ${linkedInfo}]` : ""
        }`
      );
      created++;
    } catch (err: any) {
      console.error(`  ERROR: ${row.name}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`  Results: ${created} created, ${skipped} skipped, ${errors} errors`);
  console.log(
    `  Total active contracts in DB: ${created + existingContracts.length}`
  );
  console.log("-".repeat(60));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("\nFATAL:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
