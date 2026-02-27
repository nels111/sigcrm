import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/leads — List leads with pagination, filtering, and search
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

    // Build where clause
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
    };

    // Search across company_name, contact_name, contact_email
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    // Enum / field filters
    const leadStatus = searchParams.get("leadStatus");
    if (leadStatus) {
      where.leadStatus = leadStatus as Prisma.EnumLeadStatusFilter;
    }

    const engagementStage = searchParams.get("engagementStage");
    if (engagementStage) {
      where.engagementStage = engagementStage as Prisma.EnumEngagementStageFilter;
    }

    const cadenceStatus = searchParams.get("cadenceStatus");
    if (cadenceStatus) {
      where.cadenceStatus = cadenceStatus as Prisma.EnumCadenceStatusFilter;
    }

    const leadSource = searchParams.get("leadSource");
    if (leadSource) {
      where.leadSource = leadSource as Prisma.EnumLeadSourceNullableFilter;
    }

    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Execute count and findMany in parallel
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
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
      data: leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// POST /api/leads — Create a lead with duplicate detection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { force, ...leadData } = body;

    // Validate required fields
    if (!leadData.companyName || !leadData.contactName) {
      return NextResponse.json(
        { error: "companyName and contactName are required" },
        { status: 400 }
      );
    }

    // Duplicate detection: check by contact_email AND company_name (case-insensitive)
    if (!force) {
      const duplicateConditions: Prisma.LeadWhereInput[] = [];

      // Check by email if provided
      if (leadData.contactEmail) {
        duplicateConditions.push({
          contactEmail: {
            equals: leadData.contactEmail,
            mode: "insensitive",
          },
          deletedAt: null,
        });
      }

      // Check by company name
      duplicateConditions.push({
        companyName: {
          equals: leadData.companyName,
          mode: "insensitive",
        },
        deletedAt: null,
      });

      if (duplicateConditions.length > 0) {
        const duplicates = await prisma.lead.findMany({
          where: { OR: duplicateConditions },
          include: {
            assignee: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        if (duplicates.length > 0) {
          return NextResponse.json(
            {
              duplicateFound: true,
              message:
                "Potential duplicate leads found. Set force: true to create anyway.",
              matches: duplicates,
            },
            { status: 409 }
          );
        }
      }
    }

    // Create the lead
    const lead = await prisma.lead.create({
      data: leadData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid lead data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
