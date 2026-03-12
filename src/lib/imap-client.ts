import { ImapFlow } from "imapflow";

function getCredentials(account: "nick" | "nelson") {
  return {
    user:
      account === "nick"
        ? process.env.NICK_EMAIL!
        : process.env.NELSON_EMAIL!,
    pass:
      account === "nick"
        ? process.env.NICK_EMAIL_PASSWORD!
        : process.env.NELSON_EMAIL_PASSWORD!,
  };
}

export interface ImapEmail {
  uid: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
}

export async function fetchEmails(
  account: "nick" | "nelson",
  limit = 50
): Promise<ImapEmail[]> {
  const creds = getCredentials(account);
  const client = new ImapFlow({
    host: "imap.ionos.co.uk",
    port: 993,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
  });

  await client.connect();
  const emails: ImapEmail[] = [];

  try {
    await client.mailboxOpen("INBOX");
    const status = await client.status("INBOX", { messages: true });
    const startSeq = Math.max(1, (status.messages ?? 0) - limit + 1);

    for await (const msg of client.fetch(`${startSeq}:*`, {
      envelope: true,
      bodyStructure: true,
      flags: true,
    })) {
      const env = msg.envelope;
      if (!env) continue;
      emails.push({
        uid: String(msg.uid),
        subject: env.subject || "(no subject)",
        from: env.from?.[0]?.address || "",
        fromName: env.from?.[0]?.name || "",
        to: env.to?.[0]?.address || "",
        date: env.date ?? new Date(),
        isRead: msg.flags?.has("\\Seen") ?? false,
        hasAttachments: false,
      });
    }
  } finally {
    await client.logout();
  }

  return emails.reverse();
}

export async function markAsRead(
  account: "nick" | "nelson",
  uid: string
): Promise<void> {
  const creds = getCredentials(account);
  const client = new ImapFlow({
    host: "imap.ionos.co.uk",
    port: 993,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
  });
  await client.connect();
  await client.mailboxOpen("INBOX");
  await client.messageFlagsAdd({ uid: Number(uid) }, ["\\Seen"], {
    uid: true,
  });
  await client.logout();
}
