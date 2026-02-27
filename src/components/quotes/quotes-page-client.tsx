"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Quote {
  id: string;
  quoteRef: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  monthlyTotal: string;
  annualTotal: string;
  status: string;
  sentAt: string | null;
  followUpCount: number;
  lastFollowUpAt: string | null;
  createdAt: string;
  deal?: { id: string; name: string } | null;
  lead?: { id: string; companyName: string } | null;
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "sent":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "expired":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function formatCurrency(value: string | number | null): string {
  if (value == null) return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "--";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuotesPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [quotes, setQuotes] = useState<Quote[]>([]);
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch quotes
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      const json = await res.json();
      setQuotes(json.data ?? []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load quotes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, toast]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, statusFilter]);

  // Clear filters
  const hasActiveFilters = statusFilter || debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
  }

  // Actions
  async function handleAction(quoteId: string, action: string) {
    // Map action names to API payload
    const actionMap: Record<string, Record<string, unknown>> = {
      mark_accepted: { status: "accepted" },
      mark_rejected: { status: "rejected" },
      resend: { status: "sent" },
    };

    const payload = actionMap[action];
    if (!payload) {
      // Non-API actions like view_pdf
      if (action === "view_pdf") {
        router.push(`/quotes/${quoteId}`);
      }
      return;
    }

    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${action.replace("_", " ")} quote`);
      }
      toast({
        title: "Success",
        description: `Quote ${action.replace("_", " ")} successfully.`,
      });
      fetchQuotes();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : `Failed to ${action.replace("_", " ")} quote.`,
        variant: "destructive",
      });
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track cleaning service quotes.
          </p>
        </div>
        <Link href="/quotes/new">
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            New Quote
          </Button>
        </Link>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or quote ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
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

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Quote Ref
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Company
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Contact
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-right">
                Monthly
              </TableHead>
              <TableHead className="hidden xl:table-cell text-xs font-medium uppercase tracking-wide text-right">
                Annual
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Status
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Sent
              </TableHead>
              <TableHead className="hidden xl:table-cell text-xs font-medium uppercase tracking-wide text-center">
                Follow-ups
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading quotes...
                  </div>
                </TableCell>
              </TableRow>
            ) : quotes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-40 text-center text-muted-foreground"
                >
                  {hasActiveFilters ? (
                    "No quotes match your filters."
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-8 w-8 opacity-30" />
                      <p>No quotes yet.</p>
                      <Link href="/quotes/new">
                        <Button
                          size="sm"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create your first quote
                        </Button>
                      </Link>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((quote) => (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/quotes/${quote.id}`)}
                >
                  <TableCell className="font-mono text-sm font-medium">
                    {quote.quoteRef}
                  </TableCell>
                  <TableCell className="font-medium">
                    {quote.companyName}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {quote.contactName}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-right font-medium">
                    {formatCurrency(quote.monthlyTotal)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm text-right text-muted-foreground">
                    {formatCurrency(quote.annualTotal)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium whitespace-nowrap capitalize ${statusBadgeClass(quote.status)}`}
                    >
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {formatDate(quote.sentAt)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-center">
                    {quote.followUpCount > 0 ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {quote.followUpCount}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/quotes/${quote.id}`)
                          }
                        >
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          View Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleAction(quote.id, "view_pdf")
                          }
                        >
                          View PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {quote.status !== "accepted" &&
                          quote.status !== "rejected" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAction(quote.id, "resend")
                              }
                            >
                              Resend to Client
                            </DropdownMenuItem>
                          )}
                        {quote.status !== "accepted" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleAction(quote.id, "mark_accepted")
                            }
                            className="text-emerald-700"
                          >
                            Mark Accepted
                          </DropdownMenuItem>
                        )}
                        {quote.status !== "rejected" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleAction(quote.id, "mark_rejected")
                            }
                            className="text-red-700"
                          >
                            Mark Rejected
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              {Math.min(
                pagination.page * pagination.limit,
                pagination.total
              )}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {pagination.total}
            </span>{" "}
            quotes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: prev.page - 1,
                }))
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
                setPagination((prev) => ({
                  ...prev,
                  page: prev.page + 1,
                }))
              }
              className="h-8 gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
