import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, NotificationType } from "@prisma/client";

// GET /api/notifications — List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
    };

    // Filter by read status
    const readParam = searchParams.get("read");
    if (readParam === "true") {
      where.read = true;
    } else if (readParam === "false") {
      where.read = false;
    }

    // Filter by notification type
    const notificationType = searchParams.get("notificationType");
    if (notificationType) {
      where.notificationType = notificationType as NotificationType;
    }

    // Execute count and findMany in parallel
    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST /api/notifications — Create a notification (internal use / testing)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.userId || !body.title || !body.message || !body.notificationType) {
      return NextResponse.json(
        {
          error:
            "userId, title, message, and notificationType are required",
        },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        userId: body.userId,
        title: body.title,
        message: body.message,
        notificationType: body.notificationType,
        linkUrl: body.linkUrl || null,
        entityType: body.entityType || null,
        entityId: body.entityId || null,
      },
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid notification data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
