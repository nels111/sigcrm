import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/feedback/[token] — Lookup by token, return contract info
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;

    const feedback = await prisma.clientFeedback.findUnique({
      where: { token },
      include: {
        contract: {
          select: {
            id: true,
            contractName: true,
            account: { select: { name: true } },
          },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback request not found" },
        { status: 404 }
      );
    }

    if (feedback.submittedAt) {
      return NextResponse.json({
        data: {
          alreadySubmitted: true,
          contractName: feedback.contract.contractName,
          companyName: feedback.contract.account?.name || null,
        },
      });
    }

    return NextResponse.json({
      data: {
        alreadySubmitted: false,
        contractName: feedback.contract.contractName,
        companyName: feedback.contract.account?.name || null,
        contactName: feedback.contactName,
        contactEmail: feedback.contactEmail,
      },
    });
  } catch (error) {
    console.error("GET /api/feedback/[token] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// POST /api/feedback/[token] — Save ratings
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json();

    const feedback = await prisma.clientFeedback.findUnique({
      where: { token },
    });

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback request not found" },
        { status: 404 }
      );
    }

    if (feedback.submittedAt) {
      return NextResponse.json(
        { error: "Feedback has already been submitted" },
        { status: 400 }
      );
    }

    const { overallRating, cleaningQuality, staffBehaviour, communication, valueForMoney, comments, contactName, contactEmail } = body;

    if (!overallRating || overallRating < 1 || overallRating > 10) {
      return NextResponse.json(
        { error: "overallRating must be between 1 and 10" },
        { status: 400 }
      );
    }

    const updated = await prisma.clientFeedback.update({
      where: { token },
      data: {
        overallRating,
        cleaningQuality: cleaningQuality || null,
        staffBehaviour: staffBehaviour || null,
        communication: communication || null,
        valueForMoney: valueForMoney || null,
        comments: comments || null,
        contactName: contactName || feedback.contactName,
        contactEmail: contactEmail || feedback.contactEmail,
        submittedAt: new Date(),
      },
    });

    // Log activity on the contract
    await prisma.activity.create({
      data: {
        activityType: "note",
        subject: "Client feedback received",
        body: `Overall rating: ${overallRating}/10. ${comments ? `Comments: "${comments}"` : "No comments."}`,
        contractId: feedback.contractId,
      },
    });

    return NextResponse.json({
      data: { submitted: true, id: updated.id },
    });
  } catch (error) {
    console.error("POST /api/feedback/[token] error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
