"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
  UserPlus,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  leadStatus: string;
  engagementStage: string;
  leadSource: string | null;
  cadenceStatus: string;
  cadenceStep: number;
  tags: string[];
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Enum display helpers
// ---------------------------------------------------------------------------

const LEAD_STATUS_OPTIONS = [
  { value: "NewLead", label: "New Lead" },
  { value: "Contacted", label: "Contacted" },
  { value: "MeetingBooked", label: "Meeting Booked" },
  { value: "MeetingAttended", label: "Meeting Attended" },
  { value: "IncomingCall", label: "Incoming Call" },
  { value: "QuoteSent", label: "Quote Sent" },
  { value: "QuoteAccepted", label: "Quote Accepted" },
  { value: "QuoteRejected", label: "Quote Rejected" },
  { value: "FollowUpSent", label: "Follow Up Sent" },
  { value: "PreviousCustomer", label: "Previous Customer" },
  { value: "OngoingCustomer", label: "Ongoing Customer" },
];

const ENGAGEMENT_OPTIONS = [
  { value: "NeverEngaged", label: "Never Engaged" },
  { value: "ColdProspect", label: "Cold Prospect" },
  { value: "WarmProspect", label: "Warm Prospect" },
  { value: "HotLead", label: "Hot Lead" },
  { value: "MeetingBooked", label: "Meeting Booked" },
  { value: "Quoted", label: "Quoted" },
  { value: "Negotiating", label: "Negotiating" },
  { value: "CurrentOngoing", label: "Current Ongoing" },
  { value: "WorkCeased", label: "Work Ceased" },
];

const SOURCE_OPTIONS = [
  { value: "LandingPage", label: "Landing Page" },
  { value: "ColdCall", label: "Cold Call" },
  { value: "Referral", label: "Referral" },
  { value: "NetworkEvent", label: "Network Event" },
  { value: "ApolloAI", label: "Apollo AI" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Facebook", label: "Facebook" },
  { value: "XTwitter", label: "X (Twitter)" },
  { value: "WebResearch", label: "Web Research" },
  { value: "Chat", label: "Chat" },
  { value: "GoogleAds", label: "Google Ads" },
  { value: "Seminar", label: "Seminar" },
  { value: "TradeShow", label: "Trade Show" },
  { value: "QuickCapture", label: "Quick Capture" },
  { value: "QuoteForm", label: "Quote Form" },
];

const CADENCE_OPTIONS = [
  { value: "NotStarted", label: "Not Started" },
  { value: "ActiveInCadence", label: "Active in Cadence" },
  { value: "PausedMeeting", label: "Paused - Meeting" },
  { value: "PausedReplied", label: "Paused - Replied" },
  { value: "StoppedActiveClient", label: "Stopped - Active Client" },
  { value: "StoppedUnsubscribed", label: "Stopped - Unsubscribed" },
  { value: "CompletedNoResponse", label: "Completed - No Response" },
  { value: "LongTermNurture", label: "Long Term Nurture" },
];

function statusLabel(value: string): string {
  return (
    LEAD_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/([A-Z])/g, " $1").trim()
  );
}

function engagementLabel(value: string): string {
  return (
    ENGAGEMENT_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/([A-Z])/g, " $1").trim()
  );
}

function sourceLabel(value: string | null): string {
  if (!value) return "--";
  return (
    SOURCE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/([A-Z])/g, " $1").trim()
  );
}

function cadenceLabel(value: string): string {
  return (
    CADENCE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/([A-Z])/g, " $1").trim()
  );
}

