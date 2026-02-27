import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── Scoring helpers (shared with parent route) ──────────────────────

interface GeneralStandards {
  reception: number;
  offices: number;
  toilets: number;
  kitchen: number;
  corridors: number;
  stairs: number;
  meetingRooms: number;
  external: number;
  specialistAreas: number;
  overallImpression: number;
}

interface StaffPerformance {
  punctuality: number;
  uniformCompliance: number;
  checklistAdherence: number;
  communication: number;
  initiative: number;
}

interface HsCompliance {
  ppeWorn: number;
  wetFloorSigns: number;
  coshhSheets: number;
  equipmentCondition: number;
  incidentReporting: number;
}

const GENERAL_STANDARDS_KEYS: (keyof GeneralStandards)[] = [
  "reception", "offices", "toilets", "kitchen", "corridors",
  "stairs", "meetingRooms", "external", "specialistAreas", "overallImpression",
];

const STAFF_PERFORMANCE_KEYS: (keyof StaffPerformance)[] = [
  "punctuality", "uniformCompliance", "checklistAdherence", "communication", "initiative",
];

const HS_COMPLIANCE_KEYS: (keyof HsCompliance)[] = [
  "ppeWorn", "wetFloorSigns", "coshhSheets", "equipmentCondition", "incidentReporting",
];

function calculateOverallScore(
  gs: GeneralStandards,
  sp: StaffPerformance,
  hs: HsCompliance
): number {
  const allScores = [
    ...GENERAL_STANDARDS_KEYS.map((k) => gs[k]),
    ...STAFF_PERFORMANCE_KEYS.map((k) => sp[k]),
    ...HS_COMPLIANCE_KEYS.map((k) => hs[k]),
  ];
  const avg = allScores.reduce((sum, v) => sum + v, 0) / allScores.length;
  return Math.round(avg * 20 * 10) / 10;
}

// ── GET /api/audits/[id] ───────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const audit = await prisma.audit.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            contractName: true,
            status: true,
            accountId: true,
            subcontractorId: true,
            latestAuditScore: true,
            previousAuditScore: true,
            account: { select: { id: true, name: true } },
          },
        },
        auditor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: audit });
  } catch (error) {
    console.error("GET /api/audits/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit" },
      { status: 500 }
    );
  }
}

// ── PUT /api/audits/[id] ───────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.audit.findUnique({
      where: { id },
      select: {
        id: true,
        generalStandards: true,
        staffPerformance: true,
        hsCompliance: true,
        overallScore: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 }
      );
    }

    // Strip immutable fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...updateData } = body;

    // Recalculate score if any scoring section changed
    if (body.generalStandards || body.staffPerformance || body.hsCompliance) {
      const gs = (body.generalStandards ?? existing.generalStandards) as GeneralStandards;
      const sp = (body.staffPerformance ?? existing.staffPerformance) as StaffPerformance;
      const hs = (body.hsCompliance ?? existing.hsCompliance) as HsCompliance;
      updateData.overallScore = calculateOverallScore(gs, sp, hs);

      // Update follow-up flags based on new score
      if (updateData.overallScore < 70) {
        updateData.requiresFollowUp = true;
        if (!body.followUpDate) {
          updateData.followUpDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        }
      }
    }

    const audit = await prisma.audit.update({
      where: { id },
      data: updateData,
      include: {
        contract: {
          select: {
            id: true,
            contractName: true,
            status: true,
            accountId: true,
            account: { select: { id: true, name: true } },
          },
        },
        auditor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // If score changed, update contract latestAuditScore
    if (updateData.overallScore !== undefined) {
      await prisma.contract.update({
        where: { id: audit.contractId },
        data: { latestAuditScore: updateData.overallScore },
      });
    }

    return NextResponse.json({ data: audit });
  } catch (error) {
    console.error("PUT /api/audits/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Audit not found" },
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
      { error: "Failed to update audit" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/audits/[id] ─────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.audit.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 }
      );
    }

    await prisma.audit.delete({ where: { id } });

    return NextResponse.json(
      { message: "Audit deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/audits/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete audit" },
      { status: 500 }
    );
  }
}
