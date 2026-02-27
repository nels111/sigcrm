"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit3,
  Loader2,
  Mail,
  Phone,
  Smartphone,
  Save,
  Star,
  Briefcase,
  Handshake,
  Clock,
  Send,
  XCircle,
  ChevronRight,
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

interface AccountInfo {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  website: string | null;
}

interface DealRow {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
  monthlyValue: string | null;
  dealType: string;
  expectedCloseDate: string | null;
}

interface ActivityRow {
  id: string;
  activityType: string;
  subject: string | null;
  body: string | null;
  createdAt: string;
  performer: {
    id: string;
    name: string;
  } | null;
}

interface EmailRow {
  id: string;
  direction: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  status: string;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

interface ContactDetail {
  id: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  jobTitle: string | null;
  isPrimary: boolean;
  notes: string | null;
  accountId: string | null;
  createdAt: string;
  updatedAt: string;
  account: AccountInfo | null;
  deals: DealRow[];
  activities: ActivityRow[];
  emails: EmailRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const INDUSTRY_LABELS: Record<string, string> = {
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

function stageBadgeClass(stage: string): string {
  if (stage.startsWith("ClosedWon"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (stage.startsWith("ClosedLost"))
    return "bg-red-100 text-red-800 border-red-200";
  if (stage === "Negotiation")
    return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
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

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activityTypeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const contactId = params.id as string;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    jobTitle: "",
  });

  const fetchContact = useCallback(async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/contacts");
          return;
        }
        throw new Error("Failed to fetch contact");
      }
      const json = await res.json();
      setContact(json.data);
      setEditForm({
        firstName: json.data.firstName || "",
        lastName: json.data.lastName || "",
        email: json.data.email || "",
        phone: json.data.phone || "",
        mobile: json.data.mobile || "",
        jobTitle: json.data.jobTitle || "",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contact.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [contactId, router, toast]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  async function handleSave() {
    if (!contact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update");
      }
      const json = await res.json();
      setContact((prev) => (prev ? { ...prev, ...json.data } : prev));
      setEditing(false);
      toast({ title: "Updated", description: "Contact updated successfully." });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to update contact.",
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

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Contact not found</p>
        <Button variant="outline" onClick={() => router.push("/contacts")}>
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/contacts")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{fullName}</h1>
              {contact.isPrimary && (
                <Badge
                  variant="outline"
                  className="gap-1 bg-amber-100 text-amber-800 border-amber-200"
                >
                  <Star className="h-3 w-3 fill-amber-500" />
                  Primary
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {contact.jobTitle || "No title"}
              {contact.account && ` at ${contact.account.name}`}
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
          {/* Contact info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input
                        value={editForm.firstName}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            firstName: e.target.value,
                          })
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input
                        value={editForm.lastName}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            lastName: e.target.value,
                          })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="h-8"
                    />
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
                      <Label className="text-xs">Mobile</Label>
                      <Input
                        value={editForm.mobile}
                        onChange={(e) =>
                          setEditForm({ ...editForm, mobile: e.target.value })
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Job Title</Label>
                    <Input
                      value={editForm.jobTitle}
                      onChange={(e) =>
                        setEditForm({ ...editForm, jobTitle: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p>{contact.email || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p>{contact.phone || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mobile</p>
                      <p>{contact.mobile || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Job Title</p>
                      <p>{contact.jobTitle || "--"}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked account */}
          {contact.account && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Linked Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/accounts/${contact.account.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{contact.account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.account.industry
                        ? INDUSTRY_LABELS[contact.account.industry] ||
                          contact.account.industry
                        : "No industry"}
                      {contact.account.phone && ` -- ${contact.account.phone}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Deals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Handshake className="h-4 w-4" />
                Deals ({contact.deals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.deals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No deals involving this contact.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Deal
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide">
                          Stage
                        </TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                          Value
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contact.deals.map((deal) => (
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emails section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails ({contact.emails.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.emails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No emails recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {contact.emails.slice(0, 10).map((email) => (
                    <div
                      key={email.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border text-sm"
                    >
                      <div
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                          email.direction === "outbound"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-sky-100 text-sky-600"
                        )}
                      >
                        {email.direction === "outbound" ? (
                          <Send className="h-3.5 w-3.5" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {email.direction === "outbound" ? "To" : "From"}:{" "}
                          {email.direction === "outbound"
                            ? email.toAddress
                            : email.fromAddress}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(email.sentAt || email.receivedAt || email.createdAt)}
                      </div>
                    </div>
                  ))}
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
                Edit Contact
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Handshake className="h-4 w-4 mr-2" />
                Create Deal
              </Button>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">
                  {contact.account ? (
                    <Link
                      href={`/accounts/${contact.account.id}`}
                      className="text-emerald-600 hover:underline"
                    >
                      {contact.account.name}
                    </Link>
                  ) : (
                    "None"
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary</span>
                <span className="font-medium">
                  {contact.isPrimary ? "Yes" : "No"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deals</span>
                <span className="font-medium">{contact.deals.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(contact.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 italic">
                  No activities recorded.
                </p>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                  {contact.activities.slice(0, 10).map((activity) => (
                    <div
                      key={activity.id}
                      className="relative flex gap-3 pb-4 last:pb-0"
                    >
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-medium">
                            {activityTypeLabel(activity.activityType)}
                          </p>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(activity.createdAt)}
                          </span>
                        </div>
                        {activity.subject && (
                          <p className="text-sm text-foreground mt-0.5">
                            {activity.subject}
                          </p>
                        )}
                        {activity.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {activity.body}
                          </p>
                        )}
                        {activity.performer && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            by {activity.performer.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {contact.notes || "No notes."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
