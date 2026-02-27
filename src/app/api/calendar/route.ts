import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, EventType } from "@prisma/client";

// GET /api/calendar — List calendar events with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Date range filters (required for view rendering)
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate or endDate format" },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Prisma.CalendarEventWhereInput = {
      // Events that overlap with the requested date range
      startTime: { lte: endDateTime },
      endTime: { gte: startDateTime },
    };

    // Filter by userId (createdBy or in attendees array)
    const userId = searchParams.get("userId");
    if (userId) {
      where.OR = [
        { createdBy: userId },
        { attendees: { has: userId } },
      ];
    }

    // Filter by eventType
    const eventType = searchParams.get("eventType");
    if (eventType) {
      where.eventType = eventType as EventType;
    }

    // Filter by linked entities
    const dealId = searchParams.get("dealId");
    if (dealId) {
      where.dealId = dealId;
    }

    const contactId = searchParams.get("contactId");
    if (contactId) {
      where.contactId = contactId;
    }

    const accountId = searchParams.get("accountId");
    if (accountId) {
      where.accountId = accountId;
    }

    const contractId = searchParams.get("contractId");
    if (contractId) {
      where.contractId = contractId;
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        deal: {
          select: { id: true, name: true, stage: true },
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
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ data: events });
  } catch (error) {
    console.error("GET /api/calendar error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}

// POST /api/calendar — Create a calendar event
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

    if (!body.startTime) {
      return NextResponse.json(
        { error: "startTime is required" },
        { status: 400 }
      );
    }

    if (!body.endTime) {
      return NextResponse.json(
        { error: "endTime is required" },
        { status: 400 }
      );
    }

    if (!body.createdBy) {
      return NextResponse.json(
        { error: "createdBy is required" },
        { status: 400 }
      );
    }

    // Validate time ordering
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid startTime or endTime format" },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title: body.title,
        description: body.description,
        startTime,
        endTime,
        allDay: body.allDay ?? false,
        dealId: body.dealId,
        contactId: body.contactId,
        accountId: body.accountId,
        contractId: body.contractId,
        createdBy: body.createdBy,
        attendees: body.attendees ?? [],
        eventType: body.eventType,
        isRecurring: body.isRecurring ?? false,
        recurrenceRule: body.recurrenceRule,
        reminderMinutesBefore: body.reminderMinutesBefore ?? 30,
      },
      include: {
        deal: {
          select: { id: true, name: true, stage: true },
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
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    console.error("POST /api/calendar error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid calendar event data provided" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "One or more linked records not found (e.g. creator, deal)" },
          { status: 400 }
        );
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Foreign key constraint failed — linked record does not exist" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
