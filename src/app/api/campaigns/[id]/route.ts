import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/campaigns/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        emailTemplate: {
          select: { id: true, name: true, subject: true, bodyHtml: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ data: campaign });
  } catch (error) {
    console.error("GET /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// PUT /api/campaigns/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        audienceFilter: body.audienceFilter,
        emailTemplateId: body.emailTemplateId,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        status: body.status,
      },
      include: {
        emailTemplate: {
          select: { id: true, name: true, subject: true },
        },
      },
    });

    return NextResponse.json({ data: campaign });
  } catch (error) {
    console.error("PUT /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id]
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ message: "Campaign deleted" });
  } catch (error) {
    console.error("DELETE /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
