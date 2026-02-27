import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, Industry } from "@prisma/client";

// GET /api/accounts — List accounts with pagination, search, and filters
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
    const where: Prisma.AccountWhereInput = {
      deletedAt: null,
    };

    // Search across name and postcode
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { postcode: { contains: search, mode: "insensitive" } },
        { industry: { equals: search as Industry } },
      ];
    }

    // Filter by industry
    const industry = searchParams.get("industry");
    if (industry) {
      where.industry = industry as Industry;
    }

    // Filter by isProtected
    const isProtected = searchParams.get("isProtected");
    if (isProtected === "true") {
      where.isProtected = true;
    } else if (isProtected === "false") {
      where.isProtected = false;
    }

    // Execute count and findMany in parallel
    const [total, accounts] = await Promise.all([
      prisma.account.count({ where }),
      prisma.account.findMany({
        where,
        include: {
          _count: {
            select: {
              contacts: true,
              deals: true,
              contracts: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/accounts — Create an account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: body,
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

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounts error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid account data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
