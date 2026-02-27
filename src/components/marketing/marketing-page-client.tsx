"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Mail,
  BarChart3,
  Play,
  Pause,
  Square,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Clock,
  Send,
  Eye,
  MousePointerClick,
  MessageSquare,
  CalendarCheck,
  Zap,
  Megaphone,
  FileText,
  MailOpen,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  cadenceStatus: string;
  cadenceStep: number;
  lastCadenceEmailAt: string | null;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  templateType: string;
  sequenceNumber: number | null;
  subject: string;
  bodyHtml: string;
  fromAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bookingCount: number;
  scheduledFor: string | null;
  createdAt: string;
}

interface TemplateFormData {
  name: string;
  templateType: string;
  sequenceNumber: number | null;
  subject: string;
  bodyHtml: string;
  fromAddress: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_TYPE_OPTIONS = [
  { value: "sales_cadence", label: "Sales Cadence" },
  { value: "nurture_loop", label: "Nurture Loop" },
  { value: "quote_follow_up", label: "Quote Follow-Up" },
  { value: "review_request", label: "Review Request" },
  { value: "referral_nudge", label: "Referral Nudge" },
  { value: "seasonal_campaign", label: "Seasonal Campaign" },
  { value: "client_welcome", label: "Client Welcome" },
  { value: "onboarding_check_in", label: "Onboarding Check-In" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "ad_hoc", label: "Ad Hoc" },
];

const MERGE_FIELDS = [
  "{{contact_name}}",
  "{{company_name}}",
  "{{calendly_link}}",
  "{{quote_ref}}",
  "{{monthly_total}}",
];

const CADENCE_STATUS_MAP: Record<string, string> = {
  NotStarted: "Not Started",
  ActiveInCadence: "Active in Cadence",
  PausedMeeting: "Paused - Meeting Scheduled",
  PausedReplied: "Paused - Replied",
  StoppedActiveClient: "Stopped - Active Client",
  StoppedUnsubscribed: "Stopped - Unsubscribed",
  CompletedNoResponse: "Completed - No Response",
  LongTermNurture: "Long Term Nurture",
};

const SEQUENCE_TYPES = ["sales_cadence", "nurture_loop"];

const DEFAULT_FORM: TemplateFormData = {
  name: "",
  templateType: "sales_cadence",
  sequenceNumber: null,
  subject: "",
  bodyHtml: "",
  fromAddress: "nick@signature-cleans.co.uk",
  isActive: true,
};

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function cadenceStatusBadgeClass(status: string): string {
  switch (status) {
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

function campaignStatusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "scheduled":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "sending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "completed":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "cancelled":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function templateTypeBadgeClass(type: string): string {
  switch (type) {
    case "sales_cadence":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "nurture_loop":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "quote_follow_up":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "review_request":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "referral_nudge":
      return "bg-pink-100 text-pink-800 border-pink-200";
    case "seasonal_campaign":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "client_welcome":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "onboarding_check_in":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "contract_renewal":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "ad_hoc":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function templateTypeLabel(value: string): string {
  return (
    TEMPLATE_TYPE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
  accentIcon: string;
}

function StatCard({ title, value, subtitle, icon: Icon, accentBg, accentIcon }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentBg}`}
        >
          <Icon className={`h-4 w-4 ${accentIcon}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cadences Tab
// ---------------------------------------------------------------------------

function CadencesTab() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [runningCadence, setRunningCadence] = useState(false);

  // Stat counts
  const [activeCount, setActiveCount] = useState(0);
  const [pausedCount, setPausedCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [nurtureCount, setNurtureCount] = useState(0);

  const fetchCadenceStats = useCallback(async () => {
    try {
      const statuses = [
        { key: "ActiveInCadence", setter: setActiveCount },
        { key: "PausedMeeting", setter: setPausedCount },
        { key: "CompletedNoResponse", setter: setCompletedCount },
        { key: "LongTermNurture", setter: setNurtureCount },
      ];

      const responses = await Promise.all(
        statuses.map((s) =>
          fetch(`/api/leads?cadenceStatus=${s.key}&limit=1`).then((r) =>
            r.ok ? r.json() : { pagination: { total: 0 } }
          )
        )
      );

      statuses.forEach((s, i) => {
        s.setter(responses[i].pagination?.total ?? 0);
      });

      // Also fetch PausedReplied and add to paused count
      const pausedRepliedRes = await fetch(
        `/api/leads?cadenceStatus=PausedReplied&limit=1`
      );
      if (pausedRepliedRes.ok) {
        const pausedRepliedData = await pausedRepliedRes.json();
        setPausedCount(
          (prev) => prev + (pausedRepliedData.pagination?.total ?? 0)
        );
      }
    } catch {
      // Stats are non-critical, silently handle
    }
  }, []);

  const fetchCadenceLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leads?cadenceStatus=ActiveInCadence&limit=50&sortBy=lastCadenceEmailAt&sortOrder=desc`
      );
      if (!res.ok) throw new Error("Failed to fetch cadence leads");
      const json = await res.json();
      setLeads(json.data ?? []);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load cadence leads.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCadenceStats();
    fetchCadenceLeads();
  }, [fetchCadenceStats, fetchCadenceLeads]);

  async function updateCadenceStatus(leadId: string, newStatus: string) {
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadenceStatus: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update lead");
      toast({
        title: "Updated",
        description: `Cadence status changed to ${CADENCE_STATUS_MAP[newStatus] ?? newStatus}.`,
      });
      fetchCadenceLeads();
      fetchCadenceStats();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update cadence status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function runCadenceNow() {
    setRunningCadence(true);
    try {
      const res = await fetch("/api/cron/cadence", { method: "POST" });
      if (!res.ok) throw new Error("Cadence run failed");
      const data = await res.json();
      toast({
        title: "Cadence Run Complete",
        description: `Processed: ${data.processed ?? 0}, Sent: ${data.sent ?? 0}, Skipped: ${data.skipped ?? 0}`,
      });
      fetchCadenceLeads();
      fetchCadenceStats();
    } catch {
      toast({
        title: "Error",
        description: "Failed to run cadence engine.",
        variant: "destructive",
      });
    } finally {
      setRunningCadence(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active in Cadence"
          value={activeCount}
          subtitle="Currently receiving emails"
          icon={Zap}
          accentBg="bg-emerald-50 dark:bg-emerald-950/30"
          accentIcon="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Paused"
          value={pausedCount}
          subtitle="Meeting scheduled or replied"
          icon={Pause}
          accentBg="bg-amber-50 dark:bg-amber-950/30"
          accentIcon="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Completed"
          value={completedCount}
          subtitle="Finished cadence (no response)"
          icon={Square}
          accentBg="bg-slate-50 dark:bg-slate-950/30"
          accentIcon="text-slate-600 dark:text-slate-400"
        />
        <StatCard
          title="Long Term Nurture"
          value={nurtureCount}
          subtitle="Moved to nurture loop"
          icon={RefreshCw}
          accentBg="bg-sky-50 dark:bg-sky-950/30"
          accentIcon="text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Next scheduled run: Daily at 09:00 AM</span>
          </div>
        </div>
        {userRole === "admin" && (
          <Button
            onClick={runCadenceNow}
            disabled={runningCadence}
            className="gap-2"
          >
            {runningCadence ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Cadence Now
          </Button>
        )}
      </div>

      {/* Cadence leads table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Company
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Contact
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Current Step
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Last Email Sent
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Status
              </TableHead>
              <TableHead className="text-right text-xs font-medium uppercase tracking-wide">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading cadence leads...
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-40 text-center text-muted-foreground"
                >
                  No leads currently in active cadence.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const progress = Math.round((lead.cadenceStep / 20) * 100);
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.companyName}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{lead.contactName}</span>
                        {lead.contactEmail && (
                          <p className="text-xs text-muted-foreground">
                            {lead.contactEmail}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <span className="text-sm font-medium whitespace-nowrap">
                          {lead.cadenceStep}/20
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {lead.lastCadenceEmailAt
                        ? formatDistanceToNow(
                            new Date(lead.lastCadenceEmailAt),
                            { addSuffix: true }
                          )
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium whitespace-nowrap ${cadenceStatusBadgeClass(lead.cadenceStatus)}`}
                      >
                        {CADENCE_STATUS_MAP[lead.cadenceStatus] ??
                          lead.cadenceStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={actionLoading === lead.id}
                          onClick={() =>
                            updateCadenceStatus(lead.id, "PausedReplied")
                          }
                          title="Pause"
                        >
                          <Pause className="h-3.5 w-3.5 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={actionLoading === lead.id}
                          onClick={() =>
                            updateCadenceStatus(lead.id, "ActiveInCadence")
                          }
                          title="Resume"
                        >
                          <Play className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={actionLoading === lead.id}
                          onClick={() =>
                            updateCadenceStatus(
                              lead.id,
                              "StoppedUnsubscribed"
                            )
                          }
                          title="Stop"
                        >
                          <Square className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------

function CampaignsTab() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const json = await res.json();
      setCampaigns(json.data ?? []);
    } catch {
      // API may not exist yet; show empty state
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  function handleNewCampaign() {
    toast({
      title: "Coming Soon",
      description: "Campaign creation will be available in the next update.",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campaigns</h3>
          <p className="text-sm text-muted-foreground">
            Manage email campaigns and track performance.
          </p>
        </div>
        <Button onClick={handleNewCampaign} className="gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Campaigns table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Name
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Status
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Recipients
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Sent
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Opens
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Clicks
              </TableHead>
              <TableHead className="hidden xl:table-cell text-xs font-medium uppercase tracking-wide">
                Replies
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Scheduled
              </TableHead>
              <TableHead className="text-right text-xs font-medium uppercase tracking-wide">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading campaigns...
                  </div>
                </TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                    <p>No campaigns yet.</p>
                    <p className="text-xs">
                      Create your first campaign to start reaching prospects at
                      scale.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">
                    {campaign.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium capitalize whitespace-nowrap ${campaignStatusBadgeClass(campaign.status)}`}
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {campaign.totalRecipients.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {campaign.sentCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {campaign.openCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {campaign.clickCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">
                    {campaign.replyCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {campaign.scheduledFor
                      ? format(new Date(campaign.scheduledFor), "dd MMM yyyy HH:mm")
                      : "--"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Templates Tab
// ---------------------------------------------------------------------------

function TemplatesTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [formData, setFormData] = useState<TemplateFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      setTemplates(json.data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData(DEFAULT_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(template: EmailTemplate) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      templateType: template.templateType,
      sequenceNumber: template.sequenceNumber,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      fromAddress: template.fromAddress,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.subject.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and subject are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        sequenceNumber: SEQUENCE_TYPES.includes(formData.templateType)
          ? formData.sequenceNumber
          : null,
      };

      const url = editingTemplate
        ? `/api/email-templates/${editingTemplate.id}`
        : "/api/email-templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save template");

      toast({
        title: editingTemplate ? "Template Updated" : "Template Created",
        description: `"${formData.name}" has been saved successfully.`,
      });

      setDialogOpen(false);
      fetchTemplates();
    } catch {
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: EmailTemplate) {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      const res = await fetch(`/api/email-templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      toast({
        title: "Deleted",
        description: `Template "${template.name}" has been deleted.`,
      });
      fetchTemplates();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete template.",
        variant: "destructive",
      });
    }
  }

  async function handleToggleActive(template: EmailTemplate) {
    try {
      const res = await fetch(`/api/email-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !template.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update template");
      fetchTemplates();
    } catch {
      toast({
        title: "Error",
        description: "Failed to toggle template status.",
        variant: "destructive",
      });
    }
  }

  function insertMergeField(field: string) {
    setFormData((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + field,
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage templates for cadences and campaigns.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Templates table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Name
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Type
              </TableHead>
              <TableHead className="hidden md:table-cell text-xs font-medium uppercase tracking-wide">
                Subject
              </TableHead>
              <TableHead className="hidden lg:table-cell text-xs font-medium uppercase tracking-wide">
                Seq #
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide">
                Active
              </TableHead>
              <TableHead className="text-right text-xs font-medium uppercase tracking-wide">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading templates...
                  </div>
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-40 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <p>No templates yet.</p>
                    <p className="text-xs">
                      Create your first email template to power your cadences
                      and campaigns.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {template.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium whitespace-nowrap ${templateTypeBadgeClass(template.templateType)}`}
                    >
                      {templateTypeLabel(template.templateType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                    {template.subject}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {template.sequenceNumber ?? "--"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => handleToggleActive(template)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(template)}
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDelete(template)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the email template details below."
                : "Create a new email template for your cadences or campaigns."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-5 py-1">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g. Sales Cadence Step 1"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              {/* Type + Sequence */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-type">Template Type</Label>
                  <Select
                    value={formData.templateType}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, templateType: val }))
                    }
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {SEQUENCE_TYPES.includes(formData.templateType) && (
                  <div className="space-y-2">
                    <Label htmlFor="sequence-number">Sequence Number</Label>
                    <Input
                      id="sequence-number"
                      type="number"
                      min={1}
                      max={20}
                      placeholder="e.g. 1"
                      value={formData.sequenceNumber ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sequenceNumber: e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  placeholder="e.g. Quick question about {{company_name}}"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Body HTML */}
              <div className="space-y-2">
                <Label htmlFor="template-body">Body (HTML)</Label>
                <Textarea
                  id="template-body"
                  placeholder="Enter email body HTML..."
                  className="min-h-[200px] font-mono text-sm"
                  value={formData.bodyHtml}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bodyHtml: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Merge fields */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Available Merge Fields (click to insert)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {MERGE_FIELDS.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => insertMergeField(field)}
                      className="inline-flex items-center rounded-full border bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* From Address */}
              <div className="space-y-2">
                <Label htmlFor="from-address">From Address</Label>
                <Input
                  id="from-address"
                  placeholder="nick@signature-cleans.co.uk"
                  value={formData.fromAddress}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fromAddress: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="template-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <Label htmlFor="template-active" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics Tab
// ---------------------------------------------------------------------------

function AnalyticsTab() {
  return (
    <div className="space-y-6">
      {/* Performance overview cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Emails Sent"
          value={0}
          subtitle="This month"
          icon={Send}
          accentBg="bg-blue-50 dark:bg-blue-950/30"
          accentIcon="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Open Rate"
          value="0%"
          subtitle="Across all cadences"
          icon={Eye}
          accentBg="bg-emerald-50 dark:bg-emerald-950/30"
          accentIcon="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Reply Rate"
          value="0%"
          subtitle="Across all cadences"
          icon={MessageSquare}
          accentBg="bg-purple-50 dark:bg-purple-950/30"
          accentIcon="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Meetings Booked"
          value={0}
          subtitle="From cadence outreach"
          icon={CalendarCheck}
          accentBg="bg-amber-50 dark:bg-amber-950/30"
          accentIcon="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Chart placeholders */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cadence Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Cadence Performance</CardTitle>
            </div>
            <CardDescription>
              Open rates, reply rates, and conversions over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <MailOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                No cadence data yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground text-center max-w-[280px]">
                Cadence analytics will appear here once emails are sent. Start a
                cadence to begin tracking performance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Campaign Performance</CardTitle>
            </div>
            <CardDescription>
              Sent, opened, clicked, and replied metrics per campaign.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Megaphone className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                No campaign data yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground text-center max-w-[280px]">
                Campaign analytics will appear here once you send your first
                campaign. Create a campaign to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function MarketingPageClient() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Manage cadences, campaigns, email templates, and track performance.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cadences" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="cadences" className="gap-1.5">
            <Zap className="h-3.5 w-3.5 hidden sm:block" />
            Cadences
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5 hidden sm:block" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5 hidden sm:block" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadences">
          <CadencesTab />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
