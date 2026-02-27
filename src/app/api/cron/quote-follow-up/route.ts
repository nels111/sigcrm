import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runQuoteFollowUp } from "@/lib/quote-follow-up";

// POST /api/cron/quote-follow-up — Manually trigger the quote follow-up engine (admin only)
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    console.log(
      `[API] Quote follow-up engine manually triggered by ${session.user.email}`
    );

    const result = await runQuoteFollowUp();

    return NextResponse.json({
      message: "Quote follow-up engine run complete",
      data: result,
    });
  } catch (error) {
    console.error("POST /api/cron/quote-follow-up error:", error);
    return NextResponse.json(
      { error: "Failed to run quote follow-up engine" },
      { status: 500 }
    );
  }
}
