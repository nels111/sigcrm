/**
 * Next.js Instrumentation Hook
 *
 * Called once when the Next.js server starts. We use it to boot cron jobs
 * so they run in the long-lived Node.js process (not in edge/serverless).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not edge workers)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCronJobs } = await import("@/lib/cron-jobs");
    initCronJobs();
  }
}
