/**
 * Zoho Data Fix Script
 *
 * Re-fetches data from Zoho CRM and corrects stage mappings, amounts,
 * deal types, probabilities, monthly values, and lead statuses that
 * were incorrectly mapped during the initial migration.
 *
 * Usage:
 *   npx tsx scripts/zoho-fix-data.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const ZOHO_API_DOMAIN =
  process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.eu";
const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.eu";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// OAuth2
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
  });

  const url = `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params.toString()}`;
  const response = await fetch(url, { method: "POST" });
  const data = await response.json();

  if (!data.access_token) {
    throw new Error(`Zoho OAuth error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Fetch All Records (paginated)
// ---------------------------------------------------------------------------

async function fetchAll(
  token: string,
  module: string,
  fields: string
): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${ZOHO_API_DOMAIN}/crm/v7/${module}?page=${page}&per_page=200&fields=${fields}`;
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    if (res.status === 204) break;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (data.data) all.push(...data.data);
    hasMore = data.info?.more_records === true;
    page++;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Corrected Deal Stage Mapping
// ---------------------------------------------------------------------------

interface DealMapping {
  stage: string;
  dealType: "recurring" | "one_off";
  probability: number;
  lossReason?: string;
}

function mapZohoDeal(
  zohoStage: string | null,
  zohoType: string | null
): DealMapping {
  const s = (zohoStage || "").toLowerCase().trim();

  // Determine if the Zoho Type suggests recurring or one-off
  const typeIsRecurring =
    zohoType?.toLowerCase() === "existing business" || !zohoType;
  const typeIsOneOff = zohoType?.toLowerCase() === "new business";

  // --- Won stages ---
  if (s === "closed won (recurring)") {
    return { stage: "Closed Won Recurring", dealType: "recurring", probability: 100 };
  }
  if (s === "closed won") {
    // Zoho distinguishes "Closed Won" from "Closed Won (Recurring)"
    // so plain "Closed Won" = one-off unless Type says Existing Business
    const isRecurring = !typeIsOneOff && typeIsRecurring;
    return {
      stage: isRecurring ? "Closed Won Recurring" : "Closed Won One-Off",
      dealType: isRecurring ? "recurring" : "one_off",
      probability: 100,
    };
  }

  // --- Lost stages ---
  if (s === "closed lost (recurring)") {
    return {
      stage: "Closed Lost Recurring",
      dealType: "recurring",
      probability: 0,
      lossReason: "Other",
    };
  }
  if (s === "closed lost to competition") {
    const isRecurring = !typeIsOneOff;
    return {
      stage: isRecurring ? "Closed Lost Recurring" : "Closed Lost One-Off",
      dealType: isRecurring ? "recurring" : "one_off",
      probability: 0,
      lossReason: "Competitor",
    };
  }
  if (s === "closed lost") {
    const isRecurring = !typeIsOneOff;
    return {
      stage: isRecurring ? "Closed Lost Recurring" : "Closed Lost One-Off",
      dealType: isRecurring ? "recurring" : "one_off",
      probability: 0,
      lossReason: "Other",
    };
  }

  // --- Active stages ---
  if (s === "qualification") {
    return { stage: "New Lead", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 10 };
  }
  if (s === "needs analysis" || s === "appt attended" || s === "site survey booked") {
    return { stage: "Survey Complete", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 40 };
  }
  if (
    s === "cleaning boost mail sent" ||
    s === "identify decision makers" ||
    s === "value proposition"
  ) {
    return { stage: "Contacted", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 20 };
  }
  if (s === "proposal/price quote") {
    return { stage: "Quote Sent", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 60 };
  }
  if (s === "negotiation/review" || s === "negotiation") {
    return { stage: "Negotiation", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 75 };
  }

  // Default
  return { stage: "Contacted", dealType: typeIsOneOff ? "one_off" : "recurring", probability: 20 };
}

// ---------------------------------------------------------------------------
// Corrected Lead Status Mapping
// ---------------------------------------------------------------------------

function mapZohoLeadStatus(zohoStatus: string | null): string {
  const s = (zohoStatus || "").toLowerCase().trim();

  const mapping: Record<string, string> = {
    "new lead": "New Lead",
    contacted: "Contacted",
    "warm lead": "Contacted",
    "meeting booked": "Meeting Booked",
    "incoming call": "Incoming Call",
    "business won": "Ongoing Customer",
    "junk lead": "New Lead",
    "not contacted": "New Lead",
    "attempted to contact": "Contacted",
    "contact in future": "New Lead",
    "pre-qualified": "Contacted",
    qualified: "Meeting Booked",
    lost: "New Lead",
  };

  return mapping[s] || "New Lead";
}

// ---------------------------------------------------------------------------
// Lead Source Mapping
// ---------------------------------------------------------------------------

function mapZohoLeadSource(zohoSource: string | null): string | null {
  if (!zohoSource) return null;
  const s = zohoSource.toLowerCase().trim();

  const mapping: Record<string, string> = {
    "landing page": "Landing Page",
    referral: "Referral",
    linkedin: "LinkedIn",
    "cold call": "Cold Call",
    "web research": "Web Research",
    "web download": "Web Research",
    website: "Web Research",
    web: "Web Research",
    advertisement: "Google Ads",
    "google ads": "Google Ads",
    facebook: "Facebook",
    seminar: "Seminar",
    "trade show": "Trade Show",
    chat: "Chat",
  };

  return mapping[s] || null;
}

// ---------------------------------------------------------------------------
// Industry Mapping
// ---------------------------------------------------------------------------

function mapIndustry(zohoIndustry: string | null): string | null {
  if (!zohoIndustry) return null;
  const lower = zohoIndustry.toLowerCase().trim();

  const mapping: Record<string, string> = {
    pbsa: "PBSA",
    "post construction": "PostConstruction",
    "post-construction": "PostConstruction",
    "bio hazard": "BioHazard",
    biohazard: "BioHazard",
    industrial: "Industrial",
    "commercial offices": "CommercialOffices",
    "commercial (general)": "CommercialGeneral",
    commercial: "CommercialGeneral",
    "care sector": "CareSector",
    care: "CareSector",
    school: "School",
    education: "School",
    leisure: "Leisure",
    "dental/medical": "DentalMedical",
    dental: "DentalMedical",
    medical: "DentalMedical",
    "hospitality/venue": "HospitalityVenue",
    hospitality: "HospitalityVenue",
    "welfare/construction": "WelfareConstruction",
    welfare: "WelfareConstruction",
    construction: "WelfareConstruction",
  };

  return mapping[lower] || null;
}

// ---------------------------------------------------------------------------
// Fix Deals
// ---------------------------------------------------------------------------

async function fixDeals(token: string): Promise<void> {
  console.log("\n=== FIXING DEALS ===\n");

  const zohoDeals = await fetchAll(
    token,
    "Deals",
    "Deal_Name,Stage,Amount,Type,Probability,Closing_Date,Account_Name,Contact_Name,Description"
  );

  console.log(`Fetched ${zohoDeals.length} deals from Zoho\n`);

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Build account name → id lookup from our DB
  const accounts = await prisma.account.findMany({ select: { id: true, name: true } });
  const accountNameToId = new Map<string, string>();
  for (const a of accounts) {
    accountNameToId.set(a.name.toLowerCase(), a.id);
  }

  for (const zd of zohoDeals) {
    try {
      const name = zd.Deal_Name;
      if (!name) {
        skipped++;
        continue;
      }

      const mapping = mapZohoDeal(zd.Stage, zd.Type);

      // Parse amount
      const amount =
        zd.Amount != null && zd.Amount !== ""
          ? new Prisma.Decimal(zd.Amount)
          : null;

      // Calculate monthly value for recurring deals
      let monthlyValue: Prisma.Decimal | null = null;
      if (amount && mapping.dealType === "recurring") {
        monthlyValue = new Prisma.Decimal(
          (Number(amount) / 12).toFixed(2)
        );
      }

      // Parse closing date
      let expectedCloseDate: Date | null = null;
      if (zd.Closing_Date) {
        expectedCloseDate = new Date(zd.Closing_Date);
      }

      // Find account id
      let accountId: string | null = null;
      if (zd.Account_Name?.name) {
        accountId =
          accountNameToId.get(zd.Account_Name.name.toLowerCase()) || null;
      }

      // Find matching deal in our DB
      const existing = await prisma.deal.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          ...(accountId ? { accountId } : {}),
        },
      });

      if (existing) {
        // Update the existing deal
        await prisma.deal.update({
          where: { id: existing.id },
          data: {
            stage: mapping.stage as any,
            dealType: mapping.dealType as any,
            probability: mapping.probability,
            amount,
            monthlyValue,
            expectedCloseDate,
            lossReason: mapping.lossReason as any,
            notes: zd.Description || existing.notes,
          },
        });

        console.log(
          `  UPDATED: ${name} → ${mapping.stage} (${mapping.dealType}) £${amount || 0} | monthly: £${monthlyValue || "N/A"}`
        );
        updated++;
      } else {
        // This deal doesn't exist yet (was a duplicate skipped in migration)
        // Resolve owner from first available user
        const defaultUser = await prisma.user.findFirst({
          select: { id: true },
        });

        await prisma.deal.create({
          data: {
            name,
            stage: mapping.stage as any,
            dealType: mapping.dealType as any,
            probability: mapping.probability,
            amount,
            monthlyValue,
            expectedCloseDate,
            accountId,
            lossReason: mapping.lossReason as any,
            notes: zd.Description || null,
            assignedTo: defaultUser?.id || null,
            createdAt: zd.Created_Time
              ? new Date(zd.Created_Time)
              : undefined,
          },
        });

        console.log(
          `  CREATED: ${name} → ${mapping.stage} (${mapping.dealType}) £${amount || 0}`
        );
        created++;
      }
    } catch (err: any) {
      console.error(
        `  ERROR: ${zd.Deal_Name}: ${err.message}`
      );
      errors++;
    }
  }

  console.log(
    `\nDeals: ${updated} updated, ${created} created, ${skipped} skipped, ${errors} errors`
  );
}

// ---------------------------------------------------------------------------
// Fix Leads
// ---------------------------------------------------------------------------

async function fixLeads(token: string): Promise<void> {
  console.log("\n=== FIXING LEADS ===\n");

  const zohoLeads = await fetchAll(
    token,
    "Leads",
    "Company,First_Name,Last_Name,Email,Phone,Lead_Source,Lead_Status,Industry,Description"
  );

  console.log(`Fetched ${zohoLeads.length} leads from Zoho\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const zl of zohoLeads) {
    try {
      const email = zl.Email;
      const company = zl.Company;

      if (!email && !company) {
        skipped++;
        continue;
      }

      // Find the matching lead in our DB
      let existing;
      if (email) {
        existing = await prisma.lead.findFirst({
          where: { contactEmail: { equals: email, mode: "insensitive" } },
        });
      }
      if (!existing && company) {
        existing = await prisma.lead.findFirst({
          where: { companyName: { equals: company, mode: "insensitive" } },
        });
      }

      if (!existing) {
        skipped++;
        continue;
      }

      const status = mapZohoLeadStatus(zl.Lead_Status);
      const source = mapZohoLeadSource(zl.Lead_Source);
      const industry = mapIndustry(zl.Industry);

      const updateData: any = {
        leadStatus: status,
      };
      if (source) updateData.leadSource = source;
      if (industry) updateData.industry = industry;
      if (zl.Description && !existing.notes) updateData.notes = zl.Description;

      await prisma.lead.update({
        where: { id: existing.id },
        data: updateData,
      });

      console.log(
        `  UPDATED: ${company || email} → status: ${status}${source ? `, source: ${source}` : ""}`
      );
      updated++;
    } catch (err: any) {
      console.error(`  ERROR: ${zl.Company}: ${err.message}`);
      errors++;
    }
  }

  console.log(
    `\nLeads: ${updated} updated, ${skipped} skipped, ${errors} errors`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Zoho Data Fix — Correcting Stage Mappings & Values");
  console.log("=".repeat(60));

  const token = await getAccessToken();
  console.log("Authenticated with Zoho.\n");

  await fixDeals(token);
  await fixLeads(token);

  console.log("\n" + "=".repeat(60));
  console.log("  Data fix complete.");
  console.log("=".repeat(60));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("\nFATAL:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
