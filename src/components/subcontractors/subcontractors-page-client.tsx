"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  HardHat,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subcontractor {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  hourlyRate: string;
  supervisorRate: string | null;
  regions: string[];
  performanceScore: string;
  totalWeeklyHours: string;
  status: string;
  insuranceExpiry: string | null;
  dbsExpiry: string | null;
  subcontractorAgreementSigned: boolean;
  contracts: Array<{
    id: string;
    contractName: string;
    weeklyHours: string;
    healthStatus: string;
    latestAuditScore: string;
    status: string;
  }>;
  contractCount?: number;
  totalWeeklyHoursCalc?: number;
  complianceStatus?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function complianceBadge(status: string | undefined) {
  switch (status) {
    case "GREEN":
      return (
        <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
          GREEN
        </Badge>
      );
    case "AMBER":
      return (
        <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
          AMBER
        </Badge>
      );
    case "RED":
      return (
        <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
          RED
        </Badge>
      );
    default:
      return <span className="text-xs text-muted-foreground">--</span>;
  }
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubcontractorsPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // New subcontractor form
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formHourlyRate, setFormHourlyRate] = useState("");
  const [formSupervisorRate, setFormSupervisorRate] = useState("");
  const [formRegions, setFormRegions] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchSubcontractors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/subcontractors?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch subcontractors");
      const json = await res.json();
      setSubcontractors(json.data ?? []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load subcontractors.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, toast]);

  useEffect(() => {
    fetchSubcontractors();
  }, [fetchSubcontractors]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [statusFilter]);

  function resetForm() {
    setFormName("");
    setFormCompany("");
    setFormEmail("");
    setFormPhone("");
    setFormHourlyRate("");
    setFormSupervisorRate("");
    setFormRegions("");
    setFormNotes("");
  }

  async function handleCreate() {
    if (!formName.trim()) {
      toast({
        title: "Validation Error",
        description: "Contact name is required.",
        variant: "destructive",
      });
      return;
    }
    if (!formHourlyRate) {
      toast({
        title: "Validation Error",
        description: "Hourly rate is required.",
        variant: "destructive",
      });
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch("/api/subcontractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: formName.trim(),
          companyName: formCompany.trim() || null,
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          hourlyRate: parseFloat(formHourlyRate),
          supervisorRate: formSupervisorRate
            ? parseFloat(formSupervisorRate)
            : null,
          regions: formRegions
            ? formRegions.split(",").map((r) => r.trim()).filter(Boolean)
            : [],
          notes: formNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create subcontractor");
      }

      toast({
        title: "Subcontractor Added",
        description: `${formName.trim()} has been added successfully.`,
      });

      setDialogOpen(false);
      resetForm();
      fetchSubcontractors();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to add subcontractor.",
        variant: "destructive",
      });
    } finally {
      setFormSubmitting(false);
    }
  }

  const hasActiveFilters = !!statusFilter;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subcontractors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage subcontractor profiles, compliance, and performance.
          </p>
        </div>
        <Button
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Subcontractor
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter("")}
            className="h-9 px-2 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Name
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Company
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                Hourly Rate
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-center">
                Sites
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-right">
                Weekly Hours
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide text-center">
                Performance
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                Compliance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading subcontractors...
                  </div>
                </TableCell>
              </TableRow>
            ) : subcontractors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-40 text-center text-muted-foreground"
                >
                  {hasActiveFilters ? (
                    "No subcontractors match your filters."
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <HardHat className="h-8 w-8 opacity-30" />
                      <p>No subcontractors yet.</p>
                      <Button
                        size="sm"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add your first subcontractor
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              subcontractors.map((sub) => {
                const perfScore = parseFloat(sub.performanceScore);
                const siteCount = sub.contractCount ?? sub.contracts.length;
                const totalHours =
                  sub.totalWeeklyHoursCalc ??
                  parseFloat(sub.totalWeeklyHours);

                return (
                  <TableRow
                    key={sub.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/subcontractors/${sub.id}`)}
                  >
                    <TableCell className="font-medium">
                      {sub.contactName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {sub.companyName || "--"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {"\u00A3"}{parseFloat(sub.hourlyRate).toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-center">
                      {siteCount}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-right">
                      {totalHours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          scoreColor(perfScore)
                        )}
                      >
                        {perfScore.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {complianceBadge(sub.complianceStatus)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 0 && (
        <div className="flex items-center justify-between px-1 mt-4">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(pagination.page - 1) * pagination.limit + 1}
            </span>
            {" - "}
            <span className="font-medium text-foreground">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {pagination.total}
            </span>{" "}
            subcontractors
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground min-w-[80px] text-center">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              className="h-8 gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Subcontractor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Subcontractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formName">Contact Name *</Label>
                <Input
                  id="formName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="formCompany">Company</Label>
                <Input
                  id="formCompany"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="ABC Cleaning Ltd"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formEmail">Email</Label>
                <Input
                  id="formEmail"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="formPhone">Phone</Label>
                <Input
                  id="formPhone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="07xxx xxxxxx"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formHourlyRate">Hourly Rate * ({"\u00A3"})</Label>
                <Input
                  id="formHourlyRate"
                  type="number"
                  step="0.01"
                  value={formHourlyRate}
                  onChange={(e) => setFormHourlyRate(e.target.value)}
                  placeholder="13.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="formSupervisorRate">
                  Supervisor Rate ({"\u00A3"})
                </Label>
                <Input
                  id="formSupervisorRate"
                  type="number"
                  step="0.01"
                  value={formSupervisorRate}
                  onChange={(e) => setFormSupervisorRate(e.target.value)}
                  placeholder="18.00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="formRegions">Regions (comma-separated)</Label>
              <Input
                id="formRegions"
                value={formRegions}
                onChange={(e) => setFormRegions(e.target.value)}
                placeholder="London, South East, Midlands"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="formNotes">Notes</Label>
              <Textarea
                id="formNotes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={formSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Subcontractor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
