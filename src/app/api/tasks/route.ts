import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TaskStatus, Priority, TaskType } from "@prisma/client";

// GET /api/tasks — List tasks with filters and pagination
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

    // Build where clause
    const where: Prisma.TaskWhereInput = {};

    // Filter by assignedTo
    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    // Filter by status
    const status = searchParams.get("status");
    if (status) {
      where.status = status as TaskStatus;
    }

    // Filter by priority
    const priority = searchParams.get("priority");
    if (priority) {
      where.priority = priority as Priority;
    }

    // Filter by taskType
    const taskType = searchParams.get("taskType");
    if (taskType) {
      where.taskType = taskType as TaskType;
    }

    // Filter by linked entity
    const dealId = searchParams.get("dealId");
    if (dealId) {
      where.dealId = dealId;
    }

    const leadId = searchParams.get("leadId");
    if (leadId) {
      where.leadId = leadId;
    }

    const contractId = searchParams.get("contractId");
    if (contractId) {
      where.contractId = contractId;
    }

    const accountId = searchParams.get("accountId");
    if (accountId) {
      where.accountId = accountId;
    }

    const contactId = searchParams.get("contactId");
    if (contactId) {
      where.contactId = contactId;
    }

    // Filter by dueDate range
    const dueDateFrom = searchParams.get("dueDateFrom");
    const dueDateTo = searchParams.get("dueDateTo");
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) {
        where.dueDate.gte = new Date(dueDateFrom);
      }
      if (dueDateTo) {
        where.dueDate.lte = new Date(dueDateTo);
      }
    }

    // Filter for overdue tasks (due before now and not completed/cancelled)
    const overdue = searchParams.get("overdue");
    if (overdue === "true") {
      where.dueDate = { lt: new Date() };
      where.status = { in: ["pending", "in_progress"] };
    }

    // Execute count and findMany in parallel
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, name: true },
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
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks — Create a task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    if (!body.assignedTo) {
      return NextResponse.json(
        { error: "assignedTo is required" },
        { status: 400 }
      );
    }

    if (!body.createdBy) {
      return NextResponse.json(
        { error: "createdBy is required" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: body,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true },
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

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid task data provided" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "One or more linked records not found (e.g. assignee, deal)" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
