import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { QuotePDF } from "@/lib/quote-pdf";
import type { QuotePDFData } from "@/lib/quote-pdf";

type RouteContext = { params: Promise<{ id: string }> };

// ──────────────────────────────────────────────
// GET /api/quotes/[id]/pdf — Generate and serve quote PDF
// ──────────────────────────────────────────────

export async function GET(
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

    // Build the data object for the PDF component
    const pdfData: QuotePDFData = {
      quoteRef: quote.quoteRef,
      companyName: quote.companyName,
      address: quote.address,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      siteType: quote.siteType,
      daysSelected: quote.daysSelected,
      monthlyTotal: Number(quote.monthlyTotal),
      annualTotal: Number(quote.annualTotal),
      scopeOfWorks: quote.scopeOfWorks,
      applyPilotPricing: quote.applyPilotPricing,
      pilotMonthlyTotal: quote.pilotMonthlyTotal ? Number(quote.pilotMonthlyTotal) : null,
      pilotSavings: quote.pilotSavings ? Number(quote.pilotSavings) : null,
      pilotStartDate: quote.pilotStartDate ? quote.pilotStartDate.toISOString() : null,
      pilotEndDate: quote.pilotEndDate ? quote.pilotEndDate.toISOString() : null,
      pilotReviewDate: quote.pilotReviewDate ? quote.pilotReviewDate.toISOString() : null,
      standardPricingStartDate: quote.standardPricingStartDate
        ? quote.standardPricingStartDate.toISOString()
        : null,
      createdAt: quote.createdAt.toISOString(),
    };

    // Render the PDF to a buffer
    const pdfElement = React.createElement(QuotePDF, { data: pdfData });
    // renderToBuffer expects DocumentProps but our component wraps Document internally
    const pdfBuffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfElement as unknown as React.ReactElement<any>
    );

    // Build a safe filename
    const filename = `Signature-Cleans-Quote-${quote.quoteRef}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/quotes/[id]/pdf error:", error);
    return NextResponse.json(
      { error: "Failed to generate quote PDF" },
      { status: 500 }
    );
  }
}
