import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ActivityType } from "@prisma/client";

// GET /api/activities — List activities with filters and pagination
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

    // Build where clause
    const where: Prisma.ActivityWhereInput = {};

    // Filter by entity type + entity ID to get activities for a specific record
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    if (entityType && entityId) {
      switch (entityType) {
        case "deal":
          where.dealId = entityId;
          break;
        case "lead":
          where.leadId = entityId;
          break;
        case "contact":
          where.contactId = entityId;
          break;
        case "account":
          where.accountId = entityId;
          break;
        case "contract":
          where.contractId = entityId;
          break;
        default:
          return NextResponse.json(
            {
              error:
                "Invalid entityType. Must be one of: deal, lead, contact, account, contract",
            },
            { status: 400 }
          );
      }
    }

    // Filter by activityType
    const activityType = searchParams.get("activityType");
    if (activityType) {
      where.activityType = activityType as ActivityType;
    }

    // Filter by performedBy
    const performedBy = searchParams.get("performedBy");
    if (performedBy) {
      where.performedBy = performedBy;
    }

    // Execute count and findMany in parallel
    const [total, activities] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        include: {
          performer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          deal: {
            select: { id: true, name: true },
          },
          lead: {
            select: { id: true, companyName: true, contactName: true },
          },
          contact: {
            select: { id: true, firstName: true, lastName: true },
          },
          account: {
            select: { id: true, name: true },
          },
          contract: {
            select: { id: true, contractName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/activities error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

// POST /api/activities — Create an activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.activityType) {
      return NextResponse.json(
        { error: "activityType is required" },
        { status: 400 }
      );
    }

    // Build the data object with allowed fields
    const data: Prisma.ActivityCreateInput = {
      activityType: body.activityType,
      subject: body.subject || null,
      body: body.body || null,
      attachments: body.attachments || [],
      metadata: body.metadata || {},
      firefliesMeetingId: body.firefliesMeetingId || null,
      firefliesUrl: body.firefliesUrl || null,
    };

    // Link to entities
    if (body.dealId) {
      data.deal = { connect: { id: body.dealId } };
    }
    if (body.leadId) {
      data.lead = { connect: { id: body.leadId } };
    }
    if (body.contactId) {
      data.contact = { connect: { id: body.contactId } };
    }
    if (body.accountId) {
      data.account = { connect: { id: body.accountId } };
    }
    if (body.contractId) {
      data.contract = { connect: { id: body.contractId } };
    }
    if (body.performedBy) {
      data.performer = { connect: { id: body.performedBy } };
    }

    const activity = await prisma.activity.create({
      data,
      include: {
        performer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        deal: {
          select: { id: true, name: true },
        },
        lead: {
          select: { id: true, companyName: true, contactName: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true },
        },
        account: {
          select: { id: true, name: true },
        },
        contract: {
          select: { id: true, contractName: true },
        },
      },
    });

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (error) {
    console.error("POST /api/activities error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid activity data provided" },
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
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
