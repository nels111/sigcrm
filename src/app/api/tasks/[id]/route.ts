import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id] — Fetch a single task with related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        deal: {
          select: { id: true, name: true, stage: true },
        },
        lead: {
          select: { id: true, companyName: true, contactName: true, leadStatus: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        account: {
          select: { id: true, name: true },
        },
        contract: {
          select: { id: true, contractName: true, status: true },
        },
        subcontractor: {
          select: { id: true, contactName: true, companyName: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PUT /api/tasks/[id] — Update a task (completing sets completedAt)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check that the task exists
    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        completedAt: true,
        title: true,
        description: true,
        assignedTo: true,
        createdBy: true,
        taskType: true,
        priority: true,
        dealId: true,
        leadId: true,
        contactId: true,
        accountId: true,
        contractId: true,
        subcontractorId: true,
        dueDate: true,
        isRecurring: true,
        recurrenceRule: true,
        recurringParentId: true,
        notes: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Remove fields that should not be directly set via update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...updateData } = body;

    // Auto-set completedAt when status changes to completed
    if (
      updateData.status === "completed" &&
      existing.status !== "completed"
    ) {
      updateData.completedAt = new Date();
    }

    // Clear completedAt if status changes away from completed
    if (
      updateData.status &&
      updateData.status !== "completed" &&
      existing.status === "completed"
    ) {
      updateData.completedAt = null;
    }

    // If completing a recurring task, auto-create the next occurrence
    if (
      updateData.status === "completed" &&
      existing.status !== "completed" &&
      existing.isRecurring &&
      existing.recurrenceRule
    ) {
      try {
        const baseDue = existing.dueDate ? new Date(existing.dueDate) : new Date();
        let nextDue: Date;

        switch (existing.recurrenceRule) {
          case "daily":
            nextDue = new Date(baseDue.getTime() + 1 * 24 * 60 * 60 * 1000);
            break;
          case "weekly":
            nextDue = new Date(baseDue.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case "monthly":
            nextDue = new Date(baseDue);
            nextDue.setMonth(nextDue.getMonth() + 1);
            break;
          case "quarterly":
            nextDue = new Date(baseDue);
            nextDue.setMonth(nextDue.getMonth() + 3);
            break;
          default:
            nextDue = new Date(baseDue.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        await prisma.task.create({
          data: {
            title: existing.title,
            description: existing.description,
            assignedTo: existing.assignedTo,
            createdBy: existing.createdBy,
            taskType: existing.taskType,
            priority: existing.priority,
            dealId: existing.dealId,
            leadId: existing.leadId,
            contactId: existing.contactId,
            accountId: existing.accountId,
            contractId: existing.contractId,
            subcontractorId: existing.subcontractorId,
            dueDate: nextDue,
            isRecurring: true,
            recurrenceRule: existing.recurrenceRule,
            recurringParentId: existing.recurringParentId || id,
            notes: existing.notes,
          },
        });
      } catch (recurError) {
        console.error("Failed to create next recurring task occurrence:", recurError);
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
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
          select: { id: true, contractName: true, status: true },
        },
        subcontractor: {
          select: { id: true, contactName: true, companyName: true },
        },
      },
    });

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error("PUT /api/tasks/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Foreign key constraint failed — linked record does not exist" },
          { status: 400 }
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
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] — Delete a task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Task deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
