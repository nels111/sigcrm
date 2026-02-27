import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, QuoteStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/quotes/[id] — Full quote detail
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        deal: {
          include: {
            account: {
              select: { id: true, name: true, address: true, city: true, postcode: true, phone: true },
            },
            contact: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        lead: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            contactEmail: true,
            leadStatus: true,
            engagementStage: true,
            leadSource: true,
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, filePath: true, fileUrl: true, createdAt: true },
        },
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error("GET /api/quotes/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// PUT /api/quotes/[id] — Update quote
// ──────────────────────────────────────────────

interface QuoteUpdateBody {
  status?: QuoteStatus;
  followUpCount?: number;
  lastFollowUpAt?: string;
  nextFollowUpAt?: string;
  pdfPath?: string;
  pdfUrl?: string;
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body: QuoteUpdateBody = await request.json();

    const existing = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    const updateData: Prisma.QuoteUpdateInput = {};

    // Handle status transitions
    if (body.status && body.status !== existing.status) {
      updateData.status = body.status;

      if (body.status === "sent") {
        updateData.sentAt = new Date();
      } else if (body.status === "accepted") {
        updateData.acceptedAt = new Date();

        // Update linked deal stage to Negotiation (won) or ClosedWonRecurring
        if (existing.dealId) {
          await prisma.deal.update({
            where: { id: existing.dealId },
            data: {
              stage: "ClosedWonRecurring",
              probability: 100,
              actualCloseDate: new Date(),
              stageChangedAt: new Date(),
            },
          });
        }

        // Update linked lead status
        if (existing.leadId) {
          await prisma.lead.update({
            where: { id: existing.leadId },
            data: {
              leadStatus: "QuoteAccepted",
              engagementStage: "CurrentOngoing",
            },
          });
        }

        // Log activity
        if (existing.dealId) {
          await prisma.activity.create({
            data: {
              activityType: "quote_accepted",
              subject: `Quote ${existing.quoteRef} accepted`,
              body: `${existing.companyName} accepted the quote. Monthly value: \u00a3${existing.monthlyTotal}. Annual value: \u00a3${existing.annualTotal}.`,
              dealId: existing.dealId,
              leadId: existing.leadId,
              metadata: {
                quoteId: existing.id,
                quoteRef: existing.quoteRef,
                monthlyTotal: existing.monthlyTotal.toString(),
                annualTotal: existing.annualTotal.toString(),
              },
            },
          });
        }
      } else if (body.status === "rejected") {
        updateData.rejectedAt = new Date();

        // Update linked deal and lead
        if (existing.dealId) {
          await prisma.deal.update({
            where: { id: existing.dealId },
            data: {
              stage: "ClosedLostRecurring",
              probability: 0,
              lossReason: "Price",
              stageChangedAt: new Date(),
            },
          });
        }

        if (existing.leadId) {
          await prisma.lead.update({
            where: { id: existing.leadId },
            data: { leadStatus: "QuoteRejected" },
          });
        }

        // Log activity
        if (existing.dealId) {
          await prisma.activity.create({
            data: {
              activityType: "quote_rejected",
              subject: `Quote ${existing.quoteRef} rejected`,
              body: `${existing.companyName} rejected the quote (${existing.quoteRef}).`,
              dealId: existing.dealId,
              leadId: existing.leadId,
              metadata: {
                quoteId: existing.id,
                quoteRef: existing.quoteRef,
              },
            },
          });
        }
      }
    }

    // Follow-up tracking fields
    if (body.followUpCount !== undefined) {
      updateData.followUpCount = body.followUpCount;
    }
    if (body.lastFollowUpAt) {
      updateData.lastFollowUpAt = new Date(body.lastFollowUpAt);
    }
    if (body.nextFollowUpAt) {
      updateData.nextFollowUpAt = new Date(body.nextFollowUpAt);
    }

    // PDF fields
    if (body.pdfPath) {
      updateData.pdfPath = body.pdfPath;
    }
    if (body.pdfUrl) {
      updateData.pdfUrl = body.pdfUrl;
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        deal: {
          select: { id: true, name: true, stage: true },
        },
        lead: {
          select: { id: true, companyName: true, leadStatus: true },
        },
      },
    });

    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error("PUT /api/quotes/[id] error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid quote update data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// DELETE /api/quotes/[id] — Delete quote
// ──────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get("hard") === "true";

    const existing = await prisma.quote.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    if (hard) {
      // Hard delete — remove the record entirely
      await prisma.quote.delete({ where: { id } });
      return NextResponse.json({ message: "Quote permanently deleted" });
    }

    // Soft delete — set status to expired (Quote model has no deletedAt, so use status)
    await prisma.quote.update({
      where: { id },
      data: { status: "expired" },
    });

    return NextResponse.json({ message: "Quote marked as expired" });
  } catch (error) {
    console.error("DELETE /api/quotes/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}
