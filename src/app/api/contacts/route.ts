import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/contacts — List contacts with pagination, search, and filters
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

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause — exclude soft-deleted
    const where: Prisma.ContactWhereInput = {
      deletedAt: null,
    };

    // Search across firstName, lastName, email
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by accountId
    const accountId = searchParams.get("accountId");
    if (accountId) {
      where.accountId = accountId;
    }

    // Execute count and findMany in parallel
    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: {
          account: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/contacts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// POST /api/contacts — Create a contact (optionally linked to an account)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.lastName) {
      return NextResponse.json(
        { error: "lastName is required" },
        { status: 400 }
      );
    }

    // If accountId is provided, verify the account exists and is not deleted
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

    const contact = await prisma.contact.create({
      data: body,
      include: {
        account: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    console.error("POST /api/contacts error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid contact data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
