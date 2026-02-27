import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LeadSource, CadenceStatus } from "@prisma/client";

// CORS headers for cross-domain landing page access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// Map string lead source values to the LeadSource enum
function resolveLeadSource(source?: string): LeadSource {
  if (!source) return "LandingPage";

  const sourceMap: Record<string, LeadSource> = {
    LandingPage: "LandingPage",
    "Landing Page": "LandingPage",
    GoogleAds: "GoogleAds",
    "Google Ads": "GoogleAds",
    ColdCall: "ColdCall",
    "Cold Call": "ColdCall",
    Referral: "Referral",
    NetworkEvent: "NetworkEvent",
    "Network Event": "NetworkEvent",
    ApolloAI: "ApolloAI",
    "Apollo AI": "ApolloAI",
    LinkedIn: "LinkedIn",
    Facebook: "Facebook",
    XTwitter: "XTwitter",
    "X (Twitter)": "XTwitter",
    WebResearch: "WebResearch",
    "Web Research": "WebResearch",
    Chat: "Chat",
    Seminar: "Seminar",
    TradeShow: "TradeShow",
    "Trade Show": "TradeShow",
    QuickCapture: "QuickCapture",
    "Quick Capture": "QuickCapture",
    QuoteForm: "QuoteForm",
    "Quote Form": "QuoteForm",
  };

  return sourceMap[source] || "LandingPage";
}

// Determine cadence status based on lead source
function resolveCadenceStatus(leadSource: LeadSource): CadenceStatus {
  if (leadSource === "LandingPage" || leadSource === "GoogleAds") {
    return "ActiveInCadence";
  }
  return "NotStarted";
}

// OPTIONS /api/leads/capture — CORS preflight handler
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// POST /api/leads/capture — Landing page lead capture
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      company_name,
      contact_name,
      contact_email,
      contact_phone,
      lead_source,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
    } = body;

    // Validate required fields
    if (!company_name || !contact_name || !contact_email) {
      return NextResponse.json(
        { error: "company_name, contact_name, and contact_email are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Duplicate check by contactEmail
    const existingLead = await prisma.lead.findFirst({
      where: {
        contactEmail: {
          equals: contact_email,
          mode: "insensitive",
        },
        deletedAt: null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (existingLead) {
      return NextResponse.json(
        {
          data: existingLead,
          duplicate: true,
          message: "Lead already exists with this email",
          conversionTracking: {
            googleAdsTag: "AW-17927539037",
            conversionLabel: "AW-17927539037/ZoDcCMXb_fUbEN2SwuRC",
          },
        },
        { headers: corsHeaders }
      );
    }

    // Look up Nick (sales) and Nelson (admin)
    const [nickUser, nelsonUser] = await Promise.all([
      prisma.user.findFirst({ where: { role: "sales" } }),
      prisma.user.findFirst({ where: { role: "admin" } }),
    ]);

    if (!nickUser) {
      console.error("Lead capture: No sales user found");
      return NextResponse.json(
        { error: "No sales user configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const leadSource = resolveLeadSource(lead_source);
    const cadenceStatus = resolveCadenceStatus(leadSource);

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        companyName: company_name,
        contactName: contact_name,
        contactEmail: contact_email,
        contactPhone: contact_phone || null,
        leadStatus: "NewLead",
        engagementStage: "NeverEngaged",
        leadSource: leadSource,
        cadenceStatus: cadenceStatus,
        assignedTo: nickUser.id,
        utmSource: utm_source || null,
        utmMedium: utm_medium || null,
        utmCampaign: utm_campaign || null,
        utmTerm: utm_term || null,
        utmContent: utm_content || null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Calculate due date: 24 hours from now
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 24);

    // Create Task for Nick: follow up on new lead
    const taskPromise = prisma.task.create({
      data: {
        title: `Follow up on new lead: ${company_name}`,
        description: `New lead captured from ${leadSource === "LandingPage" ? "landing page" : lead_source || "landing page"}. Contact: ${contact_name} (${contact_email})`,
        assignedTo: nickUser.id,
        createdBy: nickUser.id,
        taskType: "business",
        priority: "high",
        status: "pending",
        dueDate: dueDate,
        leadId: lead.id,
        autoGenerated: true,
        sourceWorkflow: "lead_capture",
      },
    });

    // Create Notifications for Nick and Nelson
    const sourceLabel = lead_source || "landing page";
    const notificationPromises = [
      prisma.notification.create({
        data: {
          userId: nickUser.id,
          title: "New lead from landing page",
          message: `New lead from landing page: ${company_name}`,
          notificationType: "new_lead",
          entityType: "lead",
          entityId: lead.id,
          linkUrl: `/leads/${lead.id}`,
        },
      }),
    ];

    if (nelsonUser) {
      notificationPromises.push(
        prisma.notification.create({
          data: {
            userId: nelsonUser.id,
            title: "New lead from landing page",
            message: `New lead from landing page: ${company_name}`,
            notificationType: "new_lead",
            entityType: "lead",
            entityId: lead.id,
            linkUrl: `/leads/${lead.id}`,
          },
        })
      );
    }

    // Create Activity
    const activityPromise = prisma.activity.create({
      data: {
        activityType: "note",
        subject: `Lead captured from ${sourceLabel}`,
        body: `New lead captured. Company: ${company_name}, Contact: ${contact_name} (${contact_email})${utm_source ? `. UTM Source: ${utm_source}` : ""}${utm_campaign ? `, Campaign: ${utm_campaign}` : ""}`,
        leadId: lead.id,
        performedBy: nickUser.id,
      },
    });

    // Execute task, notifications, and activity in parallel
    await Promise.all([
      taskPromise,
      ...notificationPromises,
      activityPromise,
    ]);

    return NextResponse.json(
      {
        data: lead,
        conversionTracking: {
          googleAdsTag: "AW-17927539037",
          conversionLabel: "AW-17927539037/ZoDcCMXb_fUbEN2SwuRC",
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("POST /api/leads/capture error:", error);
    return NextResponse.json(
      { error: "Failed to capture lead" },
      { status: 500, headers: corsHeaders }
    );
  }
}
