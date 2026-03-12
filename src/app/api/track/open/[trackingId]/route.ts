import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

type RouteContext = { params: Promise<{ trackingId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { trackingId } = await context.params;

    const email = await prisma.email.findUnique({
      where: { trackingId },
    });

    if (email) {
      await prisma.email.update({
        where: { trackingId },
        data: {
          openCount: { increment: 1 },
          openedAt: email.openedAt ?? new Date(),
          lastOpenedAt: new Date(),
        },
      });
    }
  } catch {
    // silent fail — never break email rendering
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
