import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchEmails } from "@/lib/imap-client";
import { getSessionAccount } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const account = await getSessionAccount();
    const emails = await fetchEmails(account, 50);
    let newCount = 0;

    for (const email of emails) {
      const existing = await prisma.email.findFirst({
        where: { uid: email.uid, mailAccount: account },
      });
      if (existing) continue;

      // Auto-map to CRM records by email address
      const contact = await prisma.contact.findFirst({
        where: { email: email.from },
      });
      const lead = !contact
        ? await prisma.lead.findFirst({
            where: { contactEmail: email.from },
          })
        : null;
      const deal = contact
        ? await prisma.deal.findFirst({
            where: { contactId: contact.id },
            orderBy: { createdAt: "desc" },
          })
        : null;

      await prisma.email.create({
        data: {
          uid: email.uid,
          subject: email.subject,
          fromAddress: email.from,
          toAddress: email.to,
          rawFrom: `${email.fromName} <${email.from}>`,
          rawTo: email.to,
          sentAt: email.date,
          direction: "inbound",
          mailAccount: account,
          isRead: email.isRead,
          hasAttachments: email.hasAttachments,
          status: "received",
          contactId: contact?.id ?? null,
          dealId: deal?.id ?? null,
          leadId: lead?.id ?? null,
        },
      });
      newCount++;
    }

    return NextResponse.json({ synced: newCount });
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
