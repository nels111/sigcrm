import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { EmailDirection, EmailStatus, ActivityType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MailboxAccount {
  alias: "nick" | "nelson";
  email: string;
  password: string;
}

interface ParsedEmail {
  fromAddress: string;
  toAddress: string;
  ccAddresses: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  messageId: string;
  inReplyTo: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
  receivedAt: Date;
  isRead: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMailboxAccounts(): MailboxAccount[] {
  const accounts: MailboxAccount[] = [];

  const nickEmail = process.env.NICK_EMAIL;
  const nickPassword = process.env.NICK_EMAIL_PASSWORD;
  if (nickEmail && nickPassword) {
    accounts.push({ alias: "nick", email: nickEmail, password: nickPassword });
  }

  const nelsonEmail = process.env.NELSON_EMAIL;
  const nelsonPassword = process.env.NELSON_EMAIL_PASSWORD;
  if (nelsonEmail && nelsonPassword) {
    accounts.push({ alias: "nelson", email: nelsonEmail, password: nelsonPassword });
  }

  if (accounts.length === 0) {
    throw new Error("No IMAP mailbox credentials configured.");
  }

  return accounts;
}

/**
 * Match the sender email address against the contacts table and resolve
 * the linked account and most recent open deal.
 */
async function matchContact(senderEmail: string) {
  const contact = await prisma.contact.findFirst({
    where: {
      email: { equals: senderEmail, mode: "insensitive" },
      deletedAt: null,
    },
    select: {
      id: true,
      accountId: true,
    },
  });

  if (!contact) return null;

  const openDeal = await prisma.deal.findFirst({
    where: {
      contactId: contact.id,
      deletedAt: null,
      stage: {
        notIn: [
          "ClosedWonRecurring",
          "ClosedWonOneOff",
          "ClosedLostRecurring",
          "ClosedLostOneOff",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  return {
    contactId: contact.id,
    accountId: contact.accountId,
    dealId: openDeal?.id || null,
  };
}

/**
 * Process a single parsed inbound email: create Email record + Activity.
 * Returns true if the email was new and inserted.
 */
async function processInboundEmail(
  parsed: ParsedEmail,
  account: MailboxAccount
): Promise<boolean> {
  // Check for duplicate by messageId
  if (parsed.messageId) {
    const existing = await prisma.email.findFirst({
      where: { messageId: parsed.messageId },
    });
    if (existing) return false;
  }

  const match = await matchContact(parsed.fromAddress);

  // Resolve thread ID from inReplyTo
  let threadId: string | null = null;
  if (parsed.inReplyTo) {
    const parent = await prisma.email.findFirst({
      where: { messageId: parsed.inReplyTo },
      select: { threadId: true, messageId: true },
    });
    threadId = parent?.threadId || parent?.messageId || null;
  }

  const email = await prisma.email.create({
    data: {
      direction: EmailDirection.inbound,
      fromAddress: parsed.fromAddress,
      toAddress: parsed.toAddress,
      ccAddresses: parsed.ccAddresses,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml || null,
      bodyText: parsed.bodyText || null,
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo,
      threadId,
      contactId: match?.contactId || null,
      accountId: match?.accountId || null,
      dealId: match?.dealId || null,
      attachments: JSON.stringify(parsed.attachments),
      status: EmailStatus.received,
      receivedAt: parsed.receivedAt,
      mailAccount: account.alias,
      isRead: parsed.isRead,
    },
  });

  // Create activity record
  await prisma.activity.create({
    data: {
      activityType: ActivityType.email_received,
      subject: `Email received: ${parsed.subject}`,
      body: parsed.bodyText || parsed.bodyHtml || null,
      contactId: match?.contactId || null,
      accountId: match?.accountId || null,
      dealId: match?.dealId || null,
      metadata: {
        emailId: email.id,
        fromAddress: parsed.fromAddress,
        messageId: parsed.messageId,
      },
    },
  });

  return true;
}

/**
 * Poll a single mailbox — download full raw source, parse with mailparser.
 */
async function pollMailbox(account: MailboxAccount): Promise<number> {
  const host = process.env.IMAP_HOST || "imap.ionos.co.uk";
  const port = parseInt(process.env.IMAP_PORT || "993", 10);

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
    socketTimeout: 60000,
    greetingTimeout: 15000,
    emitLogs: false,
  });

  let processed = 0;

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      const status = await client.status("INBOX", { messages: true });
      const totalMessages = status.messages ?? 0;
      if (totalMessages === 0) return 0;

      // Fetch the last 200 messages
      const fetchLimit = 200;
      const startSeq = Math.max(1, totalMessages - fetchLimit + 1);

      for await (const msg of client.fetch(
        `${startSeq}:*`,
        {
          uid: true,
          envelope: true,
          flags: true,
          source: true,
        }
      )) {
        try {
          // Quick duplicate check before expensive parsing
          const msgId = msg.envelope?.messageId;
          if (msgId) {
            const exists = await prisma.email.findFirst({
              where: { messageId: msgId },
              select: { id: true },
            });
            if (exists) continue;
          }

          // Parse full raw source with mailparser
          const raw = msg.source;
          if (!raw) continue;

          const parsed = await simpleParser(raw);

          const fromAddr =
            parsed.from?.value?.[0]?.address || "unknown@unknown.com";
          const toAddr =
            parsed.to
              ? Array.isArray(parsed.to)
                ? parsed.to[0]?.value?.[0]?.address || ""
                : parsed.to.value?.[0]?.address || ""
              : "";
          const ccAddrs = parsed.cc
            ? (Array.isArray(parsed.cc)
                ? parsed.cc.flatMap((c) => c.value)
                : parsed.cc.value
              )
                .map((a) => a.address)
                .filter((a): a is string => Boolean(a))
            : [];

          const attachmentMeta = (parsed.attachments || []).map((att) => ({
            filename: att.filename || "untitled",
            contentType: att.contentType || "application/octet-stream",
            size: att.size || 0,
          }));

          const isRead = msg.flags?.has("\\Seen") ?? false;

          const emailData: ParsedEmail = {
            fromAddress: fromAddr,
            toAddress: toAddr,
            ccAddresses: ccAddrs,
            subject: parsed.subject || "(no subject)",
            bodyHtml: parsed.html || "",
            bodyText: parsed.text || "",
            messageId: parsed.messageId || "",
            inReplyTo: parsed.inReplyTo || null,
            attachments: attachmentMeta,
            receivedAt: parsed.date || new Date(),
            isRead,
          };

          const wasNew = await processInboundEmail(emailData, account);
          if (wasNew) processed++;
        } catch (msgError) {
          console.error(
            `[IMAP] Error processing message UID ${msg.uid} in ${account.alias}:`,
            msgError instanceof Error ? msgError.message : msgError
          );
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error(
      `[IMAP] Error polling ${account.alias} (${account.email}):`,
      error instanceof Error ? error.message : error
    );
  } finally {
    try {
      await client.logout();
    } catch {
      // Connection may already be closed
    }
  }

  return processed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function pollEmails(): Promise<number> {
  const accounts = getMailboxAccounts();
  let total = 0;

  for (const account of accounts) {
    const count = await pollMailbox(account);
    total += count;
    if (count > 0) {
      console.log(`[IMAP] Processed ${count} new email(s) from ${account.alias}`);
    }
  }

  return total;
}
