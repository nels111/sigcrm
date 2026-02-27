import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { unlink } from "fs/promises";

type RouteContext = { params: Promise<{ id: string }> };

const documentIncludes = {
  deal: { select: { id: true, name: true } },
  lead: { select: { id: true, companyName: true } },
  account: { select: { id: true, name: true } },
  contract: { select: { id: true, contractName: true } },
  quote: { select: { id: true, quoteRef: true } },
  creator: { select: { id: true, name: true, email: true } },
};

// GET /api/documents/[id] — Fetch a single document with relations
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: documentIncludes,
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[id] — Update document metadata
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check that the document exists
    const existing = await prisma.document.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Only allow updating specific metadata fields
    const updateData: Prisma.DocumentUpdateInput = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.documentType !== undefined) updateData.documentType = body.documentType;

    // Relation fields — set or disconnect
    if (body.accountId !== undefined) {
      updateData.account = body.accountId
        ? { connect: { id: body.accountId } }
        : { disconnect: true };
    }
    if (body.contractId !== undefined) {
      updateData.contract = body.contractId
        ? { connect: { id: body.contractId } }
        : { disconnect: true };
    }
    if (body.dealId !== undefined) {
      updateData.deal = body.dealId
        ? { connect: { id: body.dealId } }
        : { disconnect: true };
    }
    if (body.leadId !== undefined) {
      updateData.lead = body.leadId
        ? { connect: { id: body.leadId } }
        : { disconnect: true };
    }
    if (body.quoteId !== undefined) {
      updateData.quote = body.quoteId
        ? { connect: { id: body.quoteId } }
        : { disconnect: true };
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: documentIncludes,
    });

    return NextResponse.json({ data: document });
  } catch (error) {
    console.error("PUT /api/documents/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid update data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] — Remove document record and file from disk
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const existing = await prisma.document.findUnique({
      where: { id },
      select: { id: true, filePath: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the file from disk
    if (existing.filePath) {
      try {
        await unlink(existing.filePath);
      } catch (fsError: unknown) {
        // Log but don't fail if file already missing
        const code = (fsError as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          console.error("Failed to delete file from disk:", fsError);
        }
      }
    }

    // Delete the DB record
    await prisma.document.delete({ where: { id } });

    return NextResponse.json(
      { message: "Document deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/documents/[id] error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
