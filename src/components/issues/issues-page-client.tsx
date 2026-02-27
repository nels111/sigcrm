"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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
import { Switch } from "@/components/ui/switch";
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

interface Issue {
  id: string;
  contractId: string;
  title: string;
  description: string;
  severity: string;
  category: string | null;
  status: string;
  slaBreached: boolean;
  reportedAt: string;
  reportedBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaResponseTarget: string | null;
  slaResolutionTarget: string | null;
  assignedTo: string | null;
  contract: { id: string; contractName: string };
  account: { id: string; name: string } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

interface ContractOption {
  id: string;
  contractName: string;
}

interface UserOption {
  id: string;
  name: string;
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

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] capitalize", styles[severity] ?? "")}
    >
      {severity}
    </Badge>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-amber-100 text-amber-800 border-amber-200",
    resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    closed: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] capitalize", styles[status] ?? "")}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}

function slaBadge(breached: boolean) {
  if (breached) {
    return (
      <Badge variant="outline" className="text-[11px] bg-red-100 text-red-800 border-red-200">
        Breached
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
      On Track
    </Badge>
  );
}

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_OPTIONS = [
  { value: "quality", label: "Quality" },
  { value: "missed_clean", label: "Missed Clean" },
  { value: "equipment", label: "Equipment" },
  { value: "staff", label: "Staff" },
  { value: "access", label: "Access" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssuesPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [slaBreachedFilter, setSlaBreachedFilter] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formContractId, setFormContractId] = useState("");
  const [formSeverity, setFormSeverity] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState("");

  // Fetch reference data
  useEffect(() => {
    async function fetchRefData() {
      try {
        const [contractsRes] = await Promise.all([
          fetch("/api/contracts?limit=100"),
        ]);
        if (contractsRes.ok) {
          const json = await contractsRes.json();
          setContracts(
            (json.data ?? []).map((c: ContractOption) => ({
              id: c.id,
              contractName: c.contractName,
            }))
          );
        }
      } catch {
        // Silently fail
      }

      // Fetch users for assignment dropdown - try accounts API users or find any user
      try {
        // There's no /api/users, so we'll try to get users from a different approach
        // For now use a simple fetch - in production this would be a proper endpoint
        const res = await fetch("/api/activities?limit=1");
        if (res.ok) {
          // Use a static approach since there's no users endpoint
          setUsers([]);
        }
      } catch {
        // Silently fail
      }
    }
    fetchRefData();
  }, []);

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (severityFilter) params.set("severity", severityFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (slaBreachedFilter) params.set("slaBreached", "true");

      const res = await fetch(`/api/issues?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch issues");
      const json = await res.json();
      setIssues(json.data ?? []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load issues.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, severityFilter, statusFilter, slaBreachedFilter, toast]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [severityFilter, statusFilter, slaBreachedFilter]);

  const hasActiveFilters = severityFilter || statusFilter || slaBreachedFilter;

  function clearAllFilters() {
    setSeverityFilter("");
    setStatusFilter("");
    setSlaBreachedFilter(false);
  }

  function resetForm() {
    setFormContractId("");
    setFormSeverity("");
    setFormCategory("");
    setFormTitle("");
    setFormDescription("");
    setFormAssignedTo("");
  }

  async function handleCreate() {
    if (!formContractId || !formSeverity || !formTitle || !formDescription) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: formContractId,
          severity: formSeverity,
          category: formCategory || null,
          title: formTitle.trim(),
          description: formDescription.trim(),
          assignedTo: formAssignedTo || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create issue");
      }

      toast({
        title: "Issue Reported",
        description: "The issue has been created successfully.",
      });

      setDialogOpen(false);
      resetForm();
      fetchIssues();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to report issue.",
        variant: "destructive",
      });
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Issues & Complaints
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and resolve issues with SLA monitoring.
          </p>
        </div>
        <Button
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Report Issue
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="slaBreached"
            checked={slaBreachedFilter}
            onCheckedChange={setSlaBreachedFilter}
          />
          <Label htmlFor="slaBreached" className="text-xs text-muted-foreground">
            SLA Breached Only
          </Label>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
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
                Title
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Contract
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                Severity
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Category
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                Status
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide text-center">
                SLA
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Assigned To
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Reported
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading issues...
                  </div>
                </TableCell>
              </TableRow>
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-40 text-center text-muted-foreground"
                >
                  {hasActiveFilters ? (
                    "No issues match your filters."
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle className="h-8 w-8 opacity-30" />
                      <p>No issues reported yet.</p>
                      <Button
                        size="sm"
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setDialogOpen(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Report first issue
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => (
                <TableRow
                  key={issue.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/issues/${issue.id}`)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {issue.title}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {issue.contract.contractName}
                  </TableCell>
                  <TableCell className="text-center">
                    {severityBadge(issue.severity)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground capitalize">
                    {issue.category?.replace("_", " ") ?? "--"}
                  </TableCell>
                  <TableCell className="text-center">
                    {statusBadge(issue.status)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center">
                    {slaBadge(issue.slaBreached)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {issue.assignee?.name ?? "--"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {format(new Date(issue.reportedAt), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))
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
            issues
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

      {/* Report Issue Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Contract *</Label>
              <Select value={formContractId} onValueChange={setFormContractId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select contract..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity *</Label>
                <Select value={formSeverity} onValueChange={setFormSeverity}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Brief description of the issue..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Detailed description of the issue..."
                className="mt-1"
                rows={4}
              />
            </div>

            {users.length > 0 && (
              <div>
                <Label>Assign To</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                "Report Issue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
