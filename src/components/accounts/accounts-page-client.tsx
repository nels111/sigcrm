"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  Shield,
  Building2,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Account {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  isProtected: boolean;
  notes: string | null;
  createdAt: string;
  _count: {
    contacts: number;
    deals: number;
    contracts: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRY_OPTIONS = [
  { value: "PBSA", label: "PBSA" },
  { value: "PostConstruction", label: "Post Construction" },
  { value: "BioHazard", label: "Bio Hazard" },
  { value: "Industrial", label: "Industrial" },
  { value: "CommercialOffices", label: "Commercial Offices" },
  { value: "CareSector", label: "Care Sector" },
  { value: "School", label: "School" },
  { value: "Leisure", label: "Leisure" },
  { value: "CommercialGeneral", label: "Commercial (General)" },
  { value: "DentalMedical", label: "Dental/Medical" },
  { value: "HospitalityVenue", label: "Hospitality/Venue" },
  { value: "WelfareConstruction", label: "Welfare/Construction" },
];

function industryLabel(value: string | null): string {
  if (!value) return "--";
  return INDUSTRY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function industryBadgeClass(industry: string): string {
  switch (industry) {
    case "PBSA":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "CommercialOffices":
    case "CommercialGeneral":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "PostConstruction":
    case "WelfareConstruction":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "CareSector":
    case "DentalMedical":
      return "bg-pink-100 text-pink-800 border-pink-200";
    case "School":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Leisure":
    case "HospitalityVenue":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "BioHazard":
      return "bg-red-100 text-red-800 border-red-200";
    case "Industrial":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SortField = "name" | "city" | "industry" | "createdAt";
type SortOrder = "asc" | "desc";

export function AccountsPageClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const isAdmin = session?.user?.role === "admin";

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
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
  const [industryFilter, setIndustryFilter] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    county: "",
    postcode: "",
    phone: "",
    website: "",
    industry: "",
    isProtected: false,
    notes: "",
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (industryFilter) params.set("industry", industryFilter);

      const res = await fetch(`/api/accounts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const json = await res.json();
      setAccounts(json.data);
      setPagination(json.pagination);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load accounts.",
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
    industryFilter,
    toast,
  ]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch, industryFilter]);

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
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // Clear all filters
  const hasActiveFilters = industryFilter || debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
    setIndustryFilter("");
  }

  // Create account
  async function handleCreate() {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Account name is required.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: formData.name.trim() };
      if (formData.address) body.address = formData.address;
      if (formData.city) body.city = formData.city;
      if (formData.county) body.county = formData.county;
      if (formData.postcode) body.postcode = formData.postcode;
      if (formData.phone) body.phone = formData.phone;
      if (formData.website) body.website = formData.website;
      if (formData.industry) body.industry = formData.industry;
      if (formData.isProtected) body.isProtected = true;
      if (formData.notes) body.notes = formData.notes;

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create account");
      }

      toast({ title: "Success", description: "Account created successfully." });
      setCreateOpen(false);
      setFormData({
        name: "",
        address: "",
        city: "",
        county: "",
        postcode: "",
        phone: "",
        website: "",
        industry: "",
        isProtected: false,
        notes: "",
      });
      fetchAccounts();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create account.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client accounts and their associated contacts, deals, and
            contracts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="space-y-4">
        {/* Filters bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((opt) => (
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
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Name
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    onClick={() => handleSort("industry")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Industry
                    <SortIcon field="industry" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">
                  <button
                    onClick={() => handleSort("city")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    City
                    <SortIcon field="city" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell text-center">
                  Protected
                </TableHead>
                <TableHead className="hidden xl:table-cell text-center">
                  Deals
                </TableHead>
                <TableHead className="hidden xl:table-cell text-center">
                  Contracts
                </TableHead>
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
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading accounts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {hasActiveFilters
                      ? "No accounts match your filters."
                      : 'No accounts yet. Click "New Account" to create one.'}
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow
                    key={account.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/accounts/${account.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        {account.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {account.industry ? (
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium whitespace-nowrap ${industryBadgeClass(account.industry)}`}
                        >
                          {industryLabel(account.industry)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">--</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {account.phone || "--"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {account.city || "--"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center">
                      {account.isProtected && (
                        <Shield className="h-4 w-4 text-amber-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center text-sm">
                      {account._count.deals}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center text-sm">
                      {account._count.contracts}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatDate(account.createdAt)}
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
              accounts
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

      {/* Create Account Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Account</DialogTitle>
            <DialogDescription>
              Add a new client account to the CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="acc-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="acc-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acc-address">Address</Label>
              <Input
                id="acc-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acc-city">City</Label>
                <Input
                  id="acc-city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-county">County</Label>
                <Input
                  id="acc-county"
                  value={formData.county}
                  onChange={(e) =>
                    setFormData({ ...formData, county: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acc-postcode">Postcode</Label>
                <Input
                  id="acc-postcode"
                  value={formData.postcode}
                  onChange={(e) =>
                    setFormData({ ...formData, postcode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-phone">Phone</Label>
                <Input
                  id="acc-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acc-website">Website</Label>
              <Input
                id="acc-website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(val) =>
                  setFormData({ ...formData, industry: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="acc-protected" className="text-sm font-medium">
                    Protected Account
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Protected accounts cannot be modified by non-admin users.
                  </p>
                </div>
                <Switch
                  id="acc-protected"
                  checked={formData.isProtected}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isProtected: checked })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="acc-notes">Notes</Label>
              <Textarea
                id="acc-notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
