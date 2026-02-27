"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Plus,
  Star,
  AlertCircle,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Audit {
  id: string;
  contractId: string;
  auditorId: string;
  auditDate: string;
  overallScore: string;
  clientSatisfactionScore: number | null;
  requiresFollowUp: boolean;
  followUpCompleted: boolean;
  notes: string | null;
  contract: {
    id: string;
    contractName: string;
    account?: { id: string; name: string } | null;
  };
  auditor: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface ContractOption {
  id: string;
  contractName: string;
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

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

function scoreBgColor(score: number): string {
  if (score >= 85) return "bg-emerald-50 border-emerald-200";
  if (score >= 70) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function renderStars(count: number | null) {
  if (count == null) return <span className="text-xs text-muted-foreground">--</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < count
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditsPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  const [audits, setAudits] = useState<Audit[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [contractFilter, setContractFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  // Fetch contracts for the filter dropdown
  useEffect(() => {
    async function fetchContracts() {
      try {
        const res = await fetch("/api/contracts?limit=100&status=active");
        if (res.ok) {
          const json = await res.json();
          setContracts(
            (json.data ?? []).map((c: ContractOption) => ({
              id: c.id,
              contractName: c.contractName,
            }))
          );
        }
      } catch {
        // Silently fail — contracts are optional filter
      }
    }
    fetchContracts();
  }, []);

  // Fetch audits
  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      if (contractFilter) params.set("contractId", contractFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minScore) params.set("minScore", minScore);
      if (maxScore) params.set("maxScore", maxScore);

      const res = await fetch(`/api/audits?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audits");
      const json = await res.json();
      setAudits(json.data ?? []);
      if (json.pagination) {
        setPagination(json.pagination);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load audits.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, contractFilter, dateFrom, dateTo, minScore, maxScore, toast]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [contractFilter, dateFrom, dateTo, minScore, maxScore]);

  const hasActiveFilters = contractFilter || dateFrom || dateTo || minScore || maxScore;

  function clearAllFilters() {
    setContractFilter("");
    setDateFrom("");
    setDateTo("");
    setMinScore("");
    setMaxScore("");
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quality audits across all cleaning contracts.
          </p>
        </div>
        <Link href="/audits/new">
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            New Audit
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Contract</label>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue placeholder="All Contracts" />
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

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px] h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px] h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Score</label>
            <Input
              type="number"
              placeholder="0"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-[80px] h-9 text-xs"
              min={0}
              max={100}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Score</label>
            <Input
              type="number"
              placeholder="100"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-[80px] h-9 text-xs"
              min={0}
              max={100}
            />
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
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Contract
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Date
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                Overall Score
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Auditor
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-center">
                Client Satisfaction
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide text-center">
                Follow-up
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading audits...
                  </div>
                </TableCell>
              </TableRow>
            ) : audits.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-40 text-center text-muted-foreground"
                >
                  {hasActiveFilters ? (
                    "No audits match your filters."
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <ClipboardCheck className="h-8 w-8 opacity-30" />
                      <p>No audits yet.</p>
                      <Link href="/audits/new">
                        <Button
                          size="sm"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create your first audit
                        </Button>
                      </Link>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              audits.map((audit) => {
                const score = parseFloat(audit.overallScore);
                return (
                  <TableRow
                    key={audit.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/audits/new`)}
                  >
                    <TableCell className="font-medium">
                      {audit.contract.contractName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(audit.auditDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-bold border",
                          scoreBgColor(score),
                          scoreColor(score)
                        )}
                      >
                        {score.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {audit.auditor.name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex justify-center">
                        {renderStars(audit.clientSatisfactionScore)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-center">
                      {audit.requiresFollowUp ? (
                        audit.followUpCompleted ? (
                          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Done
                          </Badge>
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
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
            audits
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
    </>
  );
}
