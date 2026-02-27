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
  Plus,
  X,
  Star,
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

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  createdAt: string;
  account: {
    id: string;
    name: string;
  } | null;
}

interface AccountOption {
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

type SortField = "firstName" | "lastName" | "email" | "createdAt";
type SortOrder = "asc" | "desc";

export function ContactsPageClient() {
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [contacts, setContacts] = useState<Contact[]>([]);
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

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [accounts, setAccountsList] = useState<AccountOption[]>([]);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    jobTitle: "",
    accountId: "",
    isPrimary: false,
    notes: "",
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const json = await res.json();
      setContacts(json.data);
      setPagination(json.pagination);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contacts.",
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
    toast,
  ]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Reset page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [debouncedSearch]);

  // Fetch accounts for dropdown when dialog opens
  useEffect(() => {
    if (!createOpen) return;
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts?limit=100&sortBy=name&sortOrder=asc");
        if (!res.ok) return;
        const json = await res.json();
        setAccountsList(
          json.data.map((a: { id: string; name: string }) => ({
            id: a.id,
            name: a.name,
          }))
        );
      } catch {
        // silently fail — dropdown will be empty
      }
    }
    loadAccounts();
  }, [createOpen]);

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

  const hasActiveFilters = !!debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
  }

  // Create contact
  async function handleCreate() {
    if (!formData.lastName.trim()) {
      toast({
        title: "Error",
        description: "Last name is required.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        lastName: formData.lastName.trim(),
      };
      if (formData.firstName) body.firstName = formData.firstName;
      if (formData.email) body.email = formData.email;
      if (formData.phone) body.phone = formData.phone;
      if (formData.mobile) body.mobile = formData.mobile;
      if (formData.jobTitle) body.jobTitle = formData.jobTitle;
      if (formData.accountId) body.accountId = formData.accountId;
      if (formData.isPrimary) body.isPrimary = true;
      if (formData.notes) body.notes = formData.notes;

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create contact");
      }

      toast({
        title: "Success",
        description: "Contact created successfully.",
      });
      setCreateOpen(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        mobile: "",
        jobTitle: "",
        accountId: "",
        isPrimary: false,
        notes: "",
      });
      fetchContacts();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create contact.",
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
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage contacts and their linked accounts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Contact
        </Button>
      </div>

      <div className="space-y-4">
        {/* Filters bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
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

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>
                  <button
                    onClick={() => handleSort("lastName")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Name
                    <SortIcon field="lastName" />
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    onClick={() => handleSort("email")}
                    className="flex items-center text-xs font-medium uppercase tracking-wide hover:text-foreground transition-colors"
                  >
                    Email
                    <SortIcon field="email" />
                  </button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">
                  Job Title
                </TableHead>
                <TableHead className="hidden md:table-cell">Account</TableHead>
                <TableHead className="text-center">Primary</TableHead>
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
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading contacts...
                    </div>
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {hasActiveFilters
                      ? "No contacts match your search."
                      : 'No contacts yet. Click "New Contact" to create one.'}
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    <TableCell className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {contact.email || "--"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {contact.phone || "--"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {contact.jobTitle || "--"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {contact.account ? (
                        <Badge
                          variant="outline"
                          className="text-[11px] gap-1"
                        >
                          <Building2 className="h-3 w-3" />
                          {contact.account.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {contact.isPrimary && (
                        <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatDate(contact.createdAt)}
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
              contacts
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

      {/* Create Contact Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contact</DialogTitle>
            <DialogDescription>
              Add a new contact, optionally linked to an account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ct-first">First Name</Label>
                <Input
                  id="ct-first"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-last">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ct-last"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-email">Email</Label>
              <Input
                id="ct-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ct-phone">Phone</Label>
                <Input
                  id="ct-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ct-mobile">Mobile</Label>
                <Input
                  id="ct-mobile"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-job">Job Title</Label>
              <Input
                id="ct-job"
                value={formData.jobTitle}
                onChange={(e) =>
                  setFormData({ ...formData, jobTitle: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={formData.accountId}
                onValueChange={(val) =>
                  setFormData({ ...formData, accountId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="ct-primary" className="text-sm font-medium">
                  Primary Contact
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mark this as the primary contact for the linked account.
                </p>
              </div>
              <Switch
                id="ct-primary"
                checked={formData.isPrimary}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPrimary: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ct-notes">Notes</Label>
              <Textarea
                id="ct-notes"
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
              Create Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
