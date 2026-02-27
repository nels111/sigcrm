import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, IssueSeverity, IssueCategory, IssueStatus } from "@prisma/client";

// ── SLA target helpers ──────────────────────────────────────────────

function getEndOfBusinessToday(): Date {
  const now = new Date();
  const eob = new Date(now);
  eob.setHours(17, 0, 0, 0); // 5 PM today
  // If already past 5 PM, use tomorrow 5 PM
  if (now >= eob) {
    eob.setDate(eob.getDate() + 1);
  }
  return eob;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

function calculateSlaTargets(
  severity: IssueSeverity,
  reportedAt: Date
): { slaResponseTarget: Date; slaResolutionTarget: Date } {
  switch (severity) {
    case "critical":
      return {
        slaResponseTarget: new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000),
        slaResolutionTarget: new Date(reportedAt.getTime() + 4 * 60 * 60 * 1000),
      };
    case "high":
      return {
        slaResponseTarget: new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000),
        slaResolutionTarget: getEndOfBusinessToday(),
      };
    case "medium":
      return {
        slaResponseTarget: new Date(reportedAt.getTime() + 4 * 60 * 60 * 1000),
        slaResolutionTarget: new Date(reportedAt.getTime() + 24 * 60 * 60 * 1000),
      };
    case "low":
      return {
        slaResponseTarget: addBusinessDays(reportedAt, 1),
        slaResolutionTarget: addBusinessDays(reportedAt, 2),
      };
  }
}

// ── GET /api/issues ─────────────────────────────────────────────────

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
    const where: Prisma.IssueWhereInput = {};

    const contractId = searchParams.get("contractId");
    if (contractId) {
      where.contractId = contractId;
    }

    const accountId = searchParams.get("accountId");
    if (accountId) {
      where.accountId = accountId;
    }

    const severity = searchParams.get("severity");
    if (severity) {
      where.severity = severity as IssueSeverity;
    }

    const category = searchParams.get("category");
    if (category) {
      where.category = category as IssueCategory;
    }

    const status = searchParams.get("status");
    if (status) {
      where.status = status as IssueStatus;
    }

    const slaBreached = searchParams.get("slaBreached");
    if (slaBreached === "true") {
      where.slaBreached = true;
    } else if (slaBreached === "false") {
      where.slaBreached = false;
    }

    const assignedTo = searchParams.get("assignedTo");
    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    const [total, issues] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.findMany({
        where,
        include: {
          contract: {
            select: { id: true, contractName: true },
          },
          account: {
            select: { id: true, name: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { reportedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: issues,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/issues error:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}

// ── POST /api/issues ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.contractId) {
      return NextResponse.json(
        { error: "contractId is required" },
        { status: 400 }
      );
    }
    if (!body.severity) {
      return NextResponse.json(
        { error: "severity is required" },
        { status: 400 }
      );
    }
    if (!body.title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }
    if (!body.description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    const reportedAt = body.reportedAt ? new Date(body.reportedAt) : new Date();
    const { slaResponseTarget, slaResolutionTarget } = calculateSlaTargets(
      body.severity as IssueSeverity,
      reportedAt
    );

    // Look up the contract to get accountId
    const contract = await prisma.contract.findUnique({
      where: { id: body.contractId },
      select: { id: true, contractName: true, accountId: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 400 }
      );
    }

    const issue = await prisma.issue.create({
      data: {
        contractId: body.contractId,
        accountId: body.accountId ?? contract.accountId,
        reportedBy: body.reportedBy ?? null,
        severity: body.severity as IssueSeverity,
        category: body.category ? (body.category as IssueCategory) : null,
        title: body.title,
        description: body.description,
        reportedAt,
        slaResponseTarget,
        slaResolutionTarget,
        assignedTo: body.assignedTo ?? null,
        status: "open",
        rootCause: body.rootCause ?? null,
        resolution: body.resolution ?? null,
      },
      include: {
        contract: {
          select: { id: true, contractName: true },
        },
        account: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Find admin user (Nels) for notifications
    const adminUser = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true },
    });

    const sideEffects: Promise<unknown>[] = [];

    // Create task: "Respond to issue: {title}" for assigned user
    if (body.assignedTo && adminUser) {
      sideEffects.push(
        prisma.task.create({
          data: {
            title: `Respond to issue: ${body.title}`,
            description: `SLA response target: ${slaResponseTarget.toISOString()}. Severity: ${body.severity}.`,
            assignedTo: body.assignedTo,
            createdBy: adminUser.id,
            priority: body.severity === "critical" || body.severity === "high" ? "urgent" : "medium",
            contractId: body.contractId,
            dueDate: slaResponseTarget,
            autoGenerated: true,
            sourceWorkflow: "issue_response",
          },
        })
      );
    }

    // Create notification for Nels
    if (adminUser) {
      sideEffects.push(
        prisma.notification.create({
          data: {
            userId: adminUser.id,
            title: `New issue: ${body.title}`,
            message: `${body.severity.toUpperCase()} severity issue raised on ${contract.contractName}. SLA response by ${slaResponseTarget.toISOString()}.`,
            notificationType: "issue_raised",
            linkUrl: `/issues/${issue.id}`,
            entityType: "issue",
            entityId: issue.id,
          },
        })
      );
    }

    // Create activity on contract
    sideEffects.push(
      prisma.activity.create({
        data: {
          activityType: "note",
          subject: `Issue raised: ${body.title} (${body.severity})`,
          body: body.description,
          contractId: body.contractId,
          accountId: body.accountId ?? contract.accountId,
        },
      })
    );

    // Increment complaint count on contract
    sideEffects.push(
      prisma.contract.update({
        where: { id: body.contractId },
        data: { complaintCount: { increment: 1 } },
      })
    );

    await Promise.all(sideEffects);

    return NextResponse.json({ data: issue }, { status: 201 });
  } catch (error) {
    console.error("POST /api/issues error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid issue data provided" },
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
      { error: "Failed to create issue" },
      { status: 500 }
    );
  }
}
