import cron from "node-cron";
import { runCadenceEngine } from "@/lib/cadence-engine";
import { runQuoteFollowUp } from "@/lib/quote-follow-up";

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
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.ENABLE_CRONS === "true") return true;
  return false;
}

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

  // Daily at 9:00 AM — Quote Follow-Up
  cron.schedule("0 9 * * *", async () => {
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
