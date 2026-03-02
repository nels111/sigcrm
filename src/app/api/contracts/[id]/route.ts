import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, ContractStatus } from "@prisma/client";
import { sendNotificationEmail } from "@/lib/notification-email";

// ──────────────────────────────────────────────
// EXIT CHECKLIST TASKS
// ──────────────────────────────────────────────

const EXIT_CHECKLIST_TASKS = [
  "Serve notice to client",
  "Schedule final clean",
  "Collect site access (keys/fobs/codes)",
  "Retrieve equipment from site",
  "Issue final invoice",
  "Archive site pack",
  "Update CRM status",
  "Conduct internal debrief",
];

type RouteContext = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/contracts/[id] — Full detail with relations
// ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        account: true,
        deal: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        quote: true,
        subcontractor: true,
        audits: {
          orderBy: { auditDate: "desc" },
          take: 10,
          include: {
            auditor: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        issues: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performer: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!contract || contract.deletedAt) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("GET /api/contracts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// PUT /api/contracts/[id] — Update contract
// ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Fetch existing contract
    const existing = await prisma.contract.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    // Check for status transitions
    const newStatus = body.status as ContractStatus | undefined;
    const isTerminating =
      newStatus === "terminated" && existing.status !== "terminated";
    const isActivating =
      newStatus === "active" && existing.status === "mobilising";

    if (isTerminating && !body.exitReason) {
      return NextResponse.json(
        { error: "exitReason is required when terminating a contract" },
        { status: 400 }
      );
    }

    // Build update data — only include fields that were provided
    const updateData: Prisma.ContractUpdateInput = {};

    // Simple string/number fields
    if (body.contractName !== undefined) updateData.contractName = body.contractName;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.teamLead !== undefined) updateData.teamLead = body.teamLead;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.exitReason !== undefined) updateData.exitReason = body.exitReason;
    if (body.exitNotes !== undefined) updateData.exitNotes = body.exitNotes;
    if (body.healthStatus !== undefined) updateData.healthStatus = body.healthStatus;
    if (body.staffingStatus !== undefined) updateData.staffingStatus = body.staffingStatus;
    if (body.onboardingStage !== undefined) updateData.onboardingStage = body.onboardingStage;
    if (body.onboardingComplete !== undefined) updateData.onboardingComplete = body.onboardingComplete;
    if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms;
    if (body.signedTcs !== undefined) updateData.signedTcs = body.signedTcs;
    if (body.auditFrequency !== undefined) updateData.auditFrequency = body.auditFrequency;
    if (body.sitePackPath !== undefined) updateData.sitePackPath = body.sitePackPath;
    if (body.isPilot !== undefined) updateData.isPilot = body.isPilot;

    // Numeric fields
    if (body.weeklyHours !== undefined) updateData.weeklyHours = parseFloat(body.weeklyHours);
    if (body.visitsPerWeek !== undefined) updateData.visitsPerWeek = parseInt(body.visitsPerWeek, 10);
    if (body.hoursPerVisit !== undefined) updateData.hoursPerVisit = parseFloat(body.hoursPerVisit);
    if (body.sellRatePerHour !== undefined) updateData.sellRatePerHour = parseFloat(body.sellRatePerHour);
    if (body.labourRatePerHour !== undefined) updateData.labourRatePerHour = parseFloat(body.labourRatePerHour);
    if (body.weeklyRevenue !== undefined) updateData.weeklyRevenue = parseFloat(body.weeklyRevenue);
    if (body.monthlyRevenue !== undefined) updateData.monthlyRevenue = parseFloat(body.monthlyRevenue);
    if (body.annualValue !== undefined) updateData.annualValue = parseFloat(body.annualValue);
    if (body.weeklyLabourCost !== undefined) updateData.weeklyLabourCost = parseFloat(body.weeklyLabourCost);
    if (body.monthlyLabourCost !== undefined) updateData.monthlyLabourCost = parseFloat(body.monthlyLabourCost);
    if (body.consumablesPercent !== undefined) updateData.consumablesPercent = parseFloat(body.consumablesPercent);
    if (body.grossMarginPercent !== undefined) updateData.grossMarginPercent = parseFloat(body.grossMarginPercent);
    if (body.supervisorHoursAlloc !== undefined) updateData.supervisorHoursAlloc = parseFloat(body.supervisorHoursAlloc);
    if (body.supervisorRate !== undefined) updateData.supervisorRate = parseFloat(body.supervisorRate);
    if (body.noticePeriodDays !== undefined) updateData.noticePeriodDays = parseInt(body.noticePeriodDays, 10);
    if (body.latestAuditScore !== undefined) updateData.latestAuditScore = parseFloat(body.latestAuditScore);
    if (body.previousAuditScore !== undefined) updateData.previousAuditScore = parseFloat(body.previousAuditScore);
    if (body.daysSinceLastContact !== undefined) updateData.daysSinceLastContact = parseInt(body.daysSinceLastContact, 10);
    if (body.complaintCount !== undefined) updateData.complaintCount = parseInt(body.complaintCount, 10);
    if (body.pilotMonthlyRate !== undefined) updateData.pilotMonthlyRate = parseFloat(body.pilotMonthlyRate);
    if (body.standardMonthlyRate !== undefined) updateData.standardMonthlyRate = parseFloat(body.standardMonthlyRate);

    // Date fields
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.renewalDate !== undefined) updateData.renewalDate = body.renewalDate ? new Date(body.renewalDate) : null;
    if (body.nextAuditDate !== undefined) updateData.nextAuditDate = body.nextAuditDate ? new Date(body.nextAuditDate) : null;
    if (body.pilotEndDate !== undefined) updateData.pilotEndDate = body.pilotEndDate ? new Date(body.pilotEndDate) : null;
    if (body.signedTcsDate !== undefined) updateData.signedTcsDate = body.signedTcsDate ? new Date(body.signedTcsDate) : null;

    // Array fields
    if (body.daysSelected !== undefined) updateData.daysSelected = body.daysSelected;

    // Relation fields
    if (body.subcontractorId !== undefined) {
      updateData.subcontractor = body.subcontractorId
        ? { connect: { id: body.subcontractorId } }
        : { disconnect: true };
    }

    // Update the contract
    const contract = await prisma.contract.update({
      where: { id },
      data: updateData,
      include: {
        account: {
          select: { id: true, name: true },
        },
        deal: {
          select: { id: true, name: true },
        },
        quote: {
          select: { id: true, quoteRef: true },
        },
        subcontractor: {
          select: { id: true, contactName: true, companyName: true },
        },
      },
    });

    // If mobilising → active, log activity & notify
    if (isActivating) {
      await prisma.activity.create({
        data: {
          activityType: "contract_created",
          subject: "Contract mobilisation completed",
          body: `Contract "${contract.contractName || existing.contractName}" is now active.`,
          contractId: contract.id,
          accountId: contract.accountId ?? existing.accountId,
          dealId: existing.dealId,
        },
      });

      // Notify both admin and sales users
      const usersToNotify = await prisma.user.findMany({
        where: { role: { in: ["admin", "sales"] } },
        select: { id: true },
      });
      if (usersToNotify.length > 0) {
        const notifTitle = "Contract Now Active";
        const notifMessage = `"${contract.contractName || existing.contractName}" has completed mobilisation and is now active.`;
        const notifLink = `/contracts/${contract.id}`;
        await prisma.notification.createMany({
          data: usersToNotify.map((u) => ({
            userId: u.id,
            title: notifTitle,
            message: notifMessage,
            notificationType: "deal_won" as const,
            linkUrl: notifLink,
            entityType: "contract",
            entityId: contract.id,
          })),
        });
        // Send email to each user (best-effort)
        for (const u of usersToNotify) {
          sendNotificationEmail(u.id, notifTitle, notifMessage, notifLink).catch(() => {});
        }
      }
    }

    // If terminated, create exit checklist tasks
    if (isTerminating) {
      const adminUser = await prisma.user.findFirst({
        where: { role: "admin" },
      });

      if (adminUser) {
        const now = new Date();
        const exitTaskData = EXIT_CHECKLIST_TASKS.map((title, index) => ({
          title,
          assignedTo: adminUser.id,
          createdBy: adminUser.id,
          contractId: contract.id,
          accountId: contract.accountId,
          priority: "high" as const,
          autoGenerated: true,
          sourceWorkflow: "contract_exit",
          // Stagger due dates: first 4 tasks within first week, last 4 within second week
          dueDate: new Date(
            now.getTime() + (index < 4 ? 7 : 14) * 24 * 60 * 60 * 1000
          ),
        }));

        await prisma.task.createMany({
          data: exitTaskData,
        });
      }
    }

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("PUT /api/contracts/[id] error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid contract data provided" },
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
      { error: "Failed to update contract" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// DELETE /api/contracts/[id] — Soft delete
// ──────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existing = await prisma.contract.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    await prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "Contract deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/contracts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete contract" },
      { status: 500 }
    );
  }
}
