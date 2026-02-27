import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/activities/[id] — Fetch a single activity with related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        performer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        deal: {
          select: { id: true, name: true, stage: true },
        },
        lead: {
          select: { id: true, companyName: true, contactName: true, leadStatus: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        account: {
          select: { id: true, name: true },
        },
        contract: {
          select: { id: true, contractName: true, status: true },
        },
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error("GET /api/activities/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
