import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface ScorecardData {
  weekEnding: string;
  // Contract / financial metrics
  totalContractedHours: number;
  totalMonthlyRevenue: number;
  totalLabourCost: number;
  labourPercent: number;
  consumablesTotal: number;
  grossMargin: number;
  grossMarginPercent: number;
  marginTrafficLight: "GREEN" | "AMBER" | "RED";
  // Pipeline activity
  newDealsThisWeek: number;
  dealsLostThisWeek: number;
  // Engagement
  cadenceEmailsSentThisWeek: number;
  overdueTasksCount: number;
  // Audit
  auditSummary: {
    totalAudits: number;
    avgScore: number;
    belowThreshold: number;
  };
  // Health
  healthSummary: {
    green: number;
    amber: number;
    red: number;
  };
}

// ──────────────────────────────────────────────
// MARGIN CLASSIFICATION
// ──────────────────────────────────────────────

function getMarginTrafficLight(
  marginPercent: number
): "GREEN" | "AMBER" | "RED" {
  if (marginPercent >= 35) return "GREEN";
  if (marginPercent >= 25) return "AMBER";
  return "RED";
}

// ──────────────────────────────────────────────
// MAIN GENERATOR
// ──────────────────────────────────────────────

export async function generateWeeklyScorecard(): Promise<ScorecardData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEnding = now.toISOString().split("T")[0];

  // ─── 1. Contract / Financial Metrics ─────────────
  const activeContracts = await prisma.contract.findMany({
    where: {
      deletedAt: null,
      status: { in: ["mobilising", "active"] },
    },
    select: {
      weeklyHours: true,
      monthlyRevenue: true,
      monthlyLabourCost: true,
      consumablesPercent: true,
      healthStatus: true,
    },
  });

  const totalContractedHours = activeContracts.reduce(
    (sum, c) => sum + Number(c.weeklyHours),
    0
  );
  const totalMonthlyRevenue = activeContracts.reduce(
    (sum, c) => sum + Number(c.monthlyRevenue),
    0
  );
  const totalLabourCost = activeContracts.reduce(
    (sum, c) => sum + Number(c.monthlyLabourCost),
    0
  );
  const labourPercent =
    totalMonthlyRevenue > 0
      ? (totalLabourCost / totalMonthlyRevenue) * 100
      : 0;
  const consumablesTotal = activeContracts.reduce(
    (sum, c) =>
      sum + Number(c.monthlyRevenue) * (Number(c.consumablesPercent) / 100),
    0
  );
  const grossMargin =
    totalMonthlyRevenue - totalLabourCost - consumablesTotal;
  const grossMarginPercent =
    totalMonthlyRevenue > 0
      ? (grossMargin / totalMonthlyRevenue) * 100
      : 0;
  const marginTrafficLight = getMarginTrafficLight(grossMarginPercent);

  // Health summary
  const healthSummary = {
    green: activeContracts.filter((c) => c.healthStatus === "GREEN").length,
    amber: activeContracts.filter((c) => c.healthStatus === "AMBER").length,
    red: activeContracts.filter((c) => c.healthStatus === "RED").length,
  };

  // ─── 2. Pipeline Activity ─────────────────────────
  const newDealsThisWeek = await prisma.deal.count({
    where: {
      deletedAt: null,
      createdAt: { gte: weekAgo },
    },
  });

  const dealsLostThisWeek = await prisma.deal.count({
    where: {
      deletedAt: null,
      stage: { in: ["ClosedLostRecurring", "ClosedLostOneOff"] },
      stageChangedAt: { gte: weekAgo },
    },
  });

  // ─── 3. Engagement Metrics ────────────────────────
  const cadenceEmailsSentThisWeek = await prisma.email.count({
    where: {
      isCadenceEmail: true,
      sentAt: { gte: weekAgo },
    },
  });

  const overdueTasksCount = await prisma.task.count({
    where: {
      status: { in: ["pending", "in_progress"] },
      dueDate: { lt: now },
    },
  });

  // ─── 4. Audit Summary ────────────────────────────
  const recentAudits = await prisma.audit.findMany({
    where: {
      auditDate: { gte: weekAgo },
    },
    select: {
      overallScore: true,
    },
  });

  const auditSummary = {
    totalAudits: recentAudits.length,
    avgScore:
      recentAudits.length > 0
        ? parseFloat(
            (
              recentAudits.reduce(
                (sum, a) => sum + Number(a.overallScore),
                0
              ) / recentAudits.length
            ).toFixed(1)
          )
        : 0,
    belowThreshold: recentAudits.filter((a) => Number(a.overallScore) < 70)
      .length,
  };

  // ─── 5. Build Scorecard Data ──────────────────────
  const scorecard: ScorecardData = {
    weekEnding,
    totalContractedHours: parseFloat(totalContractedHours.toFixed(1)),
    totalMonthlyRevenue: parseFloat(totalMonthlyRevenue.toFixed(2)),
    totalLabourCost: parseFloat(totalLabourCost.toFixed(2)),
    labourPercent: parseFloat(labourPercent.toFixed(1)),
    consumablesTotal: parseFloat(consumablesTotal.toFixed(2)),
    grossMargin: parseFloat(grossMargin.toFixed(2)),
    grossMarginPercent: parseFloat(grossMarginPercent.toFixed(1)),
    marginTrafficLight,
    newDealsThisWeek,
    dealsLostThisWeek,
    cadenceEmailsSentThisWeek,
    overdueTasksCount,
    auditSummary,
    healthSummary,
  };

  // ─── 6. Generate & Send Email ─────────────────────
  const html = buildScorecardHtml(scorecard);
  const subject = `Signature Cleans Weekly Scorecard — w/e ${weekEnding}`;

  // Find Nick and Nelson users
  const [nickUser, nelsonUser] = await Promise.all([
    prisma.user.findFirst({ where: { role: "sales" } }),
    prisma.user.findFirst({ where: { role: "admin" } }),
  ]);

  const recipientIds: string[] = [];

  if (nickUser) {
    await sendEmail({
      from: "nelson",
      to: nickUser.email,
      subject,
      html,
    });
    recipientIds.push(nickUser.id);
  }

  if (nelsonUser) {
    await sendEmail({
      from: "nelson",
      to: nelsonUser.email,
      subject,
      html,
    });
    recipientIds.push(nelsonUser.id);
  }

  // ─── 7. Create Notification Records ───────────────
  if (recipientIds.length > 0) {
    await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        title: "Weekly Scorecard",
        message: `Weekly scorecard for w/e ${weekEnding} has been generated and sent.`,
        notificationType: "weekly_scorecard" as const,
        linkUrl: "/reports",
        emailed: true,
        emailedAt: now,
      })),
    });
  }

  return scorecard;
}

