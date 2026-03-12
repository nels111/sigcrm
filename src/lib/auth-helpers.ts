import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionAccount(): Promise<"nick" | "nelson"> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthenticated");
  return session.user.email === "nick@signature-cleans.co.uk"
    ? "nick"
    : "nelson";
}

export async function getSessionEmail(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthenticated");
  return session.user.email;
}
