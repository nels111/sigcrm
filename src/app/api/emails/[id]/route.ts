import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getSessionAccount } from "@/lib/auth-helpers";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/emails/[id] — Get a single email with full relations
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        deal: {
          select: {
            id: true,
            name: true,
            stage: true,
            account: { select: { id: true, name: true } },
          },
        },
        lead: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            contactEmail: true,
          },
        },
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            account: { select: { id: true, name: true } },
          },
        },
        account: {
          select: { id: true, name: true },
        },
      },
    });

    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: email });
  } catch (error) {
    console.error("GET /api/emails/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/emails/[id] — Update email linking (manual link / unlink)
//
// Used by the "Unmatched Emails" feature to manually associate inbound
// emails with a deal, lead, contact, or account.
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Verify the email exists
    const existing = await prisma.email.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Only allow updating linking fields
    const updateData: Prisma.EmailUpdateInput = {};

    // dealId — allow setting or clearing
    if ("dealId" in body) {
      if (body.dealId) {
        updateData.deal = { connect: { id: body.dealId } };
      } else {
        // Disconnect if explicitly set to null
        if (existing.dealId) {
          updateData.deal = { disconnect: true };
        }
      }
    }

    // leadId — allow setting or clearing
    if ("leadId" in body) {
      if (body.leadId) {
        updateData.lead = { connect: { id: body.leadId } };
      } else {
        if (existing.leadId) {
          updateData.lead = { disconnect: true };
        }
      }
    }

    // contactId — allow setting or clearing
    if ("contactId" in body) {
      if (body.contactId) {
        updateData.contact = { connect: { id: body.contactId } };
      } else {
        if (existing.contactId) {
          updateData.contact = { disconnect: true };
        }
      }
    }

    // accountId — allow setting or clearing
    if ("accountId" in body) {
      if (body.accountId) {
        updateData.account = { connect: { id: body.accountId } };
      } else {
        if (existing.accountId) {
          updateData.account = { disconnect: true };
        }
      }
    }

    const email = await prisma.email.update({
      where: { id },
      data: updateData,
      include: {
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true, contactName: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: email });
  } catch (error) {
    console.error("PUT /api/emails/[id] error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid data provided" },
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
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/emails/[id] — Quick update (mark read, link to CRM record)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await getSessionAccount();
    const { id } = await context.params;
    const body = await request.json();

    const email = await prisma.email.findFirst({
      where: { id, mailAccount: account },
    });
    if (!email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.email.update({
      where: { id },
      data: {
        ...(body.isRead !== undefined ? { isRead: body.isRead } : {}),
        ...(body.contactId !== undefined ? { contactId: body.contactId } : {}),
        ...(body.dealId !== undefined ? { dealId: body.dealId } : {}),
        ...(body.leadId !== undefined ? { leadId: body.leadId } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/emails/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}
