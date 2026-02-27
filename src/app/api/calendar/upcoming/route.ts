import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/calendar/upcoming — Upcoming events for sidebar panel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );

    const where: Prisma.CalendarEventWhereInput = {
      startTime: { gt: new Date() },
      status: "scheduled",
    };

    // Filter by userId (createdBy or in attendees array)
    if (userId) {
      where.OR = [
        { createdBy: userId },
        { attendees: { has: userId } },
      ];
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        deal: {
          select: { id: true, name: true },
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
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { startTime: "asc" },
      take: limit,
    });

    return NextResponse.json({ data: events });
  } catch (error) {
    console.error("GET /api/calendar/upcoming error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming events" },
      { status: 500 }
    );
  }
}
