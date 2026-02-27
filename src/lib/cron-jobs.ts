import cron from "node-cron";
import { runCadenceEngine } from "@/lib/cadence-engine";
import { runQuoteFollowUp } from "@/lib/quote-follow-up";
import { generateWeeklyScorecard } from "@/lib/weekly-scorecard";
import { recalculateHealthScores } from "@/lib/health-score";
import { prisma } from "@/lib/prisma";

// Dynamic import for IMAP poller — module may not exist yet
let pollEmails: (() => Promise<unknown>) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const imapModule = require("@/lib/imap-poller");
  pollEmails = imapModule.pollEmails || imapModule.default || null;
} catch {
  console.warn(
    "[CronJobs] IMAP poller module not available — IMAP poll cron will not be registered"
  );
}

function shouldRunCrons(): boolean {
  // Crons are OFF by default. Set ENABLE_CRONS=true in .env to activate.
  if (process.env.ENABLE_CRONS === "true") return true;
  return false;
}

// ──────────────────────────────────────────────
// CRON JOB HELPERS
// ──────────────────────────────────────────────

async function runStaleDealCheck(): Promise<void> {
  console.log("[CronJobs] Running Stale Deal Check...");
  try {
    const fourteenDaysAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    );

    // Find active deals with no activity in 14+ days
    const staleDeals = await prisma.deal.findMany({
      where: {
        deletedAt: null,
        stage: {
          notIn: [
            "ClosedWonRecurring",
            "ClosedWonOneOff",
            "ClosedLostRecurring",
            "ClosedLostOneOff",
          ],
        },
        updatedAt: { lt: fourteenDaysAgo },
      },
      select: {
        id: true,
        name: true,
        stage: true,
        account: { select: { name: true } },
      },
    });

    if (staleDeals.length === 0) {
      console.log("[CronJobs] No stale deals found");
      return;
    }

    // Find Nick (sales user)
    const nickUser = await prisma.user.findFirst({
      where: { role: "sales" },
    });

    if (!nickUser) {
      console.warn("[CronJobs] Sales user not found for stale deal notifications");
      return;
    }

    // Create notifications for each stale deal
    await prisma.notification.createMany({
      data: staleDeals.map((deal) => ({
        userId: nickUser.id,
        title: "Stale Deal Alert",
        message: `Deal "${deal.name}"${deal.account ? ` (${deal.account.name})` : ""} has had no activity for 14+ days. Stage: ${deal.stage}.`,
        notificationType: "stale_deal" as const,
        linkUrl: `/deals/${deal.id}`,
        entityType: "deal",
        entityId: deal.id,
      })),
    });

    console.log(
      `[CronJobs] Stale Deal Check complete: ${staleDeals.length} notifications created`
    );
  } catch (err) {
    console.error("[CronJobs] Stale Deal Check failed:", err);
  }
}

async function runTaskOverdueCheck(): Promise<void> {
  console.log("[CronJobs] Running Task Overdue Check...");
  try {
    const now = new Date();

    // Find overdue tasks that haven't been notified today
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ["pending", "in_progress"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        assignedTo: true,
        dueDate: true,
        contractId: true,
        dealId: true,
      },
    });

    if (overdueTasks.length === 0) {
      console.log("[CronJobs] No overdue tasks found");
      return;
    }

    // Check for existing notifications today to avoid duplicates
    const existingNotifications = await prisma.notification.findMany({
      where: {
        notificationType: "task_overdue",
        createdAt: { gte: startOfDay },
      },
      select: { entityId: true },
    });

    const alreadyNotified = new Set(
      existingNotifications.map((n) => n.entityId)
    );

    const newOverdue = overdueTasks.filter(
      (t) => !alreadyNotified.has(t.id)
    );

    if (newOverdue.length === 0) {
      console.log("[CronJobs] All overdue tasks already notified today");
      return;
    }

    await prisma.notification.createMany({
      data: newOverdue.map((task) => ({
        userId: task.assignedTo,
        title: "Task Overdue",
        message: `Task "${task.title}" is overdue (due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-GB") : "unknown"}).`,
        notificationType: "task_overdue" as const,
        linkUrl: `/tasks`,
        entityType: "task",
        entityId: task.id,
      })),
    });

    console.log(
      `[CronJobs] Task Overdue Check complete: ${newOverdue.length} notifications created`
    );
  } catch (err) {
    console.error("[CronJobs] Task Overdue Check failed:", err);
  }
}