// ---------------------------------------------------------------------------
// Badge colour mapping
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "NewLead":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Contacted":
    case "FollowUpSent":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "MeetingBooked":
    case "MeetingAttended":
    case "IncomingCall":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "QuoteSent":
      return "bg-violet-100 text-violet-800 border-violet-200";
    case "QuoteAccepted":
    case "OngoingCustomer":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "QuoteRejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "PreviousCustomer":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function engagementBadgeClass(stage: string): string {
  switch (stage) {
    case "NeverEngaged":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "ColdProspect":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "WarmProspect":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "HotLead":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "MeetingBooked":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "Quoted":
    case "Negotiating":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "CurrentOngoing":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "WorkCeased":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function cadenceBadgeClass(status: string): string {
  switch (status) {
    case "NotStarted":
      return "bg-gray-100 text-gray-600 border-gray-200";
    case "ActiveInCadence":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "PausedMeeting":
    case "PausedReplied":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "StoppedActiveClient":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "StoppedUnsubscribed":
      return "bg-red-100 text-red-700 border-red-200";
    case "CompletedNoResponse":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "LongTermNurture":
      return "bg-sky-100 text-sky-700 border-sky-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SortField =
  | "companyName"
  | "contactName"
  | "leadStatus"
  | "engagementStage"
  | "leadSource"
  | "cadenceStatus"
  | "createdAt";
type SortOrder = "asc" | "desc";

export function LeadsTable() {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [engagementFilter, setEngagementFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [cadenceFilter, setCadenceFilter] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("leadStatus", statusFilter);
      if (engagementFilter) params.set("engagementStage", engagementFilter);
      if (sourceFilter) params.set("leadSource", sourceFilter);
      if (cadenceFilter) params.set("cadenceStatus", cadenceFilter);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const json = await res.json();
      setLeads(json.data);
      setPagination(json.pagination);
    } catch {
      toast({ title: "Error", description: "Failed to load leads.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder, debouncedSearch, statusFilter, engagementFilter, sourceFilter, cadenceFilter, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, statusFilter, engagementFilter, sourceFilter, cadenceFilter]);

  // Sort toggle
  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // Selection helpers
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Bulk actions
  async function bulkAction(action: string, data?: Record<string, string>) {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, leadIds: Array.from(selected), data }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      const json = await res.json();
      toast({ title: "Success", description: json.message });
      setSelected(new Set());
      fetchLeads();
    } catch {
      toast({ title: "Error", description: "Bulk action failed.", variant: "destructive" });
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Clear all filters
  const hasActiveFilters = statusFilter || engagementFilter || sourceFilter || cadenceFilter || debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setEngagementFilter("");
    setSourceFilter("");
    setCadenceFilter("");
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company, contact, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter selects */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Lead Status" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={engagementFilter} onValueChange={setEngagementFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="Engagement" />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cadenceFilter} onValueChange={setCadenceFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <SelectValue placeholder="Cadence" />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selected.size} lead{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              const userId = prompt("Enter user ID to assign:");
              if (userId) bulkAction("assign", { assignedTo: userId });
            }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              const tag = prompt("Enter tag:");
              if (tag) bulkAction("tag", { tag });
            }}
          >
            <Tag className="h-3.5 w-3.5" />
            Add Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => bulkAction("startCadence")}
          >
            <Play className="h-3.5 w-3.5" />
            Start Cadence
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Delete ${selected.size} lead(s)?`)) bulkAction("delete");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("companyName")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Company
                  <SortIcon field="companyName" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("contactName")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Contact
                  <SortIcon field="contactName" />
                </button>
              </TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("leadStatus")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Status
                  <SortIcon field="leadStatus" />
                </button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <button
                  onClick={() => handleSort("engagementStage")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Engagement
                  <SortIcon field="engagementStage" />
                </button>
              </TableHead>
              <TableHead className="hidden lg:table-cell">
                <button
                  onClick={() => handleSort("leadSource")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Source
                  <SortIcon field="leadSource" />
                </button>
              </TableHead>
              <TableHead className="hidden xl:table-cell">
                <button
                  onClick={() => handleSort("cadenceStatus")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Cadence
                  <SortIcon field="cadenceStatus" />
                </button>
              </TableHead>
              <TableHead className="hidden xl:table-cell">Assigned To</TableHead>
              <TableHead className="hidden md:table-cell">
                <button
                  onClick={() => handleSort("createdAt")}
                  className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Created
                  <SortIcon field="createdAt" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading leads...
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-40 text-center text-muted-foreground">
                  {hasActiveFilters
                    ? "No leads match your filters."
                    : "No leads yet. Click \"Add Lead\" to create one."}
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  data-state={selected.has(lead.id) ? "selected" : undefined}
                  onClick={(e) => {
                    // Don't navigate when clicking checkbox
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                    router.push(`/leads/${lead.id}`);
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => toggleOne(lead.id)}
                      aria-label={`Select ${lead.companyName}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{lead.companyName}</TableCell>
                  <TableCell>{lead.contactName}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {lead.contactEmail || "--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium whitespace-nowrap ${statusBadgeClass(lead.leadStatus)}`}
                    >
                      {statusLabel(lead.leadStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium whitespace-nowrap ${engagementBadgeClass(lead.engagementStage)}`}
                    >
                      {engagementLabel(lead.engagementStage)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {sourceLabel(lead.leadSource)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium whitespace-nowrap ${cadenceBadgeClass(lead.cadenceStatus)}`}
                    >
                      {cadenceLabel(lead.cadenceStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                    {lead.assignee?.name || "--"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 0 && (
        <div className="flex items-center justify-between px-1">
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
            <span className="font-medium text-foreground">{pagination.total}</span> leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
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
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="h-8 gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
