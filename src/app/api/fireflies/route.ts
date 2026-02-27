import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;

interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  duration: number;
  transcript_url: string;
  summary: {
    overview: string;
    action_items: string[];
    keywords: string[];
  };
  sentences: Array<{
    speaker_name: string;
    text: string;
  }>;
}

// POST /api/fireflies — Attach Fireflies transcript to a record
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!FIREFLIES_API_KEY) {
      return NextResponse.json(
        { error: "Fireflies API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { meetingId, entityType, entityId } = body;

    if (!meetingId) {
      return NextResponse.json(
        { error: "meetingId is required" },
        { status: 400 }
      );
    }

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    const validEntityTypes = ["deal", "lead", "contact", "account", "contract"];
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        {
          error: `entityType must be one of: ${validEntityTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Fetch transcript + summary from Fireflies GraphQL API
    const query = `
      query Transcript($transcriptId: String!) {
        transcript(id: $transcriptId) {
          id
          title
          date
          duration
          transcript_url
          summary {
            overview
            action_items
            keywords
          }
          sentences {
            speaker_name
            text
          }
        }
      }
    `;

    const firefliesResponse = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        variables: { transcriptId: meetingId },
      }),
    });

    if (!firefliesResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch transcript from Fireflies" },
        { status: 502 }
      );
    }

    const firefliesData = await firefliesResponse.json();

    if (firefliesData.errors) {
      console.error("Fireflies GraphQL errors:", firefliesData.errors);
      return NextResponse.json(
        { error: "Fireflies API returned errors", details: firefliesData.errors },
        { status: 502 }
      );
    }

    const transcript: FirefliesTranscript = firefliesData.data?.transcript;

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found in Fireflies" },
        { status: 404 }
      );
    }

    // Build summary body from Fireflies data
    const summaryParts: string[] = [];
    if (transcript.title) {
      summaryParts.push(`Meeting: ${transcript.title}`);
    }
    if (transcript.summary?.overview) {
      summaryParts.push(`\nOverview:\n${transcript.summary.overview}`);
    }
    if (transcript.summary?.action_items?.length) {
      summaryParts.push(
        `\nAction Items:\n${transcript.summary.action_items.map((item) => `- ${item}`).join("\n")}`
      );
    }
    if (transcript.summary?.keywords?.length) {
      summaryParts.push(
        `\nKeywords: ${transcript.summary.keywords.join(", ")}`
      );
    }

    const activityBody = summaryParts.join("\n") || "Fireflies transcript attached";

    // Build activity data with entity linking
    const activityData: Prisma.ActivityCreateInput = {
      activityType: "fireflies_transcript",
      subject: `Fireflies: ${transcript.title || "Meeting Transcript"}`,
      body: activityBody,
      firefliesMeetingId: meetingId,
      firefliesUrl: transcript.transcript_url || null,
      metadata: {
        duration: transcript.duration,
        date: transcript.date,
        keywords: transcript.summary?.keywords || [],
      },
      performer: { connect: { id: session.user.id } },
    };

    // Link to the appropriate entity
    const entityLinkField = `${entityType}` as const;
    switch (entityLinkField) {
      case "deal":
        activityData.deal = { connect: { id: entityId } };
        break;
      case "lead":
        activityData.lead = { connect: { id: entityId } };
        break;
      case "contact":
        activityData.contact = { connect: { id: entityId } };
        break;
      case "account":
        activityData.account = { connect: { id: entityId } };
        break;
      case "contract":
        activityData.contract = { connect: { id: entityId } };
        break;
    }

    // Create the activity record
    const activity = await prisma.activity.create({
      data: activityData,
      include: {
        performer: {
          select: { id: true, name: true, email: true },
        },
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        contract: { select: { id: true, contractName: true } },
      },
    });

    // Extract action items from Fireflies and create Task records
    const tasks = [];
    if (transcript.summary?.action_items?.length) {
      for (const actionItem of transcript.summary.action_items) {
        const task = await prisma.task.create({
          data: {
            title: actionItem.length > 255 ? actionItem.slice(0, 252) + "..." : actionItem,
            description: `Auto-generated from Fireflies transcript: ${transcript.title || meetingId}`,
            assignedTo: session.user.id,
            createdBy: session.user.id,
            taskType: "business",
            priority: "medium",
            autoGenerated: true,
            sourceWorkflow: "fireflies_transcript",
            ...(entityType === "deal" ? { dealId: entityId } : {}),
            ...(entityType === "lead" ? { leadId: entityId } : {}),
            ...(entityType === "contact" ? { contactId: entityId } : {}),
            ...(entityType === "account" ? { accountId: entityId } : {}),
            ...(entityType === "contract" ? { contractId: entityId } : {}),
          },
        });
        tasks.push(task);
      }
    }

    return NextResponse.json(
      {
        data: {
          activity,
          tasks,
          transcript: {
            id: transcript.id,
            title: transcript.title,
            duration: transcript.duration,
            url: transcript.transcript_url,
            actionItemsCount: transcript.summary?.action_items?.length || 0,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/fireflies error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Linked entity not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process Fireflies transcript" },
      { status: 500 }
    );
  }
}