async function runAuditScheduleCheck(): Promise<void> {
  console.log("[CronJobs] Running Audit Schedule Check...");
  try {
    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find contracts with audits due this week
    const contractsDue = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["mobilising", "active"] },
        nextAuditDate: {
          gte: now,
          lte: endOfWeek,
        },
      },
      select: {
        id: true,
        contractName: true,
        nextAuditDate: true,
        unitId: true,
        account: { select: { name: true } },
      },
    });

    if (contractsDue.length === 0) {
      console.log("[CronJobs] No audits due this week");
      return;
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (!adminUser) {
      console.warn("[CronJobs] Admin user not found for audit notifications");
      return;
    }

    await prisma.notification.createMany({
      data: contractsDue.map((contract) => ({
        userId: adminUser.id,
        title: "Audit Due This Week",
        message: `Audit due for "${contract.contractName}"${contract.unitId ? ` (${contract.unitId})` : ""} on ${contract.nextAuditDate ? new Date(contract.nextAuditDate).toLocaleDateString("en-GB") : "this week"}.`,
        notificationType: "audit_due" as const,
        linkUrl: `/contracts/${contract.id}`,
        entityType: "contract",
        entityId: contract.id,
      })),
    });

    console.log(
      `[CronJobs] Audit Schedule Check complete: ${contractsDue.length} notifications created`
    );
  } catch (err) {
    console.error("[CronJobs] Audit Schedule Check failed:", err);
  }
}

async function runContractRenewalCheck(): Promise<void> {
  console.log("[CronJobs] Running Contract Renewal Check...");
  try {
    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Find contracts with renewals approaching at 90, 60, and 30 day windows
    const renewalContracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["active"] },
        renewalDate: {
          gte: now,
          lte: ninetyDays,
        },
      },
      select: {
        id: true,
        contractName: true,
        renewalDate: true,
        unitId: true,
        account: { select: { name: true } },
      },
    });

    if (renewalContracts.length === 0) {
      console.log("[CronJobs] No contract renewals approaching");
      return;
    }

    // Check for existing notifications today
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const existingNotifications = await prisma.notification.findMany({
      where: {
        notificationType: "contract_renewal",
        createdAt: { gte: startOfDay },
      },
      select: { entityId: true },
    });
    const alreadyNotified = new Set(
      existingNotifications.map((n) => n.entityId)
    );

    const [adminUser, salesUser] = await Promise.all([
      prisma.user.findFirst({ where: { role: "admin" } }),
      prisma.user.findFirst({ where: { role: "sales" } }),
    ]);

    const recipientIds = [adminUser?.id, salesUser?.id].filter(
      (id): id is string => !!id
    );

    if (recipientIds.length === 0) {
      console.warn("[CronJobs] No users found for renewal notifications");
      return;
    }

    let created = 0;

    for (const contract of renewalContracts) {
      if (alreadyNotified.has(contract.id)) continue;

      const renewalDate = new Date(contract.renewalDate!);
      const daysUntil = Math.floor(
        (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let urgency: string;
      if (daysUntil <= 30) {
        urgency = "30-day";
      } else if (daysUntil <= 60) {
        urgency = "60-day";
      } else {
        urgency = "90-day";
      }

      // Only notify at specific thresholds to avoid daily spam
      // Check if days until is close to 90, 60, or 30
      const isThresholdDay =
        (daysUntil >= 88 && daysUntil <= 92) ||
        (daysUntil >= 58 && daysUntil <= 62) ||
        (daysUntil >= 28 && daysUntil <= 32) ||
        daysUntil <= 7;

      if (!isThresholdDay && daysUntil > 7) continue;

      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          title: `Contract Renewal: ${urgency} Warning`,
          message: `Contract "${contract.contractName}"${contract.unitId ? ` (${contract.unitId})` : ""} renews on ${renewalDate.toLocaleDateString("en-GB")} (${daysUntil} days).`,
          notificationType: "contract_renewal" as const,
          linkUrl: `/contracts/${contract.id}`,
          entityType: "contract",
          entityId: contract.id,
        })),
      });
      created++;
    }

    console.log(
      `[CronJobs] Contract Renewal Check complete: ${created} contracts notified`
    );
  } catch (err) {
    console.error("[CronJobs] Contract Renewal Check failed:", err);
  }
}

