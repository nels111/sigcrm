"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";

export function LeadsPageClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleCreated() {
    setFormOpen(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your sales leads through the pipeline.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Table */}
      <LeadsTable key={refreshKey} />

      {/* Create dialog */}
      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleCreated}
      />
    </>
  );
}
