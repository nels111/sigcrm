import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";

type RouteContext = { params: Promise<{ id: string }> };

// MIME types that should be displayed inline (PDFs and images)
const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
]);

// GET /api/documents/[id]/download — Serve the file from disk
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, name: true, filePath: true, mimeType: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (!document.filePath) {
      return NextResponse.json(
        { error: "Document has no file associated" },
        { status: 404 }
      );
    }

    // Read file from disk
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(document.filePath);
    } catch (fsError: unknown) {
      const code = (fsError as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return NextResponse.json(
          { error: "File not found on disk" },
          { status: 404 }
        );
      }
      throw fsError;
    }

    const mimeType = document.mimeType || "application/octet-stream";
    const isInline = INLINE_MIME_TYPES.has(mimeType);
    const disposition = isInline
      ? `inline; filename="${encodeURIComponent(document.name)}"`
      : `attachment; filename="${encodeURIComponent(document.name)}"`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/documents/[id]/download error:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}
