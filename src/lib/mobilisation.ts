import { prisma } from "@/lib/prisma";
import { CellType } from "@prisma/client";

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

const LABOUR_RATE_PER_HOUR = 17;
const WEEKS_PER_MONTH = 4.33;

// Cell type classification based on weekly hours
function calculateCellType(weeklyHours: number): CellType {
  if (weeklyHours <= 15) return "A";
  if (weeklyHours <= 30) return "B";
  return "C";
}

// Audit frequency by cell type
function getAuditFrequency(cellType: CellType): string {
  switch (cellType) {
    case "A":
      return "monthly";
    case "B":
      return "fortnightly";
    case "C":
      return "weekly";
  }
}

// Supervisor hours allocation percentage by cell type
function getSupervisorAllocPercent(cellType: CellType): number {
  switch (cellType) {
    case "A":
      return 0.1;
    case "B":
      return 0.15;
    case "C":
      return 0.2;
  }
}

// Generate next unitId for a given cell type (e.g. A-001, A-002, B-001)
async function generateUnitId(cellType: CellType): Promise<string> {
  const existing = await prisma.contract.findMany({
    where: {
      cellType,
      deletedAt: null,
    },
    select: { unitId: true },
    orderBy: { unitId: "desc" },
    take: 1,
  });

  let nextNumber = 1;
  if (existing.length > 0 && existing[0].unitId) {
    const parts = existing[0].unitId.split("-");
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }
  }

  return `${cellType}-${nextNumber.toString().padStart(3, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ──────────────────────────────────────────────
// MOBILISATION TASKS
// ──────────────────────────────────────────────

const MOBILISATION_TASKS = [
  "Assign cleaning team",
  "Schedule first clean",
  "Create site pack",
  "Send H&S pack to client",
  "Order initial consumables",
  "Set up on Connecteam",
  "Send client welcome email",
];

interface OnboardingMilestone {
  title: string;
  assigneeRole: "admin" | "sales";
  offsetDays: number;
}

const ONBOARDING_MILESTONES: OnboardingMilestone[] = [
  { title: "Week 1 phone call", assigneeRole: "sales", offsetDays: 7 },
  { title: "Week 2 on-site meeting", assigneeRole: "sales", offsetDays: 14 },
  { title: "Week 4 first audit", assigneeRole: "admin", offsetDays: 28 },
  { title: "Week 8 follow-up call", assigneeRole: "sales", offsetDays: 56 },
  { title: "Week 12 formal review", assigneeRole: "sales", offsetDays: 84 },
];

// ──────────────────────────────────────────────
// MAIN WORKFLOW
// ──────────────────────────────────────────────

export async function runMobilisationWorkflow(dealId: string) {
  // 1. Fetch the deal with its quote, account, contact
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      account: true,
      contact: true,
      quotes: {
        where: { status: "accepted" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const quote = deal.quotes[0];
  if (!quote) {
    throw new Error(`No accepted quote found for deal: ${dealId}`);
  }

  // 2. Calculate contract fields from quote
  const visitsPerWeek = quote.frequencyPerWeek;
  const hoursPerDay = Number(quote.hoursPerDay);
  const weeklyHours = hoursPerDay * visitsPerWeek;
  const cellType = calculateCellType(weeklyHours);
  const unitId = await generateUnitId(cellType);

  const weeklyCharge = Number(quote.weeklyCharge);
  const sellRatePerHour = weeklyHours > 0 ? weeklyCharge / weeklyHours : 0;
  const weeklyLabourCost = Number(quote.weeklyLabourCost);
  const monthlyLabourCost = weeklyLabourCost * WEEKS_PER_MONTH;

  const weeklyRevenue = weeklyCharge;
  const monthlyRevenue = Number(quote.monthlyTotal);
  const annualValue = Number(quote.annualTotal);

  const grossMarginPercent =
    weeklyRevenue > 0
      ? ((weeklyRevenue - weeklyLabourCost) / weeklyRevenue) * 100
      : 0;

  const supervisorHoursAlloc =
    getSupervisorAllocPercent(cellType) * weeklyHours;
  const auditFrequency = getAuditFrequency(cellType);

  // Pilot pricing data
  const isPilot = quote.applyPilotPricing;
  const pilotEndDate = quote.pilotEndDate ?? null;
  const pilotMonthlyRate = quote.pilotMonthlyTotal
    ? Number(quote.pilotMonthlyTotal)
    : null;
  const standardMonthlyRate = isPilot ? monthlyRevenue : null;

  // Look up Nelson (admin) and Nick (sales)
  const [adminUser, salesUser] = await Promise.all([
    prisma.user.findFirst({ where: { role: "admin" } }),
    prisma.user.findFirst({ where: { role: "sales" } }),
  ]);

  if (!adminUser) {
    throw new Error("Admin user not found");
  }

  if (!salesUser) {
    throw new Error("Sales user not found");
  }

  const now = new Date();

  // 3. Create the contract
  const contract = await prisma.contract.create({
    data: {
      dealId: deal.id,
      accountId: deal.accountId,
      quoteId: quote.id,
      contractName: deal.account?.name
        ? `${deal.account.name} - Cleaning Contract`
        : deal.name,
      unitId,
      cellType,
      status: "mobilising",
      weeklyHours,
      visitsPerWeek,
      hoursPerVisit: hoursPerDay,
      daysSelected: quote.daysSelected,
      siteType: quote.siteType,
      sellRatePerHour: parseFloat(sellRatePerHour.toFixed(2)),
      labourRatePerHour: LABOUR_RATE_PER_HOUR,
      weeklyRevenue: parseFloat(weeklyRevenue.toFixed(2)),
      monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
      annualValue: parseFloat(annualValue.toFixed(2)),
      weeklyLabourCost: parseFloat(weeklyLabourCost.toFixed(2)),
      monthlyLabourCost: parseFloat(monthlyLabourCost.toFixed(2)),
      grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
      supervisorHoursAlloc: parseFloat(supervisorHoursAlloc.toFixed(2)),
      auditFrequency,
      healthStatus: "GREEN",
      startDate: now,
      isPilot,
      pilotEndDate,
      pilotMonthlyRate,
      standardMonthlyRate,
    },
    include: {
      account: true,
      deal: true,
      quote: true,
    },
  });

  // 4. Create mobilisation tasks (assigned to admin/Nelson)
  const mobilisationTaskData = MOBILISATION_TASKS.map((title) => ({
    title,
    assignedTo: adminUser.id,
    createdBy: adminUser.id,
    contractId: contract.id,
    accountId: deal.accountId,
    dealId: deal.id,
    priority: "high" as const,
    autoGenerated: true,
    sourceWorkflow: "deal_won_mobilisation",
    dueDate: addDays(now, 7),
  }));

  await prisma.task.createMany({
    data: mobilisationTaskData,
  });

  // 5. Create onboarding milestone tasks
  const onboardingTaskData = ONBOARDING_MILESTONES.map((milestone) => ({
    title: milestone.title,
    assignedTo:
      milestone.assigneeRole === "admin" ? adminUser.id : salesUser.id,
    createdBy: adminUser.id,
    contractId: contract.id,
    accountId: deal.accountId,
    dealId: deal.id,
    priority: "high" as const,
    autoGenerated: true,
    sourceWorkflow: "onboarding",
    dueDate: addDays(now, milestone.offsetDays),
  }));

  await prisma.task.createMany({
    data: onboardingTaskData,
  });

  // 6. Create activity record
  await prisma.activity.create({
    data: {
      activityType: "contract_created",
      subject: "Contract created from deal",
      body: `Contract ${contract.contractName} (${unitId}) created via mobilisation workflow. Cell Type: ${cellType}, Weekly Revenue: ${weeklyRevenue.toFixed(2)}`,
      dealId: deal.id,
      accountId: deal.accountId,
      contractId: contract.id,
      contactId: deal.contactId,
      performedBy: adminUser.id,
      metadata: {
        cellType,
        unitId,
        weeklyRevenue,
        monthlyRevenue,
        annualValue,
        grossMarginPercent: parseFloat(grossMarginPercent.toFixed(2)),
        isPilot,
      },
    },
  });

  // 7. Create notifications for both users
  const companyName = deal.account?.name ?? deal.name;
  const notificationData = [adminUser.id, salesUser.id].map((userId) => ({
    userId,
    title: "Deal Won!",
    message: `Deal won! Contract created for ${companyName}`,
    notificationType: "deal_won" as const,
    linkUrl: `/contracts/${contract.id}`,
    entityType: "contract",
    entityId: contract.id,
  }));

  await prisma.notification.createMany({
    data: notificationData,
  });

  return contract;
}
