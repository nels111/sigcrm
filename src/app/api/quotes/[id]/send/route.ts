import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuotePDF } from "@/lib/quote-docx";
import { sendEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// POST /api/quotes/[id]/send — Generate PDF & email to prospect
// ──────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    if (!quote.contactEmail) {
      return NextResponse.json(
        { error: "Quote has no contact email address" },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(quote);

    // Build branded email HTML based on quote type
    const isPilot = quote.applyPilotPricing === true && quote.pilotMonthlyTotal != null;

    const monthlyFormatted = `\u00A3${Number(quote.monthlyTotal).toFixed(2)}`;
    const pilotFormatted = quote.pilotMonthlyTotal
      ? `\u00A3${Number(quote.pilotMonthlyTotal).toFixed(2)}`
      : "";
    const savingsFormatted = quote.pilotSavings
      ? `\u00A3${Number(quote.pilotSavings).toFixed(2)}`
      : "";
    const frequency = `${quote.frequencyPerWeek}x per week (${(quote.daysSelected ?? []).join(", ")}), ${quote.hoursPerDay} hours per visit`;

    const sharedHeader = `
      <div class="header">
        <img src="https://signature-cleans.co.uk/wp-content/uploads/2024/01/Final-agreed-Logos.png"
             alt="Signature Cleans" style="max-width:250px;height:auto;margin-bottom:15px;">
      </div>`;

    const sharedFooter = `
      <div class="footer">
        <p style="margin:5px 0;"><strong>Nick Stentiford</strong><br>CEO &amp; Founder, Signature Cleans</p>
        <p style="margin:10px 0;">
          \u{1F4DE} 01392 931035<br>
          \u{1F4E7} nick@signature-cleans.co.uk<br>
          \u{1F310} www.signature-cleans.co.uk
        </p>
        <p style="margin:15px 0 0;font-size:12px;">28 Admiral Walk, Teignmouth, TQ14 9NG</p>
      </div>`;

    const sharedVideoBlock = `
      <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:25px 0;text-align:center;">
        <h3 style="margin-top:0;color:#0B3D91;">\u{1F3A5} Watch Our Introduction</h3>
        <p>Learn more about Signature Cleans and what makes us different:</p>
        <a href="https://youtube.com/shorts/H4GzE8LtA3I?si=3Jp6cE2qcX0kCikM"
           style="display:inline-block;background:#c4302b;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;font-weight:bold;margin:10px 0;">\u25B6\uFE0F Watch Video</a>
      </div>`;

    const pricingBlock = isPilot
      ? `
      <div style="background:linear-gradient(135deg,#fff9e6,#fff3cd);padding:25px;border-radius:10px;margin:25px 0;border-left:5px solid #ffc107;">
        <div style="display:inline-block;background:#ffc107;color:#000;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:bold;margin-bottom:10px;">\u{1F389} SPECIAL PILOT OFFER \u2013 25% OFF</div>
        <h2 style="margin-top:0;color:#856404;">Your 30-Day Pilot Pricing</h2>
        <p style="color:#856404;"><strong>Try our service risk-free with 25% discount for the first 30 days!</strong></p>
        <p style="font-size:14px;color:#c4302b;font-weight:bold;">\u23F0 This pilot offer is valid for 48 hours only</p>
        <p><strong>Standard Price:</strong> <span style="text-decoration:line-through;color:#999;font-size:18px;">${monthlyFormatted}</span></p>
        <p><strong>Your Pilot Price:</strong> <span style="font-size:28px;color:#28a745;font-weight:bold;">${pilotFormatted}</span></p>
        <div style="background:#d4edda;color:#155724;padding:10px;border-radius:5px;font-weight:bold;text-align:center;">
          \u{1F4B0} You Save: ${savingsFormatted} per month for 30 days!
        </div>
        <p style="margin-top:15px;font-size:13px;color:#856404;">
          <strong>Pilot Period:</strong> 30 days from agreed start date<br>
          <strong>Standard pricing begins:</strong> 30 days following pilot commencement
        </p>
      </div>`
      : `
      <div style="background:#f8f9fa;padding:25px;border-radius:10px;margin:25px 0;border-left:5px solid #0B3D91;">
        <h2 style="margin-top:0;color:#0B3D91;">Your Quote</h2>
        <div style="font-size:28px;color:#0B3D91;font-weight:bold;margin:15px 0;">${monthlyFormatted}</div>
        <p style="color:#666;margin:5px 0;">per calendar month (excl. VAT)</p>
        <p><strong>Service Frequency:</strong> ${frequency}</p>
      </div>`;

    const nextSteps = isPilot
      ? `
      <ol>
        <li>Download and review the attached quote document</li>
        <li>Enjoy 25% off for your first 30 days!</li>
        <li>If you're happy to proceed, sign and return the declaration page</li>
        <li>We'll schedule your mobilisation and get you started</li>
      </ol>`
      : `
      <ol>
        <li>Download and review the attached quote document</li>
        <li>Review our competitive pricing</li>
        <li>If you're happy to proceed, sign and return the declaration page</li>
        <li>We'll schedule your mobilisation and get you started</li>
      </ol>`;

    const subject = isPilot
      ? `\u{1F389} Your Pilot Pricing Quote (25% OFF) \u2013 Signature Cleans`
      : `Your Cleaning Quote \u2013 Signature Cleans`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;}
    .container{max-width:600px;margin:0 auto;padding:20px;}
    .header{text-align:center;margin-bottom:30px;border-bottom:3px solid #0B3D91;padding-bottom:20px;}
    .footer{margin-top:40px;padding-top:20px;border-top:2px solid #ddd;font-size:14px;color:#666;}
  </style>
</head>
<body>
  <div class="container">
    ${sharedHeader}
    <p>Dear <strong>${quote.contactName}</strong>,</p>
    <p>Thank you for your interest in Signature Cleans. We're delighted to provide you with a comprehensive cleaning quote for <strong>${quote.companyName}</strong>.</p>
    ${pricingBlock}
    ${sharedVideoBlock}
    <p><strong>\u{1F4CE} Your Documents Are Attached</strong></p>
    <ul>
      <li><strong>Quote Document</strong> \u2013 Complete quote with scope of works, T&amp;Cs, and declaration</li>
      <li><strong>Company Snapshot</strong> \u2013 Learn more about who we are and our commitment to excellence</li>
    </ul>
    <p><strong>Next Steps:</strong></p>
    ${nextSteps}
    <p>If you have any questions, please don't hesitate to get in touch.</p>
    ${sharedFooter}
  </div>
</body>
</html>`;

    // Send email
    const result = await sendEmail({
      from: "nick",
      to: quote.contactEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Signature_Cleans_Quote_${quote.quoteRef}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // Update quote status
    await prisma.quote.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Create Email record
    await prisma.email.create({
      data: {
        direction: "outbound",
        fromAddress: "nick@signature-cleans.co.uk",
        toAddress: quote.contactEmail,
        subject,
        bodyHtml: "Quote PDF attached",
        messageId: result.messageId,
        status: "sent",
        sentAt: new Date(),
        dealId: quote.dealId,
        leadId: quote.leadId,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("POST /api/quotes/[id]/send error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send quote email",
      },
      { status: 500 }
    );
  }
}
