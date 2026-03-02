import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * Send an email notification to a user if they have email notifications enabled.
 * Fails silently — callers should not block on this.
 */
export async function sendNotificationEmail(
  userId: string,
  title: string,
  message: string,
  linkUrl?: string | null
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        notificationsEmail: true,
        ionosEmail: true,
      },
    });

    if (!user || !user.notificationsEmail) return;

    const appUrl = process.env.NEXTAUTH_URL || "https://crm.signaturecleans.co.uk";
    const fullLink = linkUrl ? `${appUrl}${linkUrl}` : appUrl;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #059669; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 18px;">Signature OS</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Notification</p>
          <h3 style="margin: 0 0 12px; font-size: 16px; color: #111827;">${title}</h3>
          <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.5;">${message}</p>
          ${
            linkUrl
              ? `<a href="${fullLink}" style="display: inline-block; background: #059669; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">View in CRM</a>`
              : ""
          }
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            You received this because you have email notifications enabled in Signature OS.
          </p>
        </div>
      </div>
    `;

    // Use nelson as the system sender (or nick if configured)
    await sendEmail({
      from: "nelson",
      to: user.email,
      subject: `[Signature OS] ${title}`,
      html,
      text: `${title}\n\n${message}${linkUrl ? `\n\nView: ${fullLink}` : ""}`,
    });
  } catch (error) {
    // Log but don't throw — notification emails are best-effort
    console.error("Failed to send notification email:", error);
  }
}
