import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/subcontractors/[id] ────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const subcontractor = await prisma.subcontractor.findUnique({
      where: { id },
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
            monthlyRevenue: true,
          },
        },
      },
    });

    if (!subcontractor) {
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 }
      );
    }

    // Fetch audit scores across all sites for this subcontractor
    const contractIds = subcontractor.contracts.map((c) => c.id);
    const auditScores = contractIds.length > 0
      ? await prisma.audit.findMany({
          where: { contractId: { in: contractIds } },
          select: {
            id: true,
            contractId: true,
            auditDate: true,
            overallScore: true,
            contract: {
              select: { id: true, contractName: true },
            },
          },
          orderBy: { auditDate: "desc" },
        })
      : [];

    // Calculate total weekly hours
    const totalWeeklyHours = subcontractor.contracts.reduce(
      (sum, c) => sum + Number(c.weeklyHours),
      0
    );

    return NextResponse.json({
      data: {
        ...subcontractor,
        totalWeeklyHoursCalc: totalWeeklyHours,
        auditScores,
      },
    });
  } catch (error) {
    console.error("GET /api/subcontractors/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subcontractor" },
      { status: 500 }
    );
  }
}

// ── PUT /api/subcontractors/[id] ────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.subcontractor.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 }
      );
    }

    const data: Prisma.SubcontractorUpdateInput = {};

    if (body.contactName !== undefined) data.contactName = body.contactName;
    if (body.companyName !== undefined) data.companyName = body.companyName;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.hourlyRate !== undefined)
      data.hourlyRate = parseFloat(body.hourlyRate);
    if (body.supervisorRate !== undefined)
      data.supervisorRate = body.supervisorRate
        ? parseFloat(body.supervisorRate)
        : null;
    if (body.regions !== undefined) data.regions = body.regions;
    if (body.insuranceExpiry !== undefined)
      data.insuranceExpiry = body.insuranceExpiry
        ? new Date(body.insuranceExpiry)
        : null;
    if (body.insuranceDocumentPath !== undefined)
      data.insuranceDocumentPath = body.insuranceDocumentPath;
    if (body.dbsExpiry !== undefined)
      data.dbsExpiry = body.dbsExpiry ? new Date(body.dbsExpiry) : null;
    if (body.dbsChecked !== undefined) data.dbsChecked = body.dbsChecked;
    if (body.rightToWorkVerified !== undefined)
      data.rightToWorkVerified = body.rightToWorkVerified;
    if (body.subcontractorAgreementSigned !== undefined)
      data.subcontractorAgreementSigned = body.subcontractorAgreementSigned;
    if (body.subcontractorAgreementPath !== undefined)
      data.subcontractorAgreementPath = body.subcontractorAgreementPath;
    if (body.performanceScore !== undefined)
      data.performanceScore = parseFloat(body.performanceScore);
    if (body.totalWeeklyHours !== undefined)
      data.totalWeeklyHours = parseFloat(body.totalWeeklyHours);
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;

    const subcontractor = await prisma.subcontractor.update({
      where: { id },
      data,
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
            monthlyRevenue: true,
          },
        },
      },
    });

    return NextResponse.json({ data: subcontractor });
  } catch (error) {
    console.error("PUT /api/subcontractors/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Subcontractor not found" },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid update data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update subcontractor" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/subcontractors/[id] ─────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.subcontractor.findUnique({
      where: { id },
      select: { id: true, contracts: { select: { id: true }, where: { deletedAt: null } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Subcontractor not found" },
        { status: 404 }
      );
    }

    // If subcontractor has active contracts, soft delete by setting status to inactive
    if (existing.contracts.length > 0) {
      await prisma.subcontractor.update({
        where: { id },
        data: { status: "inactive" },
      });

      return NextResponse.json(
        { message: "Subcontractor deactivated (has linked contracts)" },
        { status: 200 }
      );
    }

    // Otherwise hard delete
    await prisma.subcontractor.delete({ where: { id } });

    return NextResponse.json(
      { message: "Subcontractor deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/subcontractors/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Subcontractor not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete subcontractor" },
      { status: 500 }
    );
  }
}
