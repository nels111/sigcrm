import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BulkAction = "assign" | "tag" | "startCadence" | "delete";

interface BulkRequestBody {
  action: BulkAction;
  leadIds: string[];
  data?: {
    assignedTo?: string;
    tag?: string;
  };
}

// POST /api/leads/bulk — Bulk actions on leads
export async function POST(request: NextRequest) {
  try {
    const body: BulkRequestBody = await request.json();
    const { action, leadIds, data } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const validActions: BulkAction[] = ["assign", "tag", "startCadence", "delete"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Common where clause: only affect non-deleted leads in the provided IDs
    const where = {
      id: { in: leadIds },
      deletedAt: null,
    };

    let result;

    switch (action) {
      case "assign": {
        if (!data?.assignedTo) {
          return NextResponse.json(
            { error: "data.assignedTo is required for assign action" },
            { status: 400 }
          );
        }

        // Verify the user exists
        const user = await prisma.user.findUnique({
          where: { id: data.assignedTo },
          select: { id: true },
        });

        if (!user) {
          return NextResponse.json(
            { error: "Assigned user not found" },
            { status: 404 }
          );
        }

        result = await prisma.lead.updateMany({
          where,
          data: { assignedTo: data.assignedTo },
        });
        break;
      }

      case "tag": {
        if (!data?.tag) {
          return NextResponse.json(
            { error: "data.tag is required for tag action" },
            { status: 400 }
          );
        }

        // Tags are stored as a String[] array — we need to add the tag to each lead
        // Prisma does not support array push in updateMany, so we process individually
        const leadsToTag = await prisma.lead.findMany({
          where,
          select: { id: true, tags: true },
        });

        const tagUpdates = leadsToTag.map((lead) => {
          const currentTags = lead.tags || [];
          if (currentTags.includes(data.tag!)) {
            return null; // Already has this tag
          }
          return prisma.lead.update({
            where: { id: lead.id },
            data: { tags: [...currentTags, data.tag!] },
          });
        }).filter(Boolean);

        await Promise.all(tagUpdates);

        result = { count: leadsToTag.length };
        break;
      }

      case "startCadence": {
        result = await prisma.lead.updateMany({
          where,
          data: {
            cadenceStatus: "ActiveInCadence",
            cadenceStep: 0,
          },
        });
        break;
      }

      case "delete": {
        result = await prisma.lead.updateMany({
          where,
          data: { deletedAt: new Date() },
        });
        break;
      }
    }

    return NextResponse.json({
      message: `Bulk ${action} completed successfully`,
      affected: result?.count ?? 0,
    });
  } catch (error) {
    console.error("POST /api/leads/bulk error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
