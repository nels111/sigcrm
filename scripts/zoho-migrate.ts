/**
 * Zoho CRM -> Signature OS Migration Script
 *
 * Fetches all data from Zoho CRM (Accounts, Contacts, Leads, Deals)
 * and imports it into the PostgreSQL database via Prisma.
 *
 * Usage:
 *   npx tsx scripts/zoho-migrate.ts
 *
 * Required .env variables:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 *   DATABASE_URL
 *
 * Optional .env variables:
 *   ZOHO_API_DOMAIN (default: https://www.zohoapis.eu)
 *   ZOHO_ACCOUNTS_DOMAIN (default: https://accounts.zoho.eu)
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ZOHO_API_DOMAIN =
  process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.eu";
const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.eu";
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;

const PROTECTED_ACCOUNT_NAMES = [
  "Porsche Centre Exeter",
  "Bouygues UK",
  "Vistry",
  "Certas Energy",
];

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZohoRecord = Record<string, any>;

interface MigrationSummary {
  module: string;
  fetched: number;
  created: number;
  skipped: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Zoho ID -> Our UUID mappings
// ---------------------------------------------------------------------------

const accountIdMap = new Map<string, string>(); // Zoho Account ID -> our UUID
const contactIdMap = new Map<string, string>(); // Zoho Contact ID -> our UUID
const userEmailToId = new Map<string, string>(); // email -> our user UUID

// ---------------------------------------------------------------------------
// OAuth2 — Get Access Token from Refresh Token
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error(
      "Missing Zoho OAuth credentials. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, " +
        "and ZOHO_REFRESH_TOKEN in your .env file.\n\n" +
        "To get a refresh token, run:\n" +
        "  npx tsx scripts/zoho-get-refresh-token.ts <GRANT_TOKEN>"
    );
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    refresh_token: ZOHO_REFRESH_TOKEN,
  });

  const url = `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params.toString()}`;
  const response = await fetch(url, { method: "POST" });
  const data = await response.json();

  if (data.error) {
    throw new Error(`Zoho OAuth error: ${data.error}`);
  }

  if (!data.access_token) {
    throw new Error(
      `No access_token in Zoho response: ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Zoho API — Fetch All Records (paginated)
// ---------------------------------------------------------------------------

async function fetchAllRecords(
  accessToken: string,
  module: string
): Promise<ZohoRecord[]> {
  const allRecords: ZohoRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${ZOHO_API_DOMAIN}/crm/v7/${module}?page=${page}&per_page=200`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (response.status === 204) {
      // No content — module is empty
      break;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Zoho API error fetching ${module} (page ${page}): ${response.status} ${text}`
      );
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      allRecords.push(...data.data);
    }

    // Check if there are more pages
    hasMore = data.info?.more_records === true;
    page++;
  }

  return allRecords;
}

// ---------------------------------------------------------------------------
// Industry Mapping
// ---------------------------------------------------------------------------

function mapIndustry(
  zohoIndustry: string | null | undefined
): string | undefined {
  if (!zohoIndustry) return undefined;

  const lower = zohoIndustry.toLowerCase().trim();

  // Direct matches to our Industry enum
  const mapping: Record<string, string> = {
    pbsa: "PBSA",
    "post construction": "PostConstruction",
    "post-construction": "PostConstruction",
    "bio hazard": "BioHazard",
    "bio-hazard": "BioHazard",
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

  return mapping[lower] || undefined;
}

// ---------------------------------------------------------------------------
// Lead Source Mapping
// ---------------------------------------------------------------------------

function mapLeadSource(
  zohoSource: string | null | undefined
): string | undefined {
  if (!zohoSource) return undefined;

  const lower = zohoSource.toLowerCase().trim();

  const mapping: Record<string, string> = {
    web: "WebResearch",
    website: "WebResearch",
    advertisement: "GoogleAds",
    "google ads": "GoogleAds",
    "cold call": "ColdCall",
    referral: "Referral",
    "landing page": "LandingPage",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    seminar: "Seminar",
    "trade show": "TradeShow",
    chat: "Chat",
  };

  return mapping[lower] || undefined;
}

// ---------------------------------------------------------------------------
// Lead Status Mapping
// ---------------------------------------------------------------------------

function mapLeadStatus(zohoStatus: string | null | undefined): string {
  if (!zohoStatus) return "NewLead";

  const lower = zohoStatus.toLowerCase().trim();

  const mapping: Record<string, string> = {
    new: "NewLead",
    contacted: "Contacted",
    qualified: "MeetingBooked",
    "not contacted": "NewLead",
    "attempted to contact": "Contacted",
    "contact in future": "NewLead",
    junk: "NewLead",
    lost: "NewLead",
    "pre-qualified": "Contacted",
  };

  return mapping[lower] || "NewLead";
}

// ---------------------------------------------------------------------------
// Deal Stage Mapping
// ---------------------------------------------------------------------------

function mapDealStage(zohoStage: string | null | undefined): string {
  if (!zohoStage) return "Contacted";

  const lower = zohoStage.toLowerCase().trim();

  const mapping: Record<string, string> = {
    qualification: "NewLead",
    "needs analysis": "SiteSurveyBooked",
    "value proposition": "QuoteSent",
    "identify decision makers": "Contacted",
    "proposal/price quote": "QuoteSent",
    "negotiation/review": "Negotiation",
    negotiation: "Negotiation",
    "closed won": "ClosedWonRecurring",
    "closed-won": "ClosedWonRecurring",
    "closed lost": "ClosedLostRecurring",
    "closed-lost": "ClosedLostRecurring",
  };

  return mapping[lower] || "Contacted";
}

// ---------------------------------------------------------------------------
// Deal Type Mapping
// ---------------------------------------------------------------------------

function mapDealType(
  zohoType: string | null | undefined
): "recurring" | "one_off" {
  if (!zohoType) return "recurring";
  return zohoType.toLowerCase().includes("recurring") ? "recurring" : "one_off";
}

// ---------------------------------------------------------------------------
// Utility — Concatenate address fields
// ---------------------------------------------------------------------------

function buildAddress(
  street?: string | null,
  city?: string | null,
  state?: string | null,
  zipCode?: string | null
): string | null {
  const parts = [street, city, state, zipCode].filter(
    (p) => p && p.trim() !== ""
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

// ---------------------------------------------------------------------------
// Utility — Resolve Zoho Owner email to our User UUID
// ---------------------------------------------------------------------------

function resolveOwner(owner: any): string | undefined {
  if (!owner?.email) return undefined;
  return userEmailToId.get(owner.email.toLowerCase());
}

// ---------------------------------------------------------------------------
// Step 0: Load our Users
// ---------------------------------------------------------------------------

async function loadUsers(): Promise<void> {
  console.log("\n[0/4] Loading existing users...");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  for (const user of users) {
    userEmailToId.set(user.email.toLowerCase(), user.id);
  }

  console.log(
    `  Found ${users.length} users: ${users.map((u) => u.name).join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Step 1: Migrate Accounts
// ---------------------------------------------------------------------------

async function migrateAccounts(
  accessToken: string
): Promise<MigrationSummary> {
  console.log("\n[1/4] Migrating Accounts...");

  const records = await fetchAllRecords(accessToken, "Accounts");
  console.log(`  Fetched ${records.length} from Zoho`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const name = record.Account_Name;
      if (!name) {
        skipped++;
        continue;
      }

      // Skip protected accounts
      if (
        PROTECTED_ACCOUNT_NAMES.some(
          (p) => p.toLowerCase() === name.toLowerCase()
        )
      ) {
        // Still map the Zoho ID to our existing protected account
        const existing = await prisma.account.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (existing) {
          accountIdMap.set(record.id, existing.id);
        }
        skipped++;
        continue;
      }

      // Check if account already exists (by name)
      const existing = await prisma.account.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (existing) {
        accountIdMap.set(record.id, existing.id);
        skipped++;
        continue;
      }

      const industry = mapIndustry(record.Industry);

      const account = await prisma.account.create({
        data: {
          name,
          phone: record.Phone || null,
          website: record.Website || null,
          address: buildAddress(
            record.Billing_Street,
            record.Billing_City,
            record.Billing_State,
            record.Billing_Code
          ),
          city: record.Billing_City || null,
          county: record.Billing_State || null,
          postcode: record.Billing_Code || null,
          industry: industry as any,
          notes: record.Description || null,
          createdAt: record.Created_Time
            ? new Date(record.Created_Time)
            : undefined,
        },
      });

      accountIdMap.set(record.id, account.id);
      created++;
    } catch (err: any) {
      console.error(
        `  ERROR creating account "${record.Account_Name}": ${err.message}`
      );
      errors++;
    }
  }

  console.log(
    `  Created ${created} (${skipped} already existed, ${errors} errors)`
  );

  return {
    module: "Accounts",
    fetched: records.length,
    created,
    skipped,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Migrate Contacts
// ---------------------------------------------------------------------------

async function migrateContacts(
  accessToken: string
): Promise<MigrationSummary> {
  console.log("\n[2/4] Migrating Contacts...");

  const records = await fetchAllRecords(accessToken, "Contacts");
  console.log(`  Fetched ${records.length} from Zoho`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const lastName = record.Last_Name;
      if (!lastName) {
        skipped++;
        continue;
      }

      // Check if contact already exists (by email if available, otherwise by name)
      if (record.Email) {
        const existing = await prisma.contact.findFirst({
          where: { email: { equals: record.Email, mode: "insensitive" } },
        });
        if (existing) {
          contactIdMap.set(record.id, existing.id);
          skipped++;
          continue;
        }
      }

      // Resolve account link
      let accountId: string | undefined;
      if (record.Account_Name?.id) {
        accountId = accountIdMap.get(record.Account_Name.id);
      }

      const contact = await prisma.contact.create({
        data: {
          firstName: record.First_Name || null,
          lastName,
          email: record.Email || null,
          phone: record.Phone || null,
          mobile: record.Mobile || null,
          jobTitle: record.Title || null,
          accountId: accountId || null,
          createdAt: record.Created_Time
            ? new Date(record.Created_Time)
            : undefined,
        },
      });

      contactIdMap.set(record.id, contact.id);
      created++;
    } catch (err: any) {
      console.error(
        `  ERROR creating contact "${record.First_Name} ${record.Last_Name}": ${err.message}`
      );
      errors++;
    }
  }

  console.log(
    `  Created ${created} (${skipped} already existed, ${errors} errors)`
  );

  return {
    module: "Contacts",
    fetched: records.length,
    created,
    skipped,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Step 3: Migrate Leads
// ---------------------------------------------------------------------------

async function migrateLeads(accessToken: string): Promise<MigrationSummary> {
  console.log("\n[3/4] Migrating Leads...");

  const records = await fetchAllRecords(accessToken, "Leads");
  console.log(`  Fetched ${records.length} from Zoho`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const companyName = record.Company || "Unknown Company";
      const contactName = [record.First_Name, record.Last_Name]
        .filter(Boolean)
        .join(" ") || "Unknown";

      // Check if lead already exists by email
      if (record.Email) {
        const existing = await prisma.lead.findFirst({
          where: {
            contactEmail: { equals: record.Email, mode: "insensitive" },
          },
        });
        if (existing) {
          skipped++;
          continue;
        }
      }

      const leadSource = mapLeadSource(record.Lead_Source);
      const leadStatus = mapLeadStatus(record.Lead_Status);
      const industry = mapIndustry(record.Industry);
      const assignedTo = resolveOwner(record.Owner);

      // Extract tags
      let tags: string[] = [];
      if (record.Tag && Array.isArray(record.Tag)) {
        tags = record.Tag.map((t: any) =>
          typeof t === "string" ? t : t.name
        ).filter(Boolean);
      }

      await prisma.lead.create({
        data: {
          companyName,
          contactName,
          contactEmail: record.Email || null,
          contactPhone: record.Phone || null,
          leadSource: leadSource as any,
          leadStatus: leadStatus as any,
          industry: industry as any,
          address: buildAddress(
            record.Street,
            record.City,
            record.State,
            record.Zip_Code
          ),
          notes: record.Description || null,
          assignedTo: assignedTo || null,
          tags,
          createdAt: record.Created_Time
            ? new Date(record.Created_Time)
            : undefined,
        },
      });

      created++;
    } catch (err: any) {
      console.error(
        `  ERROR creating lead "${record.Company}": ${err.message}`
      );
      errors++;
    }
  }

  console.log(
    `  Created ${created} (${skipped} already existed, ${errors} errors)`
  );

  return {
    module: "Leads",
    fetched: records.length,
    created,
    skipped,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Step 4: Migrate Deals
// ---------------------------------------------------------------------------

async function migrateDeals(accessToken: string): Promise<MigrationSummary> {
  console.log("\n[4/4] Migrating Deals...");

  const records = await fetchAllRecords(accessToken, "Deals");
  console.log(`  Fetched ${records.length} from Zoho`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const name = record.Deal_Name;
      if (!name) {
        skipped++;
        continue;
      }

      // Resolve account and contact links
      let accountId: string | undefined;
      if (record.Account_Name?.id) {
        accountId = accountIdMap.get(record.Account_Name.id);
      }

      let contactId: string | undefined;
      if (record.Contact_Name?.id) {
        contactId = contactIdMap.get(record.Contact_Name.id);
      }

      // Check if deal already exists (by name + accountId)
      const existing = await prisma.deal.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          accountId: accountId || null,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const stage = mapDealStage(record.Stage);
      const dealType = mapDealType(record.Type);
      const assignedTo = resolveOwner(record.Owner);

      // Parse amount
      let amount: Prisma.Decimal | undefined;
      if (record.Amount != null && record.Amount !== "") {
        amount = new Prisma.Decimal(record.Amount);
      }

      // Parse probability
      let probability: number = 5;
      if (record.Probability != null && record.Probability !== "") {
        probability = Math.max(1, Math.min(100, Number(record.Probability)));
      }

      // Parse closing date
      let expectedCloseDate: Date | undefined;
      if (record.Closing_Date) {
        expectedCloseDate = new Date(record.Closing_Date);
      }

      await prisma.deal.create({
        data: {
          name,
          accountId: accountId || null,
          contactId: contactId || null,
          stage: stage as any,
          dealType: dealType as any,
          amount: amount || null,
          probability,
          expectedCloseDate: expectedCloseDate || null,
          assignedTo: assignedTo || null,
          notes: record.Description || null,
          createdAt: record.Created_Time
            ? new Date(record.Created_Time)
            : undefined,
        },
      });

      created++;
    } catch (err: any) {
      console.error(`  ERROR creating deal "${record.Deal_Name}": ${err.message}`);
      errors++;
    }
  }

  console.log(
    `  Created ${created} (${skipped} already existed, ${errors} errors)`
  );

  return {
    module: "Deals",
    fetched: records.length,
    created,
    skipped,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Summary Table
// ---------------------------------------------------------------------------

function printSummary(results: MigrationSummary[]): void {
  console.log("\n" + "=".repeat(65));
  console.log("  MIGRATION SUMMARY");
  console.log("=".repeat(65));
  console.log(
    "  Module".padEnd(16) +
      "Fetched".padStart(10) +
      "Created".padStart(10) +
      "Skipped".padStart(10) +
      "Errors".padStart(10)
  );
  console.log("-".repeat(65));

  let totalFetched = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const r of results) {
    console.log(
      `  ${r.module.padEnd(14)}${String(r.fetched).padStart(10)}${String(r.created).padStart(10)}${String(r.skipped).padStart(10)}${String(r.errors).padStart(10)}`
    );
    totalFetched += r.fetched;
    totalCreated += r.created;
    totalSkipped += r.skipped;
    totalErrors += r.errors;
  }

  console.log("-".repeat(65));
  console.log(
    `  ${"TOTAL".padEnd(14)}${String(totalFetched).padStart(10)}${String(totalCreated).padStart(10)}${String(totalSkipped).padStart(10)}${String(totalErrors).padStart(10)}`
  );
  console.log("=".repeat(65));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=".repeat(65));
  console.log("  Zoho CRM -> Signature OS Migration");
  console.log("=".repeat(65));
  console.log(`  API Domain:      ${ZOHO_API_DOMAIN}`);
  console.log(`  Accounts Domain: ${ZOHO_ACCOUNTS_DOMAIN}`);
  console.log("");

  // 1. Get access token
  console.log("Authenticating with Zoho...");
  const accessToken = await getAccessToken();
  console.log("  Authenticated successfully.");

  // 2. Load existing users for owner mapping
  await loadUsers();

  // 3. Run migrations in order (respecting foreign keys)
  const results: MigrationSummary[] = [];

  results.push(await migrateAccounts(accessToken));
  results.push(await migrateContacts(accessToken));
  results.push(await migrateLeads(accessToken));
  results.push(await migrateDeals(accessToken));

  // 4. Print summary
  printSummary(results);

  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
  if (totalErrors > 0) {
    console.log(
      `\nWARNING: ${totalErrors} error(s) occurred during migration. See above for details.`
    );
  }

  console.log("\nMigration complete.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("\nFATAL ERROR during migration:");
    console.error(err.message || err);
    await prisma.$disconnect();
    process.exit(1);
  });
