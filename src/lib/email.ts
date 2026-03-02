import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SenderAlias = "nick" | "nelson";

interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface SendEmailOptions {
  from: SenderAlias;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

// ---------------------------------------------------------------------------
// Credentials lookup
// ---------------------------------------------------------------------------

interface SenderCredentials {
  email: string;
  password: string;
}

function getCredentials(alias: SenderAlias): SenderCredentials {
  if (alias === "nick") {
    const email = process.env.NICK_EMAIL;
    const password = process.env.NICK_EMAIL_PASSWORD;
    if (!email || !password) {
      throw new Error("NICK_EMAIL and NICK_EMAIL_PASSWORD must be set in environment variables");
    }
    return { email, password };
  }

  const email = process.env.NELSON_EMAIL;
  const password = process.env.NELSON_EMAIL_PASSWORD;
  if (!email || !password) {
    throw new Error("NELSON_EMAIL and NELSON_EMAIL_PASSWORD must be set in environment variables");
  }
  return { email, password };
}

// ---------------------------------------------------------------------------
// Lazy transporter cache — one per sender so each authenticates with its own
// credentials against the IONOS SMTP relay.
// ---------------------------------------------------------------------------

const transporters: Record<SenderAlias, Transporter<SMTPTransport.SentMessageInfo> | null> = {
  nick: null,
  nelson: null,
};

function getTransporter(alias: SenderAlias): Transporter<SMTPTransport.SentMessageInfo> {
  if (transporters[alias]) {
    return transporters[alias];
  }

  const host = process.env.SMTP_HOST || "smtp.ionos.co.uk";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const { email, password } = getCredentials(alias);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on port 587
    auth: {
      user: email,
      pass: password,
    },
    tls: {
      // IONOS requires STARTTLS — allow server certificate
      rejectUnauthorized: true,
    },
  });

  transporters[alias] = transporter;
  return transporter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an email via IONOS SMTP.
 *
 * Uses the `from` alias ("nick" | "nelson") to select the correct
 * authenticated transporter and sender address.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { from, to, cc, bcc, subject, html, text, attachments } = options;

  // ── External email guard ──────────────────────────────────────────────
  // When ENABLE_EXTERNAL_EMAILS is not "true", block sends to any address
  // that is NOT @signature-cleans.co.uk.  Returns a dummy result so callers
  // (cadence engine, quote follow-up, etc.) don't break.
  if (process.env.ENABLE_EXTERNAL_EMAILS !== "true") {
    const allRecipients = [to, cc, bcc].filter(Boolean).join(",");
    const isInternal = allRecipients
      .split(",")
      .map((addr) => addr.trim().toLowerCase())
      .every((addr) => addr.endsWith("@signature-cleans.co.uk"));

    if (!isInternal) {
      console.log(
        `[Email] External emails disabled — skipping send to "${to}" (subject: "${subject}")`
      );
      return {
        messageId: `<blocked-${Date.now()}@local>`,
        accepted: [],
        rejected: [to],
        response: "External emails disabled via ENABLE_EXTERNAL_EMAILS env var",
      };
    }
  }

  const { email: fromAddress } = getCredentials(from);
  const transporter = getTransporter(from);

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html,
      text: text || undefined,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        path: a.path,
        contentType: a.contentType,
      })),
    });

    return {
      messageId: info.messageId,
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
      response: info.response,
    };
  } catch (error) {
    // Reset the cached transporter on auth / connection failures so the
    // next call creates a fresh one.
    transporters[from] = null;

    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    throw new Error(`Failed to send email via ${from}: ${message}`);
  }
}
