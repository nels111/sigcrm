import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Get the primary mail account for the logged-in user.
 * Maps session email to account alias (nick, nelson, or hello).
 */
export async function getSessionAccount(): Promise<"nick" | "nelson" | "hello"> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthenticated");

  const nickEmail = process.env.NICK_EMAIL || "nick@signature-cleans.co.uk";
  const nelsonEmail = process.env.NELSON_EMAIL || "nelson@signature-cleans.co.uk";

  if (session.user.email === nickEmail) return "nick";
  if (session.user.email === nelsonEmail) return "nelson";

  // Default to nick if not matched, but in practice this shouldn't happen
  return "nick";
}

/**
 * Get all mail accounts accessible by the logged-in user.
 * Nick sees: nick@ + hello@
 * Nelson sees: nelson@ + hello@
 */
export async function getAccessibleMailAccounts(): Promise<("nick" | "nelson" | "hello")[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthenticated");

  const nickEmail = process.env.NICK_EMAIL || "nick@signature-cleans.co.uk";
  const nelsonEmail = process.env.NELSON_EMAIL || "nelson@signature-cleans.co.uk";

  if (session.user.email === nickEmail) {
    return ["nick", "hello"];
  }

  if (session.user.email === nelsonEmail) {
    return ["nelson", "hello"];
  }

  // Fallback
  return ["nick"];
}

export async function getSessionEmail(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthenticated");
  return session.user.email;
}
