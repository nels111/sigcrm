"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit3,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Shield,
  Users,
  Briefcase,
  Handshake,
  Clock,
  Star,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

interface ContactRow {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
}

interface DealRow {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
  monthlyValue: string | null;
  dealType: string;
  expectedCloseDate: string | null;
  assignedTo: string | null;
}

interface ContractRow {
  id: string;
  contractName: string;
  status: string;
  monthlyRevenue: string | null;
  annualValue: string | null;
  startDate: string | null;
  endDate: string | null;
  healthStatus: string;
}

interface AccountDetail {
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
  updatedAt: string;
  contacts: ContactRow[];
  deals: DealRow[];
  contracts: ContractRow[];
  _count: {
    activities: number;
    contacts: number;
    deals: number;
    contracts: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRY_OPTIONS: Record<string, string> = {
  PBSA: "PBSA",
  PostConstruction: "Post Construction",
  BioHazard: "Bio Hazard",
  Industrial: "Industrial",
  CommercialOffices: "Commercial Offices",
  CareSector: "Care Sector",
  School: "School",
  Leisure: "Leisure",
  CommercialGeneral: "Commercial (General)",
  DentalMedical: "Dental/Medical",
  HospitalityVenue: "Hospitality/Venue",
  WelfareConstruction: "Welfare/Construction",
};

const STAGE_LABELS: Record<string, string> = {
  NewLead: "New Lead",
  Contacted: "Contacted",
  SiteSurveyBooked: "Site Survey Booked",
  SurveyComplete: "Survey Complete",
  QuoteSent: "Quote Sent",
  Negotiation: "Negotiation",
  ClosedWonRecurring: "Won (Recurring)",
  ClosedWonOneOff: "Won (One-Off)",
  ClosedLostRecurring: "Lost (Recurring)",
  ClosedLostOneOff: "Lost (One-Off)",
};

function stageBadgeClass(stage: string): string {
  if (stage.startsWith("ClosedWon"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (stage.startsWith("ClosedLost"))
    return "bg-red-100 text-red-800 border-red-200";
  if (stage === "Negotiation")
    return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function contractStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "mobilising":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "on_hold":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "notice_given":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "terminated":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
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

function formatDate(date: string | null): string {
  if (!date) return "--";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const accountId = params.id as string;

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    city: "",
    county: "",
    postcode: "",
    phone: "",
    website: "",
  });

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/accounts");
          return;
        }
        throw new Error("Failed to fetch account");
      }
      const json = await res.json();
      setAccount(json.data);
      setEditForm({
        name: json.data.name || "",
        address: json.data.address || "",
        city: json.data.city || "",
        county: json.data.county || "",
        postcode: json.data.postcode || "",
        phone: json.data.phone || "",
        website: json.data.website || "",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [accountId, router, toast]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function handleSave() {
    if (!account) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update");
      }
      const json = await res.json();
      setAccount((prev) => (prev ? { ...prev, ...json.data } : prev));
      setEditing(false);
      toast({ title: "Updated", description: "Account updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update account.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Account not found</p>
        <Button variant="outline" onClick={() => router.push("/accounts")}>
          Back to Accounts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/accounts")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {account.name}
              </h1>
              {account.isProtected && (
                <Shield className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {account.industry
                ? INDUSTRY_OPTIONS[account.industry] || account.industry
                : "No industry set"}
              {account.city && ` -- ${account.city}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Address</Label>
                    <Input
                      value={editForm.address}
                      onChange={(e) =>
                        setEditForm({ ...editForm, address: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">City</Label>
                      <Input
                        value={editForm.city}
                        onChange={(e) =>
                          setEditForm({ ...editForm, city: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">County</Label>
                      <Input
                        value={editForm.county}
                        onChange={(e) =>
                          setEditForm({ ...editForm, county: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Postcode</Label>
                      <Input
                        value={editForm.postcode}
                        onChange={(e) =>
                          setEditForm({ ...editForm, postcode: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Website</Label>
                      <Input
                        value={editForm.website}
                        onChange={(e) =>
                          setEditForm({ ...editForm, website: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p>
                        {[account.address, account.city, account.county, account.postcode]
                          .filter(Boolean)
                          .join(", ") || "--"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p>{account.phone || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Website</p>
                      {account.website ? (
                        <a
                          href={account.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          {account.website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p>--</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p>{formatDate(account.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contacts ({account.contacts.length})
                </CardTitle>
                <Link href={`/contacts?accountId=${account.id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7">
                    <Plus className="h-3 w-3" />
                    Add Contact
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {account.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No contacts linked to this account.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Name
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide hidden md:table-cell">
                          Email
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide hidden lg:table-cell">
                          Phone
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide hidden lg:table-cell">
                          Job Title
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                          Primary
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.contacts.map((contact) => (
                        <TableRow
                          key={contact.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/contacts/${contact.id}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {contact.firstName} {contact.lastName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {contact.email || "--"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {contact.phone || contact.mobile || "--"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {contact.jobTitle || "--"}
                          </TableCell>
                          <TableCell className="text-center">
                            {contact.isPrimary && (
                              <Star className="h-4 w-4 text-amber-500 mx-auto fill-amber-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Deals ({account.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No deals linked to this account.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Deal Name
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Stage
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                          Value
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide hidden lg:table-cell">
                          Type
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.deals.map((deal) => (
                        <TableRow
                          key={deal.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/deals/${deal.id}`)}
                        >
                          <TableCell className="font-medium">
                            {deal.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-medium whitespace-nowrap",
                                stageBadgeClass(deal.stage)
                              )}
                            >
                              {STAGE_LABELS[deal.stage] || deal.stage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            {formatCurrency(deal.amount)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground capitalize">
                            {deal.dealType?.replace("_", " ") || "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contracts section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Contracts ({account.contracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No contracts linked to this account.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Contract
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                          Monthly Revenue
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-center">
                          Health
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.contracts.map((contract) => (
                        <TableRow
                          key={contract.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/contracts/${contract.id}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {contract.contractName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-medium whitespace-nowrap",
                                contractStatusBadgeClass(contract.status)
                              )}
                            >
                              {contract.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            {formatCurrency(contract.monthlyRevenue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full mx-auto",
                                healthDotClass(contract.healthStatus)
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Account
              </Button>
              <Link href={`/contacts?accountId=${account.id}`} className="block">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Handshake className="h-4 w-4 mr-2" />
                Add Deal
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
            </CardContent>
          </Card>

          {/* Summary stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contacts</span>
                <span className="font-medium">{account._count.contacts}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deals</span>
                <span className="font-medium">{account._count.deals}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contracts</span>
                <span className="font-medium">{account._count.contracts}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Activities</span>
                <span className="font-medium">{account._count.activities}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(account.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {account.notes || "No notes."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
