import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  QuoteStatus,
  SiteType,
  LeadSource,
  LeadStatus,
  DealStage,
} from "@prisma/client";
import { calculateQuote } from "@/lib/quote-calculator";
import { getScopeOfWorks } from "@/lib/scope-of-works";

// ──────────────────────────────────────────────
// GET /api/quotes — List quotes with pagination, search, filters
// ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    // Build where clause
    const where: Prisma.QuoteWhereInput = {};

    // Search by company name, contact name, or quote ref
    const search = searchParams.get("search");
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { quoteRef: { contains: search, mode: "insensitive" } },
        { contactEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by status
    const status = searchParams.get("status");
    if (status) {
      where.status = status as QuoteStatus;
    }

    // Filter by dealId
    const dealId = searchParams.get("dealId");
    if (dealId) {
      where.dealId = dealId;
    }

    // Filter by leadId
    const leadId = searchParams.get("leadId");
    if (leadId) {
      where.leadId = leadId;
    }

    // Filter by siteType
    const siteType = searchParams.get("siteType");
    if (siteType) {
      where.siteType = siteType as SiteType;
    }

    // Execute count and findMany in parallel
    const [total, quotes] = await Promise.all([
      prisma.quote.count({ where }),
      prisma.quote.findMany({
        where,
        include: {
          deal: {
            select: { id: true, name: true, stage: true },
          },
          lead: {
            select: { id: true, companyName: true, leadStatus: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: quotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/quotes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quotes" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/quotes — Full quote creation workflow
// ──────────────────────────────────────────────

interface QuoteCreateBody {
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  hoursPerDay: number;
  frequencyPerWeek: number;
  daysSelected: string[];
  siteType: SiteType;
  marginPercent: number;
  productCostWeekly?: number;
  overheadCostWeekly?: number;
  applyPilotPricing?: boolean;
  // Optional: pre-link to existing records
  existingLeadId?: string;
  existingAccountId?: string;
  existingContactId?: string;
  existingDealId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: QuoteCreateBody = await request.json();

    // Validate required fields
    const requiredFields = [
      "companyName",
      "address",
      "contactName",
      "contactEmail",
      "hoursPerDay",
      "frequencyPerWeek",
      "daysSelected",
      "siteType",
      "marginPercent",
    ] as const;

    for (const field of requiredFields) {
      if (body[field] == null || body[field] === "") {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate numeric ranges
    if (body.hoursPerDay <= 0 || body.hoursPerDay > 24) {
      return NextResponse.json(
        { error: "hoursPerDay must be between 0.5 and 24" },
        { status: 400 }
      );
    }
    if (body.frequencyPerWeek < 1 || body.frequencyPerWeek > 7) {
      return NextResponse.json(
        { error: "frequencyPerWeek must be between 1 and 7" },
        { status: 400 }
      );
    }
    if (body.marginPercent < 0 || body.marginPercent >= 100) {
      return NextResponse.json(
        { error: "marginPercent must be between 0 and 99" },
        { status: 400 }
      );
    }

    // ── Step 1: Run calculator ──
    const calc = calculateQuote({
      companyName: body.companyName,
      address: body.address,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      hoursPerDay: body.hoursPerDay,
      frequencyPerWeek: body.frequencyPerWeek,
      daysSelected: body.daysSelected,
      siteType: body.siteType,
      marginPercent: body.marginPercent,
      productCostWeekly: body.productCostWeekly,
      overheadCostWeekly: body.overheadCostWeekly,
      applyPilotPricing: body.applyPilotPricing,
    });

    // If blocked by guardrails, return errors without creating any records
    if (calc.blocked) {
      return NextResponse.json(
        {
          error: "Quote blocked by pricing guardrails",
          guardrailErrors: calc.errors,
          calculation: {
            impliedSellRate: calc.impliedSellRate,
            grossMarginPercent: calc.grossMarginPercent,
            weeklyCharge: calc.weeklyCharge,
            monthlyTotal: calc.monthlyTotal,
          },
        },
        { status: 422 }
      );
    }

    // ── Step 2: Auto-select scope of works ──
    const scopeOfWorks = getScopeOfWorks(body.siteType);

    // ── Step 3: Full workflow in a Prisma transaction ──
    const result = await prisma.$transaction(async (tx) => {
      // ── 3a: Duplicate check & Lead creation/lookup ──
      let leadId = body.existingLeadId || null;

      if (!leadId) {
        // Search for existing lead by email
        const existingLead = await tx.lead.findFirst({
          where: {
            contactEmail: body.contactEmail,
            deletedAt: null,
          },
        });

        if (existingLead) {
          leadId = existingLead.id;
          // Update lead status to QuoteSent
          await tx.lead.update({
            where: { id: leadId },
            data: { leadStatus: LeadStatus.QuoteSent },
          });
        } else {
          // Create new lead
          const newLead = await tx.lead.create({
            data: {
              companyName: body.companyName,
              contactName: body.contactName,
              contactEmail: body.contactEmail,
              contactPhone: body.contactPhone || null,
              address: body.address,
              leadSource: LeadSource.QuoteForm,
              leadStatus: LeadStatus.QuoteSent,
              engagementStage: "Quoted",
            },
          });
          leadId = newLead.id;
        }
      }

      // ── 3b: Account creation/lookup ──
      let accountId = body.existingAccountId || null;

      if (!accountId) {
        // Search for existing account by company name
        const existingAccount = await tx.account.findFirst({
          where: {
            name: { equals: body.companyName, mode: "insensitive" },
            deletedAt: null,
          },
        });

        if (existingAccount) {
          accountId = existingAccount.id;
        } else {
          const newAccount = await tx.account.create({
            data: {
              name: body.companyName,
              address: body.address,
            },
          });
          accountId = newAccount.id;
        }
      }

      // ── 3c: Contact creation/lookup ──
      let contactId = body.existingContactId || null;

      if (!contactId) {
        // Search for existing contact by email
        const existingContact = body.contactEmail
          ? await tx.contact.findFirst({
              where: {
                email: body.contactEmail,
                deletedAt: null,
              },
            })
          : null;

        if (existingContact) {
          contactId = existingContact.id;
          // Link contact to account if not already linked
          if (!existingContact.accountId && accountId) {
            await tx.contact.update({
              where: { id: contactId },
              data: { accountId },
            });
          }
        } else {
          // Parse contact name into first/last
          const nameParts = body.contactName.trim().split(/\s+/);
          const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : null;
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

          const newContact = await tx.contact.create({
            data: {
              firstName,
              lastName,
              email: body.contactEmail,
              phone: body.contactPhone || null,
              accountId,
              isPrimary: true,
            },
          });
          contactId = newContact.id;
        }
      }

      // ── 3d: Deal creation or lookup ──
      let dealId = body.existingDealId || null;

      if (!dealId) {
        const weeklyHours = body.hoursPerDay * body.frequencyPerWeek;
        const newDeal = await tx.deal.create({
          data: {
            name: `${body.companyName} — Cleaning Quote`,
            accountId,
            contactId,
            leadId,
            stage: DealStage.QuoteSent,
            probability: 40,
            amount: calc.annualTotal,
            monthlyValue: calc.monthlyTotal,
            weeklyValue: calc.weeklyCharge,
            weeklyHours: weeklyHours,
            dealType: "recurring",
            stageChangedAt: new Date(),
          },
        });
        dealId = newDeal.id;

        // Update lead with converted deal reference
        if (leadId) {
          await tx.lead.update({
            where: { id: leadId },
            data: { convertedToDealId: dealId },
          });
        }
      }

      // ── 3e: Create the Quote record ──
      const quote = await tx.quote.create({
        data: {
          dealId,
          leadId,
          quoteRef: calc.quoteRef,
          // Form inputs
          companyName: body.companyName,
          address: body.address,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone || null,
          hoursPerDay: body.hoursPerDay,
          frequencyPerWeek: body.frequencyPerWeek,
          daysSelected: body.daysSelected,
          siteType: body.siteType,
          marginPercent: body.marginPercent,
          productCostWeekly: body.productCostWeekly || 0,
          overheadCostWeekly: body.overheadCostWeekly || 0,
          applyPilotPricing: body.applyPilotPricing || false,
          // Calculated values
          hourlyRate: calc.hourlyRate,
          weeklyLabourCost: calc.weeklyLabourCost,
          totalWeeklySpend: calc.totalWeeklySpend,
          weeklyCharge: calc.weeklyCharge,
          monthlyTotal: calc.monthlyTotal,
          annualTotal: calc.annualTotal,
          weeklyProfit: calc.weeklyProfit,
          monthlyProfit: calc.monthlyProfit,
          // Pilot pricing
          pilotMonthlyTotal: calc.pilot?.pilotMonthlyTotal ?? null,
          pilotSavings: calc.pilot?.pilotSavings ?? null,
          pilotStartDate: calc.pilot?.pilotStartDate ?? null,
          pilotEndDate: calc.pilot?.pilotEndDate ?? null,
          pilotReviewDate: calc.pilot?.pilotReviewDate ?? null,
          standardPricingStartDate: calc.pilot?.standardPricingStartDate ?? null,
          // Scope
          scopeOfWorks,
          // Status
          status: "draft",
        },
        include: {
          deal: {
            select: { id: true, name: true, stage: true },
          },
          lead: {
            select: { id: true, companyName: true, leadStatus: true },
          },
        },
      });

      // ── 3f: Activity log on the deal ──
      await tx.activity.create({
        data: {
          activityType: "quote_sent",
          subject: `Quote ${calc.quoteRef} created`,
          body: `Quote generated for ${body.companyName}. Monthly total: \u00a3${calc.monthlyTotal}. Annual value: \u00a3${calc.annualTotal}.${calc.pilot ? ` Pilot pricing applied: \u00a3${calc.pilot.pilotMonthlyTotal}/month for 30 days.` : ""}`,
          dealId,
          leadId,
          accountId,
          metadata: {
            quoteId: quote.id,
            quoteRef: calc.quoteRef,
            monthlyTotal: calc.monthlyTotal,
            annualTotal: calc.annualTotal,
            siteType: body.siteType,
            warnings: calc.warnings,
          },
        },
      });

      return {
        quote,
        linkedRecords: {
          leadId,
          accountId,
          contactId,
          dealId,
        },
        calculation: {
          impliedSellRate: calc.impliedSellRate,
          grossMarginPercent: calc.grossMarginPercent,
        },
        warnings: calc.warnings,
      };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/quotes error:", error);

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid quote data provided" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}
