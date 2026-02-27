import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ── Scoring helpers ─────────────────────────────────────────────────

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

interface ActionItem {
  description: string;
  assignedTo: string | null;
  dueDate: string;
  completed: boolean;
}

const GENERAL_STANDARDS_KEYS: (keyof GeneralStandards)[] = [
  "reception",
  "offices",
  "toilets",
  "kitchen",
  "corridors",
  "stairs",
  "meetingRooms",
  "external",
  "specialistAreas",
  "overallImpression",
];

const STAFF_PERFORMANCE_KEYS: (keyof StaffPerformance)[] = [
  "punctuality",
  "uniformCompliance",
  "checklistAdherence",
  "communication",
  "initiative",
];

const HS_COMPLIANCE_KEYS: (keyof HsCompliance)[] = [
  "ppeWorn",
  "wetFloorSigns",
  "coshhSheets",
  "equipmentCondition",
  "incidentReporting",
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
  return Math.round(avg * 20 * 10) / 10; // scale 1-5 => 0-100, 1 decimal
}

function buildActionItems(
  gs: GeneralStandards,
  sp: StaffPerformance,
  hs: HsCompliance
): ActionItem[] {
  const items: ActionItem[] = [];
  const dueDateStr = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  for (const key of GENERAL_STANDARDS_KEYS) {
    if (gs[key] < 3) {
      items.push({
        description: `Improve general standards: ${key}`,
        assignedTo: null,
        dueDate: dueDateStr,
        completed: false,
      });
    }
  }

  for (const key of STAFF_PERFORMANCE_KEYS) {
    if (sp[key] < 3) {
      items.push({
        description: `Improve staff performance: ${key}`,
        assignedTo: null,
        dueDate: dueDateStr,
        completed: false,
      });
    }
  }

  for (const key of HS_COMPLIANCE_KEYS) {
    if (hs[key] < 3) {
      items.push({
        description: `Improve H&S compliance: ${key}`,
        assignedTo: null,
        dueDate: dueDateStr,
        completed: false,
      });
    }
  }

  return items;
}

