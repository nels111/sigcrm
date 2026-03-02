"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  User,
  X,
  PhoneCall,
  Send,
  ClipboardList,
  ArrowRightCircle,
  Factory,
  Globe,
  Tag,
  StickyNote,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog";
import { CreateTaskDialog } from "@/components/shared/create-task-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadDetail {
  id: string;
  companyName: string;
  address: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  leadStatus: string;
  engagementStage: string;
  leadSource: string | null;
  industry: string | null;
  cadenceStatus: string;
  cadenceStep: number;
  lastCadenceEmailAt: string | null;
  tags: string[];
  notes: string | null;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  convertedToAccountId: string | null;
  convertedToContactId: string | null;
  convertedToDealId: string | null;
  convertedAccount: { id: string; name: string } | null;
  convertedContact: { id: string; firstName: string | null; lastName: string } | null;
  convertedDeal: { id: string; name: string } | null;
  activities: Activity[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  activityType: string;
  subject: string | null;
  body: string | null;
  performer: { id: string; name: string } | null;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Enum options
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

const CADENCE_STATUS_OPTIONS = [
  { value: "NotStarted", label: "Not Started" },
  { value: "ActiveInCadence", label: "Active in Cadence" },
  { value: "PausedMeeting", label: "Paused - Meeting Scheduled" },
  { value: "PausedReplied", label: "Paused - Replied" },
  { value: "StoppedActiveClient", label: "Stopped - Active Client" },
  { value: "StoppedUnsubscribed", label: "Stopped - Unsubscribed" },
  { value: "CompletedNoResponse", label: "Completed - No Response" },
  { value: "LongTermNurture", label: "Long Term Nurture" },
];

// ---------------------------------------------------------------------------
// Badge helpers
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
// Activity icon / label helpers
// ---------------------------------------------------------------------------

function activityIcon(type: string) {
  switch (type) {
    case "call":
      return <PhoneCall className="h-4 w-4 text-blue-500" />;
    case "email_sent":
    case "cadence_email_sent":
      return <Send className="h-4 w-4 text-emerald-500" />;
    case "email_received":
      return <Mail className="h-4 w-4 text-sky-500" />;
    case "meeting":
    case "site_visit":
      return <Calendar className="h-4 w-4 text-amber-500" />;
    case "note":
    case "quick_capture":
      return <StickyNote className="h-4 w-4 text-slate-500" />;
    case "quote_sent":
    case "quote_accepted":
    case "quote_rejected":
      return <ClipboardList className="h-4 w-4 text-violet-500" />;
    case "deal_stage_change":
      return <ArrowRightCircle className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function activityTypeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForEnum(options: { value: string; label: string }[], value: string | null): string {
  if (!value) return "--";
  return options.find((o) => o.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Inline editable field component
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  icon,
  onSave,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleSave() {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="group flex items-start gap-3 py-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
          {label}
        </p>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave}>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCancel}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <p className="text-sm truncate">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            >
              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  // Tag editing
  const [newTag, setNewTag] = useState("");

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/leads");
          return;
        }
        throw new Error("Failed to fetch lead");
      }
      const json = await res.json();
      setLead(json.data);
      setNotesDraft(json.data.notes || "");
    } catch {
      toast({ title: "Error", description: "Failed to load lead.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [leadId, router, toast]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  async function updateField(field: string, value: string | string[] | number | null) {
    if (!lead) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error("Update failed");
      const json = await res.json();
      setLead((prev) => (prev ? { ...prev, ...json.data } : prev));
      toast({ title: "Updated", description: `${field.replace(/([A-Z])/g, " $1").trim()} updated.` });
    } catch {
      toast({ title: "Error", description: "Failed to update field.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleAddTag() {
    const trimmed = newTag.trim();
    if (!trimmed || !lead) return;
    if (lead.tags.includes(trimmed)) {
      setNewTag("");
      return;
    }
    updateField("tags", [...lead.tags, trimmed]);
    setNewTag("");
  }

  function handleRemoveTag(tag: string) {
    if (!lead) return;
    updateField("tags", lead.tags.filter((t) => t !== tag));
  }

  function handleSaveNotes() {
    updateField("notes", notesDraft);
    setEditingNotes(false);
  }

  async function handleDelete() {
    if (!lead) return;
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Deleted", description: "Lead deleted successfully." });
      router.push("/leads");
    } catch {
      toast({ title: "Error", description: "Failed to delete lead.", variant: "destructive" });
    }
  }

  // Cadence controls
  async function handleCadenceToggle() {
    if (!lead) return;
    const isPaused = lead.cadenceStatus.startsWith("Paused");
    const isActive = lead.cadenceStatus === "ActiveInCadence";
    if (isActive) {
      await updateField("cadenceStatus", "PausedReplied");
    } else if (isPaused) {
      await updateField("cadenceStatus", "ActiveInCadence");
    } else {
      // Start cadence
      await updateField("cadenceStatus", "ActiveInCadence");
    }
  }

  const isConverted = Boolean(lead?.convertedToAccountId || lead?.convertedToContactId || lead?.convertedToDealId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Lead not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/leads")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{lead.companyName}</h1>
            <p className="text-sm text-muted-foreground">{lead.contactName}</p>
          </div>
          <Badge
            variant="outline"
            className={`ml-2 text-xs font-medium ${statusBadgeClass(lead.leadStatus)}`}
          >
            {labelForEnum(LEAD_STATUS_OPTIONS, lead.leadStatus)}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs font-medium ${engagementBadgeClass(lead.engagementStage)}`}
          >
            {labelForEnum(ENGAGEMENT_OPTIONS, lead.engagementStage)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Converted banner */}
      {isConverted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800 mb-1">This lead has been converted</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {lead.convertedAccount && (
              <Link href={`/accounts/${lead.convertedAccount.id}`} className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
                Account: {lead.convertedAccount.name}
              </Link>
            )}
            {lead.convertedContact && (
              <Link href={`/contacts/${lead.convertedContact.id}`} className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
                Contact: {lead.convertedContact.firstName} {lead.convertedContact.lastName}
              </Link>
            )}
            {lead.convertedDeal && (
              <Link href={`/pipeline?deal=${lead.convertedDeal.id}`} className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
                Deal: {lead.convertedDeal.name}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCallDialogOpen(true)}>
          <PhoneCall className="h-3.5 w-3.5" />
          Log Call
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => router.push(`/emails?compose=true&leadId=${leadId}&to=${lead.contactEmail || ""}`)}
        >
          <Send className="h-3.5 w-3.5" />
          Send Email
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTaskDialogOpen(true)}>
          <ClipboardList className="h-3.5 w-3.5" />
          Create Task
        </Button>
        {!isConverted && (
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setConvertOpen(true)}
          >
            <ArrowRightCircle className="h-3.5 w-3.5" />
            Convert to Deal
          </Button>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel (60%) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Lead info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InlineField
                label="Company Name"
                value={lead.companyName}
                icon={<Building2 className="h-4 w-4" />}
                onSave={(val) => updateField("companyName", val)}
              />
              <InlineField
                label="Contact Name"
                value={lead.contactName}
                icon={<User className="h-4 w-4" />}
                onSave={(val) => updateField("contactName", val)}
              />
              <InlineField
                label="Email"
                value={lead.contactEmail || ""}
                icon={<Mail className="h-4 w-4" />}
                onSave={(val) => updateField("contactEmail", val || null)}
              />
              <InlineField
                label="Phone"
                value={lead.contactPhone || ""}
                icon={<Phone className="h-4 w-4" />}
                onSave={(val) => updateField("contactPhone", val || null)}
              />
              <InlineField
                label="Address"
                value={lead.address || ""}
                icon={<MapPin className="h-4 w-4" />}
                onSave={(val) => updateField("address", val || null)}
              />

              {/* Industry dropdown */}
              <div className="flex items-start gap-3 py-2">
                <div className="mt-0.5 text-muted-foreground">
                  <Factory className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Industry
                  </p>
                  <Select
                    value={lead.industry || ""}
                    onValueChange={(val) => updateField("industry", val || null)}
                  >
                    <SelectTrigger className="h-8 w-[220px] text-sm">
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
              </div>

              {/* Source dropdown */}
              <div className="flex items-start gap-3 py-2">
                <div className="mt-0.5 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    Lead Source
                  </p>
                  <Select
                    value={lead.leadSource || ""}
                    onValueChange={(val) => updateField("leadSource", val || null)}
                  >
                    <SelectTrigger className="h-8 w-[220px] text-sm">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Engagement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status & Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Lead Status
                  </Label>
                  <Select
                    value={lead.leadStatus}
                    onValueChange={(val) => updateField("leadStatus", val)}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Engagement Stage
                  </Label>
                  <Select
                    value={lead.engagementStage}
                    onValueChange={(val) => updateField("engagementStage", val)}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGAGEMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-3">
                {lead.tags.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No tags</p>
                )}
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-8 max-w-[200px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTag();
                  }}
                />
                <Button size="sm" variant="outline" className="h-8" onClick={handleAddTag}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notes
                </CardTitle>
                {!editingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setEditingNotes(true)}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={5}
                    className="text-sm"
                    placeholder="Add notes about this lead..."
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-8 gap-1.5" onClick={handleSaveNotes}>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        setNotesDraft(lead.notes || "");
                        setEditingNotes(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {lead.notes || "No notes yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cadence card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cadence Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${cadenceBadgeClass(lead.cadenceStatus)}`}
                >
                  {labelForEnum(CADENCE_STATUS_OPTIONS, lead.cadenceStatus)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Step {lead.cadenceStep}
                </span>
              </div>
              {lead.lastCadenceEmailAt && (
                <p className="text-xs text-muted-foreground">
                  Last cadence email: {formatDateTime(lead.lastCadenceEmailAt)}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                {lead.cadenceStatus === "ActiveInCadence" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleCadenceToggle}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                ) : lead.cadenceStatus.startsWith("Paused") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleCadenceToggle}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                ) : lead.cadenceStatus === "NotStarted" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleCadenceToggle}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start Cadence
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium">{lead.assignee?.name || "Unassigned"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(lead.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{formatDateTime(lead.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Activity Timeline</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchLead}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No activities yet.
                </p>
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  {lead.activities.map((activity) => (
                    <div key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {/* Icon dot */}
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border">
                        {activityIcon(activity.activityType)}
                      </div>

                      {/* Content */}
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
                          <p className="text-sm text-foreground mt-0.5">{activity.subject}</p>
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

          {/* Tasks */}
          {lead.tasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lead.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between py-1.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            task.status === "completed"
                              ? "bg-emerald-500"
                              : task.status === "in_progress"
                              ? "bg-amber-500"
                              : "bg-gray-400"
                          }`}
                        />
                        <span className="text-sm truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                        {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            task.priority === "urgent"
                              ? "border-red-200 text-red-700"
                              : task.priority === "high"
                              ? "border-orange-200 text-orange-700"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Convert dialog */}
      <ConvertLeadDialog
        lead={lead}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onSuccess={() => {
          setConvertOpen(false);
          fetchLead();
        }}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        leadId={leadId}
        onSuccess={fetchLead}
      />

      {/* Log Call Dialog */}
      <LeadCallDialog
        open={callDialogOpen}
        onOpenChange={setCallDialogOpen}
        leadId={leadId}
        onSuccess={fetchLead}
      />
    </div>
  );
}

function LeadCallDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
      setDuration("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!subject.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "call",
          subject,
          body,
          leadId,
          metadata: duration ? { duration: parseInt(duration) } : {},
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Call logged", description: "Call activity recorded." });
      onOpenChange(false);
      onSuccess();
    } catch {
      toast({ title: "Error", description: "Failed to log call.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Log Call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="call-subject">Subject</Label>
            <Input
              id="call-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Call with..."
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="call-notes">Notes</Label>
            <Textarea
              id="call-notes"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Call notes..."
              className="mt-1"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="call-duration">Duration (minutes)</Label>
            <Input
              id="call-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 15"
              className="mt-1 w-32"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={submitting || !subject.trim()} onClick={handleSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log Call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
