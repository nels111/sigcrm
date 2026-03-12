import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pollEmails } from "@/lib/imap-poller";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const synced = await pollEmails();
    return NextResponse.json({ synced });
  } catch (error) {
    console.error("POST /api/emails/sync error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync emails",
      },
      { status: 500 }
    );
  }
}
