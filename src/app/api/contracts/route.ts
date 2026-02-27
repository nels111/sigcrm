import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, CellType, ContractStatus, HealthStatus, SiteType } from "@prisma/client";

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function calculateCellType(visitsPerWeek: number): CellType {
  if (visitsPerWeek <= 15) return "A";
  if (visitsPerWeek <= 30) return "B";
  return "C";
}

function getAuditFrequency(cellType: CellType): string {
  switch (cellType) {
    case "A":
      return "monthly";
    case "B":
      return "fortnightly";
    case "C":
      return "weekly";
  }
}

function getSupervisorAllocPercent(cellType: CellType): number {
  switch (cellType) {
    case "A":
      return 0.1;
    case "B":
      return 0.15;
    case "C":
      return 0.2;
  }
}

async function generateUnitId(cellType: CellType): Promise<string> {
  const existing = await prisma.contract.findMany({
    where: {
      cellType,
      deletedAt: null,
    },
    select: { unitId: true },
    orderBy: { unitId: "desc" },
    take: 1,
  });

  let nextNumber = 1;
  if (existing.length > 0 && existing[0].unitId) {
    const parts = existing[0].unitId.split("-");
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }
  }

  return `${cellType}-${nextNumber.toString().padStart(3, "0")}`;
}

// ──────────────────────────────────────────────
// GET /api/contracts — List with pagination, search, filters
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause — exclude soft-deleted
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
    };

    // Search by contractName or unitId
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { contractName: { contains: search, mode: "insensitive" } },
        { unitId: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by cellType
    const cellType = searchParams.get("cellType");
    if (cellType) {
      where.cellType = cellType as CellType;
    }

    // Filter by status
    const status = searchParams.get("status");
    if (status) {
      where.status = status as ContractStatus;
    }

    // Filter by healthStatus
    const healthStatus = searchParams.get("healthStatus");
    if (healthStatus) {
      where.healthStatus = healthStatus as HealthStatus;
    }

    // Filter by subcontractorId
    const subcontractorId = searchParams.get("subcontractorId");
    if (subcontractorId) {
      where.subcontractorId = subcontractorId;
    }

    // Filter by siteType
    const siteType = searchParams.get("siteType");
    if (siteType) {
      where.siteType = siteType as SiteType;
    }

    // Execute count and findMany in parallel
    const [total, contracts] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        include: {
          account: {
            select: { id: true, name: true },
          },
          deal: {
            select: { id: true, name: true, stage: true },
          },
          quote: {
            select: { id: true, quoteRef: true, status: true },
          },
          subcontractor: {
            select: { id: true, contactName: true, companyName: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/contracts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contracts" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/contracts — Create manually
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.contractName) {
      return NextResponse.json(
        { error: "contractName is required" },
        { status: 400 }
      );
    }

    if (!body.weeklyHours || !body.visitsPerWeek || !body.hoursPerVisit) {
      return NextResponse.json(
        { error: "weeklyHours, visitsPerWeek, and hoursPerVisit are required" },
        { status: 400 }
      );
    }

    if (!body.siteType) {
      return NextResponse.json(
        { error: "siteType is required" },
        { status: 400 }
      );
    }

    if (!body.sellRatePerHour) {
      return NextResponse.json(
        { error: "sellRatePerHour is required" },
        { status: 400 }
      );
    }

    const weeklyHours = parseFloat(body.weeklyHours);
    const visitsPerWeek = parseInt(body.visitsPerWeek, 10);
    const sellRatePerHour = parseFloat(body.sellRatePerHour);
    const labourRatePerHour = body.labourRatePerHour
      ? parseFloat(body.labourRatePerHour)
      : 17;

    // Auto-calculate cellType from visitsPerWeek
    const cellType = calculateCellType(visitsPerWeek);
    const unitId = await generateUnitId(cellType);
    const auditFrequency = getAuditFrequency(cellType);
    const supervisorHoursAlloc =
      getSupervisorAllocPercent(cellType) * weeklyHours;

    // Financial calculations
    const weeklyRevenue = body.weeklyRevenue
      ? parseFloat(body.weeklyRevenue)
      : sellRatePerHour * weeklyHours;
    const monthlyRevenue = body.monthlyRevenue
      ? parseFloat(body.monthlyRevenue)
      : weeklyRevenue * 4.33;
    const annualValue = body.annualValue
      ? parseFloat(body.annualValue)
      : monthlyRevenue * 12;
    const weeklyLabourCost = body.weeklyLabourCost
      ? parseFloat(body.weeklyLabourCost)
      : labourRatePerHour * weeklyHours;
    const monthlyLabourCost = weeklyLabourCost * 4.33;
    const grossMarginPercent =
      weeklyRevenue > 0
        ? ((weeklyRevenue - weeklyLabourCost) / weeklyRevenue) * 100
        : 0;

    const contract = await prisma.contract.create({
      data: {
        contractName: body.contractName,
        unitId,
        cellType,
        status: body.status || "mobilising",
        weeklyHours,
        visitsPerWeek,
        hoursPerVisit: parseFloat(body.hoursPerVisit),
        daysSelected: body.daysSelected || [],
        siteType: body.siteType,
        sellRatePerHour: parseFloat(sellRatePerHour.toFixed(2)),
        labourRatePerHour,
        weeklyRevenue: parseFloat(weeklyRevenue.toFixed(2)),
        monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
        annualValue: parseFloat(annualValue.toFixed(2)),
        weeklyLabourCost: parseFloat(weeklyLabourCost.toFixed(2)),
        monthlyLabourCost: parseFloat(monthlyLabourCost.toFixed(2)),
        grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
        supervisorHoursAlloc: parseFloat(supervisorHoursAlloc.toFixed(2)),
        auditFrequency,
        healthStatus: "GREEN",
        // Optional linked entities
        ...(body.dealId && { dealId: body.dealId }),
        ...(body.accountId && { accountId: body.accountId }),
        ...(body.quoteId && { quoteId: body.quoteId }),
        ...(body.subcontractorId && { subcontractorId: body.subcontractorId }),
        // Optional dates
        ...(body.startDate && { startDate: new Date(body.startDate) }),
        ...(body.endDate && { endDate: new Date(body.endDate) }),
        ...(body.renewalDate && { renewalDate: new Date(body.renewalDate) }),
        // Optional fields
        ...(body.teamLead && { teamLead: body.teamLead }),
        ...(body.noticePeriodDays != null && {
          noticePeriodDays: parseInt(body.noticePeriodDays, 10),
        }),
        ...(body.notes && { notes: body.notes }),
        ...(body.consumablesPercent != null && {
          consumablesPercent: parseFloat(body.consumablesPercent),
        }),
        // Pilot pricing
        ...(body.isPilot != null && { isPilot: body.isPilot }),
        ...(body.pilotEndDate && {
          pilotEndDate: new Date(body.pilotEndDate),
        }),
        ...(body.pilotMonthlyRate != null && {
          pilotMonthlyRate: parseFloat(body.pilotMonthlyRate),
        }),
        ...(body.standardMonthlyRate != null && {
          standardMonthlyRate: parseFloat(body.standardMonthlyRate),
        }),
      },
      include: {
        account: {
          select: { id: true, name: true },
        },
        deal: {
          select: { id: true, name: true },
        },
        quote: {
          select: { id: true, quoteRef: true },
        },
        subcontractor: {
          select: { id: true, contactName: true, companyName: true },
        },
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch (error) {
    console.error("POST /api/contracts error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid contract data provided" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "One or more linked records not found" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create contract" },
      { status: 500 }
    );
  }
}
