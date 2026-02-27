import { ImapFlow } from "imapflow";
import type { FetchMessageObject, MessageStructureObject } from "imapflow";
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
    throw new Error("No IMAP mailbox credentials configured. Set NICK_EMAIL/NICK_EMAIL_PASSWORD and/or NELSON_EMAIL/NELSON_EMAIL_PASSWORD.");
  }

  return accounts;
}

/**
 * Walk the MIME bodyStructure tree and collect text parts and attachment
 * metadata.  Returns the part numbers we need to download.
 */
function walkStructure(
  node: MessageStructureObject,
  textParts: { part: string; type: string }[],
  attachmentMeta: { filename: string; contentType: string; size: number }[]
): void {
  if (node.childNodes && node.childNodes.length > 0) {
    for (const child of node.childNodes) {
      walkStructure(child, textParts, attachmentMeta);
    }
    return;
  }

  const type = (node.type || "").toLowerCase();
  const disposition = (node.disposition || "").toLowerCase();
  const part = node.part || "1";

  if (disposition === "attachment") {
    const filename =
      node.dispositionParameters?.filename ||
      node.parameters?.name ||
      "untitled";
    attachmentMeta.push({
      filename,
      contentType: type,
      size: node.size || 0,
    });
    return;
  }

  if (type === "text/html" || type === "text/plain") {
    textParts.push({ part, type });
  }
}

/**
 * Download the body content of the given text parts and return html + text.
 */
async function downloadTextParts(
  client: ImapFlow,
  uid: number,
  textParts: { part: string; type: string }[]
): Promise<{ html: string; text: string }> {
  let html = "";
  let text = "";

  for (const { part, type } of textParts) {
    try {
      const { content } = await client.download(String(uid), part, { uid: true });
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const decoded = Buffer.concat(chunks).toString("utf-8");

      if (type === "text/html") {
        html = decoded;
      } else if (type === "text/plain") {
        text = decoded;
      }
    } catch {
      // If a single part fails to download, continue with the others.
    }
  }

  return { html, text };
}

/**
 * Parse a FetchMessageObject into our internal ParsedEmail shape.
 */
async function parseMessage(
  client: ImapFlow,
  msg: FetchMessageObject
): Promise<ParsedEmail> {
  const envelope = msg.envelope;

  const fromAddress =
    envelope?.from?.[0]?.address || "unknown@unknown.com";
  const toAddress =
    envelope?.to?.[0]?.address || "unknown@unknown.com";
  const ccAddresses = (envelope?.cc || [])
    .map((a) => a.address)
    .filter((a): a is string => Boolean(a));
  const subject = envelope?.subject || "(no subject)";
  const messageId = envelope?.messageId || "";
  const inReplyTo = envelope?.inReplyTo || null;
  const receivedAt = envelope?.date ? new Date(envelope.date) : new Date();

  // Parse body structure for text parts + attachments
  const textParts: { part: string; type: string }[] = [];
  const attachmentMeta: { filename: string; contentType: string; size: number }[] = [];

  if (msg.bodyStructure) {
    walkStructure(msg.bodyStructure, textParts, attachmentMeta);
  }

  const { html, text } = await downloadTextParts(client, msg.uid, textParts);

  return {
    fromAddress,
    toAddress,
    ccAddresses,
    subject,
    bodyHtml: html,
    bodyText: text,
    messageId,
    inReplyTo,
    attachments: attachmentMeta,
    receivedAt,
  };
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

  // Find the most recent open deal for this contact
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
 */
async function processInboundEmail(parsed: ParsedEmail): Promise<void> {
  // Check for duplicate by messageId to avoid re-processing
  if (parsed.messageId) {
    const existing = await prisma.email.findFirst({
      where: { messageId: parsed.messageId },
    });
    if (existing) return;
  }

  const match = await matchContact(parsed.fromAddress);

  // Try to resolve thread ID from inReplyTo
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
}

/**
 * Poll a single mailbox for unseen messages.
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
  });

  let processed = 0;

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for unseen messages
      const uids = await client.search({ seen: false }, { uid: true });

      if (!uids || uids.length === 0) {
        return 0;
      }

      // Fetch in batches of unseen UIDs
      for await (const msg of client.fetch(
        uids.join(","),
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
        },
        { uid: true }
      )) {
        try {
          const parsed = await parseMessage(client, msg);
          await processInboundEmail(parsed);

          // Mark as seen
          await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
          processed++;
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

/**
 * Poll all configured IONOS mailboxes for new (unseen) emails.
 *
 * For each new email the poller will:
 *  1. Parse envelope, body (html + text), and attachment metadata.
 *  2. Match the sender against the contacts table.
 *  3. Create an Email record linked to contact / account / deal when matched.
 *  4. Create an Activity record (email_received).
 *  5. Mark the message as Seen in IMAP.
 *
 * Returns the total number of emails processed across all mailboxes.
 */
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