// ──────────────────────────────────────────────
// HTML EMAIL BUILDER
// ──────────────────────────────────────────────

function trafficLightColor(status: "GREEN" | "AMBER" | "RED"): string {
  switch (status) {
    case "GREEN":
      return "#22c55e";
    case "AMBER":
      return "#f59e0b";
    case "RED":
      return "#ef4444";
  }
}

function buildScorecardHtml(data: ScorecardData): string {
  const marginColor = trafficLightColor(data.marginTrafficLight);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Weekly Scorecard</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:24px 32px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;">Weekly Scorecard</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#94a3b8;">Week ending ${data.weekEnding}</p>
            </td>
          </tr>

          <!-- Financial Summary -->
          <tr>
            <td style="padding:24px 32px;">
              <h2 style="margin:0 0 16px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Financial Summary</h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Total Contracted Hours (weekly)</td>
                  <td style="padding:8px;text-align:right;">${data.totalContractedHours.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Total Monthly Revenue</td>
                  <td style="padding:8px;text-align:right;">&pound;${data.totalMonthlyRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Total Labour Cost</td>
                  <td style="padding:8px;text-align:right;">&pound;${data.totalLabourCost.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Labour %</td>
                  <td style="padding:8px;text-align:right;">${data.labourPercent}%</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Consumables Total</td>
                  <td style="padding:8px;text-align:right;">&pound;${data.consumablesTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Gross Margin</td>
                  <td style="padding:8px;text-align:right;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:4px;background:${marginColor};color:#fff;font-weight:700;">
                      ${data.grossMarginPercent}% (&pound;${data.grossMargin.toLocaleString("en-GB", { minimumFractionDigits: 2 })})
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pipeline Activity -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Pipeline Activity</h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">New Deals This Week</td>
                  <td style="padding:8px;text-align:right;">${data.newDealsThisWeek}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Deals Lost This Week</td>
                  <td style="padding:8px;text-align:right;color:${data.dealsLostThisWeek > 0 ? "#ef4444" : "inherit"};">${data.dealsLostThisWeek}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Engagement -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Engagement</h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Cadence Emails Sent</td>
                  <td style="padding:8px;text-align:right;">${data.cadenceEmailsSentThisWeek}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Overdue Tasks</td>
                  <td style="padding:8px;text-align:right;color:${data.overdueTasksCount > 0 ? "#ef4444" : "inherit"};">${data.overdueTasksCount}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Audit Summary -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Audits (This Week)</h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Audits Completed</td>
                  <td style="padding:8px;text-align:right;">${data.auditSummary.totalAudits}</td>
                </tr>
                <tr>
                  <td style="padding:8px;font-weight:600;">Average Score</td>
                  <td style="padding:8px;text-align:right;">${data.auditSummary.avgScore}%</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;font-weight:600;">Below Threshold (&lt;70%)</td>
                  <td style="padding:8px;text-align:right;color:${data.auditSummary.belowThreshold > 0 ? "#ef4444" : "inherit"};">${data.auditSummary.belowThreshold}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contract Health -->
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:16px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Contract Health</h2>
              <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="padding:8px;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22c55e;margin-right:6px;vertical-align:middle;"></span>
                    Green
                  </td>
                  <td style="padding:8px;text-align:right;font-weight:600;">${data.healthSummary.green}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td style="padding:8px;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f59e0b;margin-right:6px;vertical-align:middle;"></span>
                    Amber
                  </td>
                  <td style="padding:8px;text-align:right;font-weight:600;">${data.healthSummary.amber}</td>
                </tr>
                <tr>
                  <td style="padding:8px;">
                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;margin-right:6px;vertical-align:middle;"></span>
                    Red
                  </td>
                  <td style="padding:8px;text-align:right;font-weight:600;">${data.healthSummary.red}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
              Generated by Signature Cleans CRM &mdash; ${new Date().toLocaleString("en-GB")}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
