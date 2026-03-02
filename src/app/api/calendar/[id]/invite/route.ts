import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/calendar/[id]/invite — Send email invite with .ics attachment
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const recipientEmail = body.email;

    if (!recipientEmail) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        creator: { select: { name: true, email: true, ionosEmail: true } },
        contact: { select: { firstName: true, lastName: true, email: true } },
        account: { select: { name: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate ICS content
    const formatIcsDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const uid = `${event.id}@signature-cleans.co.uk`;
    const dtStart = formatIcsDate(new Date(event.startTime));
    const dtEnd = formatIcsDate(new Date(event.endTime));
    const now = formatIcsDate(new Date());
    const organizer = event.creator?.email || "nick@signature-cleans.co.uk";

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Signature OS//CRM//EN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
      `ORGANIZER;CN=${event.creator?.name || "Signature Cleans"}:mailto:${organizer}`,
      `ATTENDEE;RSVP=TRUE:mailto:${recipientEmail}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const startDate = new Date(event.startTime);
    const dateStr = startDate.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = startDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Send invite email
    const fromUser = event.creator?.ionosEmail?.includes("nelson") ? "nelson" : "nick";
    await sendEmail({
      from: fromUser,
      to: recipientEmail,
      subject: `Meeting Invite: ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
          <h2 style="color: #059669;">Meeting Invitation</h2>
          <p>You've been invited to a meeting:</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Event:</td><td>${event.title}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Date:</td><td>${dateStr}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Time:</td><td>${timeStr}</td></tr>
            ${event.description ? `<tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">Details:</td><td>${event.description}</td></tr>` : ""}
          </table>
          <p>Please find the calendar invite attached.</p>
          <p style="color: #6b7280; font-size: 12px;">— ${event.creator?.name || "Signature Cleans"}</p>
        </div>
      `,
      attachments: [
        {
          filename: "invite.ics",
          content: ics,
          contentType: "text/calendar; method=REQUEST",
        },
      ],
    });

    return NextResponse.json({
      data: { sent: true, email: recipientEmail },
    });
  } catch (error) {
    console.error("POST /api/calendar/[id]/invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 }
    );
  }
}
