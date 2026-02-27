import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/leads/[id] — Fetch a single lead with related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        convertedAccount: true,
        convertedContact: true,
        convertedDeal: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performer: {
              select: { id: true, name: true },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignee: {
              select: { id: true, name: true },
            },
          },
        },
        quotes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    if (lead.deletedAt) {
      return NextResponse.json(
        { error: "Lead has been deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("GET /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Auto-sync: leadStatus → engagementStage
// ---------------------------------------------------------------------------

const STATUS_TO_ENGAGEMENT: Record<string, string> = {
  NewLead: "ColdProspect",
  Contacted: "WarmProspect",
  IncomingCall: "WarmProspect",
  MeetingBooked: "MeetingBooked",
  MeetingAttended: "MeetingBooked",
  QuoteSent: "Quoted",
  QuoteAccepted: "Negotiating",
  QuoteRejected: "ColdProspect",
  FollowUpSent: "WarmProspect",
  PreviousCustomer: "WorkCeased",
  OngoingCustomer: "CurrentOngoing",
};

// PUT /api/leads/[id] — Update a lead
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check that the lead exists and is not soft-deleted
    const existing = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, leadStatus: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Cannot update a deleted lead" },
        { status: 400 }
      );
    }

    // Remove fields that should not be directly set via update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, deletedAt: _da, ...updateData } = body;

    // Auto-sync engagementStage when leadStatus changes
    if (
      updateData.leadStatus &&
      updateData.leadStatus !== existing.leadStatus &&
      !updateData.engagementStage
    ) {
      const mapped = STATUS_TO_ENGAGEMENT[updateData.leadStatus];
      if (mapped) {
        updateData.engagementStage = mapped;
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error("PUT /api/leads/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Lead not found" },
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
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] — Soft delete a lead (sets deletedAt)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Lead is already deleted" },
        { status: 400 }
      );
    }

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { message: "Lead deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/leads/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
