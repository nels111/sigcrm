import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DealStage } from "@prisma/client";

// Stage → probability mapping
const STAGE_PROBABILITY: Record<string, number> = {
  NewLead: 5,
  Contacted: 10,
  SiteSurveyBooked: 20,
  SurveyComplete: 30,
  QuoteSent: 40,
  Negotiation: 60,
  ClosedWonRecurring: 100,
  ClosedWonOneOff: 100,
  ClosedLostRecurring: 0,
  ClosedLostOneOff: 0,
};

// Lost stages that require a lossReason
const LOST_STAGES: DealStage[] = [
  "ClosedLostRecurring",
  "ClosedLostOneOff",
];

// Valid DealStage values for validation
const VALID_STAGES = new Set<string>(Object.keys(STAGE_PROBABILITY));

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/deals/[id]/stage — Quick stage update (drag-and-drop)
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { stage, lossReason, lossNotes } = body;

    // Validate stage is provided
    if (!stage) {
      return NextResponse.json(
        { error: "stage is required" },
        { status: 400 }
      );
    }

    // Validate stage is a valid DealStage
    if (!VALID_STAGES.has(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${Array.from(VALID_STAGES).join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch existing deal
    const existing = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    // If same stage, no-op
    if (existing.stage === stage) {
      const unchanged = await prisma.deal.findUnique({
        where: { id },
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      return NextResponse.json({ data: unchanged });
    }

    // Validate lossReason for Lost stages
    if (LOST_STAGES.includes(stage as DealStage)) {
      if (!lossReason) {
        return NextResponse.json(
          { error: "lossReason is required when moving to a Lost stage" },
          { status: 400 }
        );
      }
    }

    // Auto-update probability
    const probability = STAGE_PROBABILITY[stage] ?? existing.probability;
    const now = new Date();

    // Build update data
    const updateData: Record<string, unknown> = {
      stage,
      probability,
      stageChangedAt: now,
    };

    // Set loss fields if moving to Lost
    if (LOST_STAGES.includes(stage as DealStage)) {
      updateData.lossReason = lossReason;
      if (lossNotes) {
        updateData.lossNotes = lossNotes;
      }
    }

    // Set actualCloseDate for Won stages
    if (stage === "ClosedWonRecurring" || stage === "ClosedWonOneOff") {
      updateData.actualCloseDate = now;
    }

    // Use transaction to update deal and create activity record
    const [deal] = await prisma.$transaction([
      prisma.deal.update({
        where: { id },
        data: updateData,
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      prisma.activity.create({
        data: {
          activityType: "deal_stage_change",
          subject: `Stage changed from ${existing.stage} to ${stage}`,
          body: lossReason
            ? `Loss reason: ${lossReason}${lossNotes ? `. Notes: ${lossNotes}` : ""}`
            : null,
          dealId: id,
          accountId: existing.accountId,
          contactId: existing.contactId,
          performedBy: existing.assignedTo,
          metadata: {
            previousStage: existing.stage,
            newStage: stage,
            previousProbability: existing.probability,
            newProbability: probability,
            ...(lossReason && { lossReason }),
            ...(lossNotes && { lossNotes }),
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: deal,
      ...(stage === "ClosedWonRecurring" && { triggerMobilisation: true }),
    });
  } catch (error) {
    console.error("PUT /api/deals/[id]/stage error:", error);
    return NextResponse.json(
      { error: "Failed to update deal stage" },
      { status: 500 }
    );
  }
}
