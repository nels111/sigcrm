import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, DocumentType } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

const FILES_ROOT =
  process.env.FILES_ROOT || "/var/data/signature-cleans/files";

const documentIncludes = {
  deal: { select: { id: true, name: true } },
  lead: { select: { id: true, companyName: true } },
  account: { select: { id: true, name: true } },
  contract: { select: { id: true, contractName: true } },
  quote: { select: { id: true, quoteRef: true } },
  creator: { select: { id: true, name: true, email: true } },
};

// GET /api/documents — List documents with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") || "0", 10)
    );

    // Build where clause
    const where: Prisma.DocumentWhereInput = {};

    const accountId = searchParams.get("accountId");
    if (accountId) where.accountId = accountId;

    const contractId = searchParams.get("contractId");
    if (contractId) where.contractId = contractId;

    const dealId = searchParams.get("dealId");
    if (dealId) where.dealId = dealId;

    const leadId = searchParams.get("leadId");
    if (leadId) where.leadId = leadId;

    const quoteId = searchParams.get("quoteId");
    if (quoteId) where.quoteId = quoteId;

    const documentType = searchParams.get("documentType");
    if (documentType) {
      where.documentType = documentType as Prisma.EnumDocumentTypeFilter;
    }

    const search = searchParams.get("search");
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    // Execute count and findMany in parallel
    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: documentIncludes,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: documents,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST /api/documents — Upload a file and create a document record
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "file is required" },
        { status: 400 }
      );
    }

    const name = (formData.get("name") as string) || file.name;
    const documentType = formData.get("documentType") as string;

    if (!documentType) {
      return NextResponse.json(
        { error: "documentType is required" },
        { status: 400 }
      );
    }

    // Optional relation IDs
    const accountId = formData.get("accountId") as string | null;
    const contractId = formData.get("contractId") as string | null;
    const dealId = formData.get("dealId") as string | null;
    const leadId = formData.get("leadId") as string | null;
    const quoteId = formData.get("quoteId") as string | null;
    const createdBy = formData.get("createdBy") as string | null;

    // Build file path: /FILES_ROOT/documents/{uuid}-{originalname}
    const fileId = uuidv4();
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${fileId}-${safeOriginalName}`;
    const dirPath = join(FILES_ROOT, "documents");
    const filePath = join(dirPath, fileName);

    // Ensure directory exists
    await mkdir(dirPath, { recursive: true });

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    // Create document record in DB
    const document = await prisma.document.create({
      data: {
        name,
        documentType: documentType as DocumentType,
        filePath,
        fileUrl: `/api/documents/${fileId}/download`,
        fileSize: buffer.length,
        mimeType: file.type || "application/octet-stream",
        accountId: accountId || undefined,
        contractId: contractId || undefined,
        dealId: dealId || undefined,
        leadId: leadId || undefined,
        quoteId: quoteId || undefined,
        createdBy: createdBy || undefined,
      },
      include: documentIncludes,
    });

    // Update the fileUrl now that we have the real document ID
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: { fileUrl: `/api/documents/${document.id}/download` },
      include: documentIncludes,
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (error) {
    console.error("POST /api/documents error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid document data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
