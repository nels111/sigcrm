import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runCadenceEngine } from "@/lib/cadence-engine";

// POST /api/cron/cadence — Manually trigger the cadence engine (admin only)
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
      `[API] Cadence engine manually triggered by ${session.user.email}`
    );

    const result = await runCadenceEngine();

    return NextResponse.json({
      message: "Cadence engine run complete",
      data: result,
    });
  } catch (error) {
    console.error("POST /api/cron/cadence error:", error);
    return NextResponse.json(
      { error: "Failed to run cadence engine" },
      { status: 500 }
    );
  }
}
