import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/accounts/[id] — Fetch a single account with related data counts
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { deletedAt: null },
          orderBy: { isPrimary: "desc" },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            mobile: true,
            jobTitle: true,
            isPrimary: true,
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
            assignedTo: true,
          },
        },
        contracts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            contractName: true,
            status: true,
            monthlyRevenue: true,
            annualValue: true,
            startDate: true,
            endDate: true,
            healthStatus: true,
          },
        },
        _count: {
          select: {
            activities: true,
            contacts: true,
            deals: true,
            contracts: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (account.deletedAt) {
      return NextResponse.json(
        { error: "Account has been deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: account });
  } catch (error) {
    console.error("GET /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id] — Update an account
// Protected accounts cannot be updated by non-admin users.
// The `userRole` header is checked here; in production, middleware should
// verify and inject this header from the authenticated session.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check that the account exists and is not soft-deleted
    const existing = await prisma.account.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, isProtected: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Cannot update a deleted account" },
        { status: 400 }
      );
    }

    // Block changes to protected accounts for non-admin roles.
    // The userRole header should be set by auth middleware.
    if (existing.isProtected) {
      const userRole = request.headers.get("userRole") || request.headers.get("x-user-role");
      if (userRole !== "admin") {
        return NextResponse.json(
          { error: "Cannot modify a protected account. Admin role required." },
          { status: 403 }
        );
      }
    }

    // Remove fields that should not be directly set via update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, deletedAt: _da, ...updateData } = body;

    const account = await prisma.account.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            contacts: true,
            deals: true,
            contracts: true,
          },
        },
      },
    });

    return NextResponse.json({ data: account });
  } catch (error) {
    console.error("PUT /api/accounts/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Account not found" },
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
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[id] — Soft delete an account (sets deletedAt)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.account.findUnique({
      where: { id },
      select: { id: true, deletedAt: true, isProtected: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { error: "Account is already deleted" },
        { status: 400 }
      );
    }

    // Prevent deletion of protected accounts by non-admin users
    if (existing.isProtected) {
      const userRole = request.headers.get("userRole") || request.headers.get("x-user-role");
      if (userRole !== "admin") {
        return NextResponse.json(
          { error: "Cannot delete a protected account. Admin role required." },
          { status: 403 }
        );
      }
    }

    await prisma.account.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/accounts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
