import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cadence/stats — Aggregate cadence analytics
export async function GET() {
  try {
    const [
      activeCount,
      totalLeadsInCadence,
      cadenceEmailsSent,
      cadenceReplies,
      meetingsBooked,
    ] = await Promise.all([
      // Active in cadence
      prisma.lead.count({
        where: { deletedAt: null, cadenceStatus: "ActiveInCadence" },
      }),

      // Total leads ever in cadence (active + paused + completed)
      prisma.lead.count({
        where: {
          deletedAt: null,
          cadenceStatus: {
            notIn: ["NotStarted"],
          },
        },
      }),

      // Total cadence emails sent
      prisma.email.count({
        where: { isCadenceEmail: true, status: "sent" },
      }),

      // Cadence replies (emails that got a reply)
      prisma.email.count({
        where: { isCadenceEmail: true, repliedAt: { not: null } },
      }),

      // Meetings booked from cadence leads
      prisma.lead.count({
        where: {
          deletedAt: null,
          cadenceStatus: "PausedMeeting",
        },
      }),
    ]);

    const replyRate = cadenceEmailsSent > 0
      ? Math.round((cadenceReplies / cadenceEmailsSent) * 100)
      : 0;

    const bookingRate = totalLeadsInCadence > 0
      ? Math.round((meetingsBooked / totalLeadsInCadence) * 100)
      : 0;

    return NextResponse.json({
      data: {
        activeCount,
        totalLeadsInCadence,
        cadenceEmailsSent,
        cadenceReplies,
        replyRate,
        meetingsBooked,
        bookingRate,
      },
    });
  } catch (error) {
    console.error("GET /api/cadence/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cadence stats" },
      { status: 500 }
    );
  }
}
