import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/campaigns — List campaigns
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const where: Prisma.CampaignWhereInput = {};
    if (status) {
      where.status = status as Prisma.EnumCampaignStatusFilter;
    }

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        include: {
          emailTemplate: {
            select: { id: true, name: true, subject: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: campaigns,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/campaigns error:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

// POST /api/campaigns — Create a campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        description: body.description,
        audienceFilter: body.audienceFilter || {},
        emailTemplateId: body.emailTemplateId || null,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        status: body.status || "draft",
      },
      include: {
        emailTemplate: {
          select: { id: true, name: true, subject: true },
        },
      },
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    console.error("POST /api/campaigns error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
