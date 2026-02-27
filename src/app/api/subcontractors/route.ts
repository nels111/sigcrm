import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, SubcontractorStatus } from "@prisma/client";

// ── Compliance status helper ────────────────────────────────────────

type ComplianceStatus = "GREEN" | "AMBER" | "RED";

function calculateComplianceStatus(sub: {
  insuranceExpiry: Date | null;
  dbsExpiry: Date | null;
  subcontractorAgreementSigned: boolean;
}): ComplianceStatus {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Check for expired documents or missing agreement -> RED
  if (sub.insuranceExpiry && sub.insuranceExpiry < now) return "RED";
  if (sub.dbsExpiry && sub.dbsExpiry < now) return "RED";
  if (!sub.subcontractorAgreementSigned) return "RED";

  // Check for documents expiring within 30 days -> AMBER
  if (sub.insuranceExpiry && sub.insuranceExpiry < thirtyDaysFromNow) return "AMBER";
  if (sub.dbsExpiry && sub.dbsExpiry < thirtyDaysFromNow) return "AMBER";

  return "GREEN";
}

// ── GET /api/subcontractors ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.SubcontractorWhereInput = {};

    const status = searchParams.get("status");
    if (status) {
      where.status = status as SubcontractorStatus;
    }

    const region = searchParams.get("region");
    if (region) {
      where.regions = { has: region };
    }

    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { contactName: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, subcontractors] = await Promise.all([
      prisma.subcontractor.count({ where }),
      prisma.subcontractor.findMany({
        where,
        include: {
          contracts: {
            where: { deletedAt: null },
            select: {
              id: true,
              contractName: true,
              weeklyHours: true,
              healthStatus: true,
              latestAuditScore: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // Enrich with compliance status, contract count, and total hours
    const enriched = subcontractors.map((sub) => {
      const contractCount = sub.contracts.length;
      const totalHours = sub.contracts.reduce(
        (sum, c) => sum + Number(c.weeklyHours),
        0
      );
      const complianceStatus = calculateComplianceStatus(sub);

      return {
        ...sub,
        contractCount,
        totalWeeklyHoursCalc: totalHours,
        complianceStatus,
      };
    });

    return NextResponse.json({
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/subcontractors error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subcontractors" },
      { status: 500 }
    );
  }
}

// ── POST /api/subcontractors ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.contactName) {
      return NextResponse.json(
        { error: "contactName is required" },
        { status: 400 }
      );
    }
    if (body.hourlyRate == null) {
      return NextResponse.json(
        { error: "hourlyRate is required" },
        { status: 400 }
      );
    }

    const subcontractor = await prisma.subcontractor.create({
      data: {
        contactName: body.contactName,
        companyName: body.companyName ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        hourlyRate: parseFloat(body.hourlyRate),
        supervisorRate: body.supervisorRate
          ? parseFloat(body.supervisorRate)
          : null,
        regions: body.regions ?? [],
        insuranceExpiry: body.insuranceExpiry
          ? new Date(body.insuranceExpiry)
          : null,
        insuranceDocumentPath: body.insuranceDocumentPath ?? null,
        rightToWorkVerified: body.rightToWorkVerified ?? false,
        dbsChecked: body.dbsChecked ?? false,
        dbsExpiry: body.dbsExpiry ? new Date(body.dbsExpiry) : null,
        subcontractorAgreementSigned:
          body.subcontractorAgreementSigned ?? false,
        subcontractorAgreementPath:
          body.subcontractorAgreementPath ?? null,
        performanceScore: body.performanceScore ?? 85.0,
        totalWeeklyHours: body.totalWeeklyHours ?? 0,
        status: body.status ?? "active",
        notes: body.notes ?? null,
      },
      include: {
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            contractName: true,
            weeklyHours: true,
            healthStatus: true,
            latestAuditScore: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ data: subcontractor }, { status: 201 });
  } catch (error) {
    console.error("POST /api/subcontractors error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid subcontractor data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create subcontractor" },
      { status: 500 }
    );
  }
}
