import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, DealStage, CellType } from "@prisma/client";

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

// Calculate cellType from weeklyHours
function calculateCellType(weeklyHours: number | null | undefined): CellType | null {
  if (weeklyHours == null) return null;
  if (weeklyHours >= 1 && weeklyHours <= 15) return "A";
  if (weeklyHours >= 16 && weeklyHours <= 30) return "B";
  if (weeklyHours >= 31) return "C";
  return null;
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/deals/[id] — Single deal with full relations
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        account: true,
        contact: true,
        lead: true,
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
        quotes: {
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          orderBy: { createdAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performer: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!deal || deal.deletedAt) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: deal });
  } catch (error) {
    console.error("GET /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deal" },
      { status: 500 }
    );
  }
}

// PUT /api/deals/[id] — Update deal with stage change logic
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Fetch existing deal to detect stage change
    const existing = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    const updateData: Prisma.DealUpdateInput = { ...body };
    let triggerMobilisation = false;

    // Detect stage change
    const newStage = body.stage as DealStage | undefined;
    if (newStage && newStage !== existing.stage) {
      // If moving to a Lost stage, require lossReason
      if (LOST_STAGES.includes(newStage)) {
        if (!body.lossReason) {
          return NextResponse.json(
            { error: "lossReason is required when moving to a Lost stage" },
            { status: 400 }
          );
        }
      }

      // Auto-update probability
      updateData.probability = STAGE_PROBABILITY[newStage] ?? existing.probability;
      updateData.stageChangedAt = new Date();

      // If moving to Closed Won stages, set actualCloseDate
      if (newStage === "ClosedWonRecurring" || newStage === "ClosedWonOneOff") {
        updateData.actualCloseDate = new Date();
      }

      // Flag for mobilisation workflow trigger
      if (newStage === "ClosedWonRecurring") {
        triggerMobilisation = true;
      }
    }

    // Auto-calculate cellType from weeklyHours
    const weeklyHours = body.weeklyHours != null
      ? parseFloat(body.weeklyHours)
      : existing.weeklyHours != null
        ? parseFloat(existing.weeklyHours.toString())
        : null;
    const cellType = calculateCellType(weeklyHours);
    if (cellType) {
      updateData.cellType = cellType;
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      data: deal,
      ...(triggerMobilisation && { triggerMobilisation: true }),
    });
  } catch (error) {
    console.error("PUT /api/deals/[id] error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid deal data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    );
  }
}

// DELETE /api/deals/[id] — Soft delete
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existing = await prisma.deal.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    await prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "Deal deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    );
  }
}
