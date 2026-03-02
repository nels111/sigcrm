import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// POST /api/feedback — Create a feedback request (generate token)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, contactName, contactEmail } = body;

    if (!contractId) {
      return NextResponse.json(
        { error: "contractId is required" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, contractName: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");

    const feedback = await prisma.clientFeedback.create({
      data: {
        contractId,
        token,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
      },
    });

    return NextResponse.json({
      data: {
        id: feedback.id,
        token: feedback.token,
        feedbackUrl: `/feedback/${feedback.token}`,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to create feedback request" },
      { status: 500 }
    );
  }
}

// GET /api/feedback?contractId=xxx — List feedback for a contract
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");

    if (!contractId) {
      return NextResponse.json(
        { error: "contractId is required" },
        { status: 400 }
      );
    }

    const feedbacks = await prisma.clientFeedback.findMany({
      where: { contractId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: feedbacks });
  } catch (error) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
