import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAccount } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  generateTrackingId,
  injectTrackingPixel,
} from "@/lib/email-tracker";
import {
  Prisma,
  EmailDirection,
  EmailStatus,
  ActivityType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/emails — List emails with pagination and filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await getSessionAccount();
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Build where clause — scope to logged-in user's mailAccount
    const where: Prisma.EmailWhereInput = {
      mailAccount: account,
    };

    // Filter by direction (inbound / outbound)
    const direction = searchParams.get("direction");
    if (direction && (direction === "inbound" || direction === "outbound")) {
      where.direction = direction as EmailDirection;
    }

    // Filter by status
    const status = searchParams.get("status");
    if (status) {
      where.status = status as EmailStatus;
    }

    // Filter by linked entities
    const dealId = searchParams.get("dealId");
    if (dealId) where.dealId = dealId;

    const leadId = searchParams.get("leadId");
    if (leadId) where.leadId = leadId;

    const contactId = searchParams.get("contactId");
    if (contactId) where.contactId = contactId;

    const accountId = searchParams.get("accountId");
    if (accountId) where.accountId = accountId;

    // Unmatched filter — emails not linked to any entity
    const unmatched = searchParams.get("unmatched");
    if (unmatched === "true") {
      where.contactId = null;
      where.accountId = null;
      where.dealId = null;
      where.leadId = null;
    }

    // Search by subject or from/to address
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { fromAddress: { contains: search, mode: "insensitive" } },
        { toAddress: { contains: search, mode: "insensitive" } },
      ];
    }

    // Execute count and findMany in parallel
    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        include: {
          deal: { select: { id: true, name: true } },
          lead: { select: { id: true, companyName: true, contactName: true } },
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          account: { select: { id: true, name: true } },
        },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/emails error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/emails — Send an email from the CRM
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { from, to, subject, bodyHtml } = body;

    if (!from || (from !== "nick" && from !== "nelson")) {
      return NextResponse.json(
        { error: "from is required and must be 'nick' or 'nelson'" },
        { status: 400 }
      );
    }

    if (!to) {
      return NextResponse.json(
        { error: "to is required" },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: "subject is required" },
        { status: 400 }
      );
    }

    if (!bodyHtml) {
      return NextResponse.json(
        { error: "bodyHtml is required" },
        { status: 400 }
      );
    }

    // Resolve the sender address for the Email record
    const fromAddress =
      from === "nick"
        ? process.env.NICK_EMAIL || "nick@signature-cleans.co.uk"
        : process.env.NELSON_EMAIL || "nelson@signature-cleans.co.uk";

    // Inject open-tracking pixel
    const trackingId = generateTrackingId();
    const trackedHtml = injectTrackingPixel(bodyHtml, trackingId);

    // Send via SMTP
    let smtpResult;
    try {
      smtpResult = await sendEmail({
        from,
        to,
        cc: body.cc || undefined,
        bcc: body.bcc || undefined,
        subject,
        html: trackedHtml,
        text: body.bodyText || undefined,
        attachments: body.attachments || undefined,
      });
    } catch (smtpError) {
      // Create a failed email record so the user can see it
      const failedEmail = await prisma.email.create({
        data: {
          direction: EmailDirection.outbound,
          fromAddress,
          toAddress: to,
          ccAddresses: body.cc ? [body.cc] : [],
          bccAddresses: body.bcc ? [body.bcc] : [],
          subject,
          bodyHtml,
          bodyText: body.bodyText || null,
          dealId: body.dealId || null,
          leadId: body.leadId || null,
          contactId: body.contactId || null,
          accountId: body.accountId || null,
          attachments: body.attachments ? JSON.stringify(body.attachments) : "[]",
          status: EmailStatus.failed,
        },
      });

      console.error("POST /api/emails SMTP error:", smtpError);
      return NextResponse.json(
        {
          error: "Failed to send email via SMTP",
          detail: smtpError instanceof Error ? smtpError.message : "Unknown error",
          data: failedEmail,
        },
        { status: 502 }
      );
    }

    // Resolve thread ID from inReplyTo if present
    let threadId: string | null = null;
    if (body.inReplyTo) {
      const parent = await prisma.email.findFirst({
        where: { messageId: body.inReplyTo },
        select: { threadId: true, messageId: true },
      });
      threadId = parent?.threadId || parent?.messageId || null;
    }

    // Create the sent Email record
    const email = await prisma.email.create({
      data: {
        direction: EmailDirection.outbound,
        fromAddress,
        toAddress: to,
        ccAddresses: body.cc ? [body.cc] : [],
        bccAddresses: body.bcc ? [body.bcc] : [],
        subject,
        bodyHtml: trackedHtml,
        bodyText: body.bodyText || null,
        messageId: smtpResult.messageId || null,
        inReplyTo: body.inReplyTo || null,
        threadId,
        dealId: body.dealId || null,
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        accountId: body.accountId || null,
        attachments: body.attachments ? JSON.stringify(body.attachments) : "[]",
        status: EmailStatus.sent,
        sentAt: new Date(),
        trackingId,
        mailAccount: from,
      },
      include: {
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true, contactName: true } },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        account: { select: { id: true, name: true } },
      },
    });

    // Create Activity record
    await prisma.activity.create({
      data: {
        activityType: ActivityType.email_sent,
        subject: `Email sent: ${subject}`,
        body: body.bodyText || bodyHtml,
        dealId: body.dealId || null,
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        accountId: body.accountId || null,
        metadata: {
          emailId: email.id,
          toAddress: to,
          messageId: smtpResult.messageId,
          sentAs: from,
        },
      },
    });

    return NextResponse.json({ data: email }, { status: 201 });
  } catch (error) {
    console.error("POST /api/emails error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid email data provided" },
        { status: 400 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "One or more linked records not found" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
