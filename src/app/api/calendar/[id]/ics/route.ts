import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/calendar/[id]/ics — Generate .ics file for event
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        contact: { select: { email: true, firstName: true, lastName: true } },
        account: { select: { name: true } },
        creator: { select: { name: true, email: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const formatIcsDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const uid = `${event.id}@signature-cleans.co.uk`;
    const dtStart = formatIcsDate(new Date(event.startTime));
    const dtEnd = formatIcsDate(new Date(event.endTime));
    const now = formatIcsDate(new Date());

    const summary = event.title.replace(/[,;\\]/g, "\\$&");
    const description = (event.description || "").replace(/\n/g, "\\n").replace(/[,;\\]/g, "\\$&");
    const organizer = event.creator?.email || "nick@signature-cleans.co.uk";
    const organizerName = event.creator?.name || "Signature Cleans";

    let attendee = "";
    if (event.contact?.email) {
      const cn = [event.contact.firstName, event.contact.lastName].filter(Boolean).join(" ");
      attendee = `ATTENDEE;CN=${cn};RSVP=TRUE:mailto:${event.contact.email}\r\n`;
    }

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Signature OS//CRM//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `ORGANIZER;CN=${organizerName}:mailto:${organizer}`,
      attendee,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.title.replace(/[^a-zA-Z0-9 ]/g, "")}.ics"`,
      },
    });
  } catch (error) {
    console.error("GET /api/calendar/[id]/ics error:", error);
    return NextResponse.json({ error: "Failed to generate ICS" }, { status: 500 });
  }
}
