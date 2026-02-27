import { prisma } from "@/lib/prisma";
import { HealthStatus } from "@prisma/client";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface HealthScoreResult {
  contractId: string;
  contractName: string;
  previousStatus: HealthStatus;
  newStatus: HealthStatus;
  score: number;
  breakdown: {
    audit: number;
    contactRecency: number;
    complaints: number;
    staffing: number;
    renewal: number;
  };
  changed: boolean;
}

interface RecalculationSummary {
  processed: number;
  changed: number;
  results: HealthScoreResult[];
}

// ──────────────────────────────────────────────
// SCORE THRESHOLDS
// ──────────────────────────────────────────────

function classifyHealth(score: number): HealthStatus {
  if (score >= 80) return "GREEN";
  if (score >= 60) return "AMBER";
  return "RED";
}

// ──────────────────────────────────────────────
// MAIN FUNCTION
// ──────────────────────────────────────────────

export async function recalculateHealthScores(): Promise<RecalculationSummary> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all active contracts with related data
  const contracts = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      status: { in: ["mobilising", "active"] },
    },
    select: {
      id: true,
      contractName: true,
      healthStatus: true,
      latestAuditScore: true,
      daysSinceLastContact: true,
      staffingStatus: true,
      renewalDate: true,
      accountId: true,
    },
  });

  // Fetch complaint counts per contract (issues in last 90 days)
  const recentIssues = await prisma.issue.findMany({
    where: {
      reportedAt: { gte: ninetyDaysAgo },
      category: "quality",
    },
    select: {
      contractId: true,
    },
  });

  // Build complaints map: contractId -> count
  const complaintsMap = new Map<string, number>();
  for (const issue of recentIssues) {
    const current = complaintsMap.get(issue.contractId) || 0;
    complaintsMap.set(issue.contractId, current + 1);
  }

  // Fetch latest activity per contract for contact recency
  const contractIds = contracts.map((c) => c.id);
  const latestActivities = await prisma.activity.findMany({
    where: {
      contractId: { in: contractIds },
    },
    select: {
      contractId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Build last contact map: contractId -> days since last activity
  const lastContactMap = new Map<string, number>();
  for (const activity of latestActivities) {
    if (activity.contractId && !lastContactMap.has(activity.contractId)) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(activity.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      lastContactMap.set(activity.contractId, daysSince);
    }
  }

  // Look up admin user for task/notification creation
  const adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  const results: HealthScoreResult[] = [];

  for (const contract of contracts) {
    const previousStatus = contract.healthStatus;
    const auditScore = Number(contract.latestAuditScore);
    const daysSinceContact =
      lastContactMap.get(contract.id) ?? contract.daysSinceLastContact;
    const complaints = complaintsMap.get(contract.id) || 0;

    // ─── Calculate Health Score ──────────────────
    let healthScore = 0;

    // Audit (40%)
    let auditPoints: number;
    if (auditScore >= 85) {
      auditPoints = 40;
    } else if (auditScore >= 70) {
      auditPoints = 25;
    } else {
      auditPoints = 10;
    }
    healthScore += auditPoints;

    // Contact recency (20%)
    let contactPoints: number;
    if (daysSinceContact <= 14) {
      contactPoints = 20;
    } else if (daysSinceContact <= 30) {
      contactPoints = 12;
    } else {
      contactPoints = 5;
    }
    healthScore += contactPoints;

    // Complaints (20%)
    let complaintPoints: number;
    if (complaints === 0) {
      complaintPoints = 20;
    } else if (complaints === 1) {
      complaintPoints = 12;
    } else {
      complaintPoints = 5;
    }
    healthScore += complaintPoints;

    // Staffing (10%)
    let staffingPoints: number;
    if (contract.staffingStatus === "Stable") {
      staffingPoints = 10;
    } else if (contract.staffingStatus === "Risk") {
      staffingPoints = 5;
    } else {
      staffingPoints = 0;
    }
    healthScore += staffingPoints;

    // Renewal (10%)
    let renewalPoints: number;
    if (!contract.renewalDate) {
      renewalPoints = 10; // No renewal date = not expiring
    } else {
      const daysUntilRenewal = Math.floor(
        (new Date(contract.renewalDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysUntilRenewal > 90) {
        renewalPoints = 10;
      } else if (daysUntilRenewal >= 30) {
        renewalPoints = 7;
      } else {
        renewalPoints = 3;
      }
    }
    healthScore += renewalPoints;

    // ─── Classify ───────────────────────────────
    const newStatus = classifyHealth(healthScore);
    const changed = previousStatus !== newStatus;

    // ─── Update contract ────────────────────────
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        healthStatus: newStatus,
        daysSinceLastContact: daysSinceContact,
        complaintCount: complaints,
      },
    });

    // ─── If degraded from GREEN, create notification + task ───
    if (
      changed &&
      previousStatus === "GREEN" &&
      (newStatus === "AMBER" || newStatus === "RED") &&
      adminUser
    ) {
      await prisma.notification.create({
        data: {
          userId: adminUser.id,
          title: `Health Score Changed: ${contract.contractName}`,
          message: `Contract "${contract.contractName}" health changed from ${previousStatus} to ${newStatus} (score: ${healthScore}).`,
          notificationType: "health_score_change",
          linkUrl: `/contracts/${contract.id}`,
          entityType: "contract",
          entityId: contract.id,
        },
      });

      await prisma.task.create({
        data: {
          title: `Review health score: ${contract.contractName}`,
          description: `Health status changed from ${previousStatus} to ${newStatus} (score: ${healthScore}). Audit: ${auditPoints}/40, Contact: ${contactPoints}/20, Complaints: ${complaintPoints}/20, Staffing: ${staffingPoints}/10, Renewal: ${renewalPoints}/10.`,
          assignedTo: adminUser.id,
          createdBy: adminUser.id,
          contractId: contract.id,
          accountId: contract.accountId,
          priority: newStatus === "RED" ? "urgent" : "high",
          autoGenerated: true,
          sourceWorkflow: "health_score_change",
          dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days
        },
      });
    }

    results.push({
      contractId: contract.id,
      contractName: contract.contractName,
      previousStatus,
      newStatus,
      score: healthScore,
      breakdown: {
        audit: auditPoints,
        contactRecency: contactPoints,
        complaints: complaintPoints,
        staffing: staffingPoints,
        renewal: renewalPoints,
      },
      changed,
    });
  }

  return {
    processed: results.length,
    changed: results.filter((r) => r.changed).length,
    results,
  };
}
