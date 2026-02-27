"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  X,
  LayoutGrid,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractRow {
  id: string;
  contractName: string;
  cellType: string;
  unitId: string | null;
  status: string;
  weeklyHours: number;
  monthlyRevenue: number;
  healthStatus: string;
  teamLead: string | null;
  nextAuditDate: string | null;
  latestAuditScore: number;
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

const CONTRACT_STATUS_OPTIONS = [
  { value: "mobilising", label: "Mobilising" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "notice_given", label: "Notice Given" },
  { value: "terminated", label: "Terminated" },
  { value: "archived", label: "Archived" },
];

const CELL_TYPE_OPTIONS = [
  { value: "A", label: "Cell A" },
  { value: "B", label: "Cell B" },
  { value: "C", label: "Cell C" },
];

const HEALTH_STATUS_OPTIONS = [
  { value: "GREEN", label: "Green" },
  { value: "AMBER", label: "Amber" },
  { value: "RED", label: "Red" },
];

function statusLabel(value: string): string {
  return (
    CONTRACT_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ---------------------------------------------------------------------------
// Badge colour mapping
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "mobilising":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "notice_given":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "terminated":
      return "bg-red-100 text-red-800 border-red-200";
    case "archived":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function cellTypeBadgeClass(cellType: string): string {
  switch (cellType) {
    case "A":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "B":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "C":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function healthDotClass(health: string): string {
  switch (health) {
    case "GREEN":
      return "bg-green-500";
    case "AMBER":
      return "bg-yellow-500";
    case "RED":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function healthLabel(health: string): string {
  return HEALTH_STATUS_OPTIONS.find((o) => o.value === health)?.label ?? health;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  try {
    return format(new Date(iso), "dd MMM yyyy");
  } catch {
    return "--";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SortField =
  | "contractName"
  | "cellType"
  | "status"
  | "weeklyHours"
  | "monthlyRevenue"
  | "healthStatus"
  | "nextAuditDate";
type SortOrder = "asc" | "desc";

export function ContractsPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [contracts, setContracts] = useState<ContractRow[]>([]);
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
  const [cellTypeFilter, setCellTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("contractName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (cellTypeFilter) params.set("cellType", cellTypeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (healthFilter) params.set("healthStatus", healthFilter);

      const res = await fetch(`/api/contracts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch contracts");
      const json = await res.json();
      setContracts(json.data);
      setPagination(json.pagination);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contracts.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    sortBy,
    sortOrder,
    debouncedSearch,
    cellTypeFilter,
    statusFilter,
    healthFilter,
    toast,
  ]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, cellTypeFilter, statusFilter, healthFilter]);

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
    if (sortBy !== field)
      return (
        <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />
      );
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // Clear all filters
  const hasActiveFilters =
    cellTypeFilter || statusFilter || healthFilter || debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCellTypeFilter("");
    setStatusFilter("");
    setHealthFilter("");
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage active contracts, track health status and audit schedules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/contracts/cells">
            <Button variant="outline" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Cell Dashboard
            </Button>
          </Link>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Contract
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filters bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contract name or unit ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter selects */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cellTypeFilter} onValueChange={setCellTypeFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Cell Type" />
              </SelectTrigger>
              <SelectContent>
                {CELL_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Health" />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${healthDotClass(opt.value)}`}
                      />
                      {opt.label}
                    </div>
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
                <TableHead>
                  <button
                    onClick={() => handleSort("contractName")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Contract Name
                    <SortIcon field="contractName" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("cellType")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Cell
                    <SortIcon field="cellType" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Unit ID</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Status
                    <SortIcon field="status" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("weeklyHours")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Weekly Hrs
                    <SortIcon field="weeklyHours" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("monthlyRevenue")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Monthly Rev
                    <SortIcon field="monthlyRevenue" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("healthStatus")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Health
                    <SortIcon field="healthStatus" />
                  </button>
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  Team Lead
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <button
                    onClick={() => handleSort("nextAuditDate")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Next Audit
                    <SortIcon field="nextAuditDate" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading contracts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {hasActiveFilters
                      ? "No contracts match your filters."
                      : 'No contracts yet. Click "New Contract" to create one.'}
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract) => (
                  <TableRow
                    key={contract.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/contracts/${contract.id}`)}
                  >
                    <TableCell className="font-medium">
                      {contract.contractName}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${cellTypeBadgeClass(contract.cellType)}`}
                      >
                        {contract.cellType}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {contract.unitId ? (
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {contract.unitId}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium whitespace-nowrap ${statusBadgeClass(contract.status)}`}
                      >
                        {statusLabel(contract.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {Number(contract.weeklyHours).toFixed(1)}h
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm font-medium">
                      {formatCurrency(Number(contract.monthlyRevenue))}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-3 w-3 rounded-full ${healthDotClass(contract.healthStatus)}`}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {healthLabel(contract.healthStatus)}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {contract.teamLead || "--"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {formatDate(contract.nextAuditDate)}
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
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {pagination.total}
              </span>{" "}
              contracts
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
      </div>
    </>
  );
}
