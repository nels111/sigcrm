import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, TemplateType } from "@prisma/client";

// GET /api/email-templates — List templates with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause
    const where: Prisma.EmailTemplateWhereInput = {};

    // Filter by templateType
    const templateType = searchParams.get("templateType");
    if (templateType) {
      where.templateType = templateType as TemplateType;
    }

    // Filter by isActive
    const isActive = searchParams.get("isActive");
    if (isActive === "true") {
      where.isActive = true;
    } else if (isActive === "false") {
      where.isActive = false;
    }

    // Search by name
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    // Execute count and findMany in parallel
    const [total, templates] = await Promise.all([
      prisma.emailTemplate.count({ where }),
      prisma.emailTemplate.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/email-templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email templates" },
      { status: 500 }
    );
  }
}

// POST /api/email-templates — Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!body.subject) {
      return NextResponse.json(
        { error: "subject is required" },
        { status: 400 }
      );
    }

    if (!body.bodyHtml) {
      return NextResponse.json(
        { error: "bodyHtml is required" },
        { status: 400 }
      );
    }

    if (!body.templateType) {
      return NextResponse.json(
        { error: "templateType is required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: body.name,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        templateType: body.templateType,
        sequenceNumber: body.sequenceNumber ?? null,
        fromAddress: body.fromAddress ?? "nick@signature-cleans.co.uk",
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/email-templates error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid template data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create email template" },
      { status: 500 }
    );
  }
}
