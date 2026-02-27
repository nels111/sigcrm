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

// Calculate cellType from weeklyHours
function calculateCellType(weeklyHours: number | null | undefined): CellType | null {
  if (weeklyHours == null) return null;
  if (weeklyHours >= 1 && weeklyHours <= 15) return "A";
  if (weeklyHours >= 16 && weeklyHours <= 30) return "B";
  if (weeklyHours >= 31) return "C";
  return null;
}

// GET /api/deals — List deals with pagination, filtering, and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause — exclude soft-deleted
    const where: Prisma.DealWhereInput = {
      deletedAt: null,
    };

    // Search across deal name, account name, contact name
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { account: { name: { contains: search, mode: "insensitive" } } },
        {
          contact: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Filter by stage
    const stage = searchParams.get("stage");
    if (stage) {
      where.stage = stage as DealStage;
    }

    // Filter by dealType
    const dealType = searchParams.get("dealType");
    if (dealType) {
      where.dealType = dealType as Prisma.EnumDealTypeFilter;
    }

    // Filter by assignedTo
    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Execute count and findMany in parallel
    const [total, deals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
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
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}

// POST /api/deals — Create a deal with auto-probability based on stage
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

    // Auto-set probability based on stage
    const stage: DealStage = body.stage || "NewLead";
    const probability = STAGE_PROBABILITY[stage] ?? 5;

    // Auto-calculate cellType from weeklyHours
    const weeklyHours = body.weeklyHours != null ? parseFloat(body.weeklyHours) : null;
    const cellType = calculateCellType(weeklyHours);

    const deal = await prisma.deal.create({
      data: {
        ...body,
        probability,
        cellType: cellType ?? body.cellType ?? undefined,
        stageChangedAt: new Date(),
      },
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

    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/deals error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid deal data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    );
  }
}
