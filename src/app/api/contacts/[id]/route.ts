import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/contacts/[id] — Fetch a single contact with related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            industry: true,
            phone: true,
            website: true,
          },
        },
        deals: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            stage: true,
            amount: true,
            monthlyValue: true,
            dealType: true,
            expectedCloseDate: true,
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performer: {
              select: { id: true, name: true },
            },
          },
        },
        emails: {
          orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
          take: 20,
          select: {
            id: true,
            direction: true,
            fromAddress: true,
            toAddress: true,
            subject: true,
            bodyHtml: true,
            bodyText: true,
            status: true,
            sentAt: true,
            receivedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (contact.deletedAt) {
      return NextResponse.json(
        { error: "Contact has been deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contact });
  } catch (error) {
    console.error("GET /api/contacts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

// PUT /api/contacts/[id] — Update a contact
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check that the contact exists and is not soft-deleted
    const existing = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Cannot update a deleted contact" },
        { status: 400 }
      );
    }

    // If changing accountId, verify the new account exists
    if (body.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: body.accountId },
        select: { id: true, deletedAt: true },
      });

      if (!account) {
        return NextResponse.json(
          { error: "Linked account not found" },
          { status: 400 }
        );
      }

      if (account.deletedAt) {
        return NextResponse.json(
          { error: "Cannot link contact to a deleted account" },
          { status: 400 }
        );
      }
    }

    // Remove fields that should not be directly set via update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, deletedAt: _da, ...updateData } = body;

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: contact });
  } catch (error) {
    console.error("PUT /api/contacts/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Contact not found" },
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
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts/[id] — Soft delete a contact (sets deletedAt)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.contact.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Contact is already deleted" },
        { status: 400 }
      );
    }

    await prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { message: "Contact deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/contacts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