// ── GET /api/audits ─────────────────────────────────────────────────

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
    const where: Prisma.AuditWhereInput = {};

    const contractId = searchParams.get("contractId");
    if (contractId) {
      where.contractId = contractId;
    }

    const auditorId = searchParams.get("auditorId");
    if (auditorId) {
      where.auditorId = auditorId;
    }

    // Date range filter
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (dateFrom || dateTo) {
      where.auditDate = {};
      if (dateFrom) {
        where.auditDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.auditDate.lte = new Date(dateTo);
      }
    }

    // Score range filter
    const minScore = searchParams.get("minScore");
    const maxScore = searchParams.get("maxScore");
    if (minScore || maxScore) {
      where.overallScore = {};
      if (minScore) {
        where.overallScore.gte = parseFloat(minScore);
      }
      if (maxScore) {
        where.overallScore.lte = parseFloat(maxScore);
      }
    }

    const [total, audits] = await Promise.all([
      prisma.audit.count({ where }),
      prisma.audit.findMany({
        where,
        include: {
          contract: {
            select: {
              id: true,
              contractName: true,
              accountId: true,
              account: { select: { id: true, name: true } },
            },
          },
          auditor: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { auditDate: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: audits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/audits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audits" },
      { status: 500 }
    );
  }
}

// ── POST /api/audits ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.contractId) {
      return NextResponse.json(
        { error: "contractId is required" },
        { status: 400 }
      );
    }
    if (!body.auditorId) {
      return NextResponse.json(
        { error: "auditorId is required" },
        { status: 400 }
      );
    }
    if (!body.generalStandards || !body.staffPerformance || !body.hsCompliance) {
      return NextResponse.json(
        { error: "generalStandards, staffPerformance, and hsCompliance are required" },
        { status: 400 }
      );
    }

    const gs = body.generalStandards as GeneralStandards;
    const sp = body.staffPerformance as StaffPerformance;
    const hs = body.hsCompliance as HsCompliance;

    // 1. Calculate overall score
    const overallScore = calculateOverallScore(gs, sp, hs);

    // 2. Auto-generate action items for areas scored below 3
    const actionItems = buildActionItems(gs, sp, hs);

    // Determine follow-up requirements
    const requiresFollowUp = overallScore < 70;
    const followUpDate = requiresFollowUp
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : null;

    // Create the audit
    const audit = await prisma.audit.create({
      data: {
        contractId: body.contractId,
        auditorId: body.auditorId,
        auditDate: new Date(body.auditDate || new Date()),
        generalStandards: gs as unknown as Prisma.InputJsonValue,
        staffPerformance: sp as unknown as Prisma.InputJsonValue,
        hsCompliance: hs as unknown as Prisma.InputJsonValue,
        overallScore,
        clientSatisfactionScore: body.clientSatisfactionScore ?? null,
        clientFeedback: body.clientFeedback ?? null,
        photos: body.photos ?? [],
        actionItems: actionItems as unknown as Prisma.InputJsonValue,
        requiresFollowUp,
        followUpDate,
        notes: body.notes ?? null,
      },
      include: {
        contract: {
          select: {
            id: true,
            contractName: true,
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

    // ── Post-creation side effects (run in parallel where possible) ──

    const contract = audit.contract;
    const previousScore = Number(contract.latestAuditScore);

    // 3. Update contract.latestAuditScore and contract.previousAuditScore
    await prisma.contract.update({
      where: { id: body.contractId },
      data: {
        previousAuditScore: contract.latestAuditScore,
        latestAuditScore: overallScore,
      },
    });

    // Find admin user (Nels) for task assignment
    const adminUser = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });

    const sideEffects: Promise<unknown>[] = [];

    // 4. If score < 70: create task for Nels, mark follow-up required
    if (overallScore < 70 && adminUser) {
      sideEffects.push(
        prisma.task.create({
          data: {
            title: `Action plan required: ${contract.contractName}`,
            description: `Audit score of ${overallScore}% is below threshold. An action plan is required.`,
            assignedTo: adminUser.id,
            createdBy: audit.auditorId,
            priority: "high",
            contractId: body.contractId,
            dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
            autoGenerated: true,
            sourceWorkflow: "audit_low_score",
          },
        })
      );
    }

    // 5. If 2 consecutive audits < 80: create high-priority intervention task
    if (overallScore < 80 && previousScore < 80 && adminUser) {
      sideEffects.push(
        prisma.task.create({
          data: {
            title: `Intervention required: ${contract.contractName}`,
            description: `Two consecutive audits scored below 80% (current: ${overallScore}%, previous: ${previousScore}%). Immediate intervention required.`,
            assignedTo: adminUser.id,
            createdBy: audit.auditorId,
            priority: "urgent",
            contractId: body.contractId,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            autoGenerated: true,
            sourceWorkflow: "audit_consecutive_low",
          },
        })
      );
    }

    // 6. Update subcontractor performanceScore (average across all their audited sites)
    if (contract.subcontractorId) {
      sideEffects.push(
        (async () => {
          // Get all contract IDs for this subcontractor
          const subContracts = await prisma.contract.findMany({
            where: { subcontractorId: contract.subcontractorId },
            select: { id: true },
          });
          const contractIds = subContracts.map((c) => c.id);

          // Average the latest audit score across all those contracts
          const avgResult = await prisma.audit.aggregate({
            where: { contractId: { in: contractIds } },
            _avg: { overallScore: true },
          });

          if (avgResult._avg.overallScore !== null) {
            await prisma.subcontractor.update({
              where: { id: contract.subcontractorId! },
              data: {
                performanceScore: Number(avgResult._avg.overallScore),
              },
            });
          }
        })()
      );
    }

    // 7. Create activity on contract: "Audit completed — Score: {score}%"
    sideEffects.push(
      prisma.activity.create({
        data: {
          activityType: "audit_completed",
          subject: `Audit completed — Score: ${overallScore}%`,
          body: body.notes || null,
          contractId: body.contractId,
          accountId: contract.accountId,
          performedBy: audit.auditorId,
        },
      })
    );

    await Promise.all(sideEffects);

    return NextResponse.json({ data: audit }, { status: 201 });
  } catch (error) {
    console.error("POST /api/audits error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid audit data provided" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "One or more linked records not found (e.g. contract, auditor)" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create audit" },
      { status: 500 }
    );
  }
}