async function runComplianceExpiryCheck(): Promise<void> {
  console.log("[CronJobs] Running Compliance Expiry Check...");
  try {
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find subcontractors with documents expiring in 30 days
    const expiringSubcontractors = await prisma.subcontractor.findMany({
      where: {
        status: "active",
        OR: [
          {
            insuranceExpiry: {
              gte: now,
              lte: thirtyDaysOut,
            },
          },
          {
            dbsExpiry: {
              gte: now,
              lte: thirtyDaysOut,
            },
          },
        ],
      },
      select: {
        id: true,
        contactName: true,
        companyName: true,
        insuranceExpiry: true,
        dbsExpiry: true,
      },
    });

    if (expiringSubcontractors.length === 0) {
      console.log("[CronJobs] No compliance documents expiring soon");
      return;
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (!adminUser) {
      console.warn("[CronJobs] Admin user not found for compliance notifications");
      return;
    }

    // Check for existing notifications today
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const existingNotifications = await prisma.notification.findMany({
      where: {
        notificationType: "compliance_expiry",
        createdAt: { gte: startOfDay },
      },
      select: { entityId: true },
    });
    const alreadyNotified = new Set(
      existingNotifications.map((n) => n.entityId)
    );

    const notifications: Array<{
      userId: string;
      title: string;
      message: string;
      notificationType: "compliance_expiry";
      linkUrl: string;
      entityType: string;
      entityId: string;
    }> = [];

    for (const sub of expiringSubcontractors) {
      if (alreadyNotified.has(sub.id)) continue;

      const name = sub.companyName || sub.contactName;
      const expiringDocs: string[] = [];

      if (sub.insuranceExpiry && new Date(sub.insuranceExpiry) <= thirtyDaysOut) {
        const daysUntil = Math.floor(
          (new Date(sub.insuranceExpiry).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        expiringDocs.push(`Insurance (${daysUntil} days)`);
      }

      if (sub.dbsExpiry && new Date(sub.dbsExpiry) <= thirtyDaysOut) {
        const daysUntil = Math.floor(
          (new Date(sub.dbsExpiry).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        expiringDocs.push(`DBS Check (${daysUntil} days)`);
      }

      if (expiringDocs.length > 0) {
        notifications.push({
          userId: adminUser.id,
          title: "Compliance Document Expiring",
          message: `Subcontractor "${name}" has expiring documents: ${expiringDocs.join(", ")}.`,
          notificationType: "compliance_expiry",
          linkUrl: `/subcontractors/${sub.id}`,
          entityType: "subcontractor",
          entityId: sub.id,
        });
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }

    console.log(
      `[CronJobs] Compliance Expiry Check complete: ${notifications.length} notifications created`
    );
  } catch (err) {
    console.error("[CronJobs] Compliance Expiry Check failed:", err);
  }
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────

export function initCronJobs(): void {
  if (!shouldRunCrons()) {
    console.log(
      "[CronJobs] Crons disabled (NODE_ENV is not production and ENABLE_CRONS is not true)"
    );
    return;
  }

  console.log("[CronJobs] Initializing cron jobs...");

  // Every Tuesday at 10:00 AM — Email Cadence Engine
  cron.schedule("0 10 * * 2", async () => {
    console.log("[CronJobs] Running Email Cadence Engine...");
    try {
      const result = await runCadenceEngine();
      console.log("[CronJobs] Email Cadence Engine complete:", {
        sent: result.sent,
        skipped: result.skipped,
        errors: result.errors.length,
      });
    } catch (err) {
      console.error("[CronJobs] Email Cadence Engine failed:", err);
    }
  });

  // Daily at 9:00 AM — Quote Follow-Up + Health Score + Stale Deals + Overdue Tasks + Audit Schedule + Contract Renewal + Compliance Expiry
  cron.schedule("0 9 * * *", async () => {
    // Quote Follow-Up
    console.log("[CronJobs] Running Quote Follow-Up Engine...");
    try {
      const result = await runQuoteFollowUp();
      console.log("[CronJobs] Quote Follow-Up Engine complete:", {
        emailsSent: result.emailsSent,
        tasksCreated: result.tasksCreated,
        errors: result.errors.length,
      });
    } catch (err) {
      console.error("[CronJobs] Quote Follow-Up Engine failed:", err);
    }

    // Health Score Recalculation
    console.log("[CronJobs] Running Health Score Recalculation...");
    try {
      const result = await recalculateHealthScores();
      console.log("[CronJobs] Health Score Recalculation complete:", {
        processed: result.processed,
        changed: result.changed,
      });
    } catch (err) {
      console.error("[CronJobs] Health Score Recalculation failed:", err);
    }

    // Stale Deal Check
    await runStaleDealCheck();

    // Task Overdue Check
    await runTaskOverdueCheck();

    // Audit Schedule Check
    await runAuditScheduleCheck();

    // Contract Renewal Check
    await runContractRenewalCheck();

    // Compliance Expiry Check
    await runComplianceExpiryCheck();
  });

  // Monday at 5:30 AM — Weekly Scorecard
  cron.schedule("30 5 * * 1", async () => {
    console.log("[CronJobs] Running Weekly Scorecard Generation...");
    try {
      const scorecard = await generateWeeklyScorecard();
      console.log("[CronJobs] Weekly Scorecard complete:", {
        weekEnding: scorecard.weekEnding,
        totalContractedHours: scorecard.totalContractedHours,
        totalMonthlyRevenue: scorecard.totalMonthlyRevenue,
        marginTrafficLight: scorecard.marginTrafficLight,
      });
    } catch (err) {
      console.error("[CronJobs] Weekly Scorecard failed:", err);
    }
  });

  // Every 5 minutes — IMAP Poll
  if (pollEmails && typeof pollEmails === "function") {
    const poll = pollEmails;
    cron.schedule("*/5 * * * *", async () => {
      console.log("[CronJobs] Running IMAP Poll...");
      try {
        await poll();
        console.log("[CronJobs] IMAP Poll complete");
      } catch (err) {
        console.error("[CronJobs] IMAP Poll failed:", err);
      }
    });
    console.log("[CronJobs] IMAP Poll cron registered");
  } else {
    console.warn(
      "[CronJobs] IMAP poller not available — IMAP poll cron not registered"
    );
  }

  console.log("[CronJobs] All cron jobs initialized");
}
