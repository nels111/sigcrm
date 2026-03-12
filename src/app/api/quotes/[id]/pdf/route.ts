import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuotePDF } from "@/lib/quote-docx";

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

    const pdfBuffer = await generateQuotePDF(quote);

    const filename = `Signature_Cleans_Quote_${quote.quoteRef}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
