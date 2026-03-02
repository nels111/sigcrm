"use client";

import { Suspense } from "react";
import { EmailsPageClient } from "@/components/emails/emails-page-client";

export default function EmailsPage() {
  return (
    <Suspense>
      <EmailsPageClient />
    </Suspense>
  );
}
