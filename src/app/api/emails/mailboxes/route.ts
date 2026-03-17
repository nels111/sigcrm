import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessibleMailAccounts } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mailboxes = await getAccessibleMailAccounts();
    return NextResponse.json({ mailboxes });
  } catch (error) {
    console.error("GET /api/emails/mailboxes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mailboxes" },
      { status: 500 }
    );
  }
}
