"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ClipboardCheck,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PoundSterling,
  Send,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  XCircle,
  PhoneCall,
  StickyNote,
  ArrowRightCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractDetail {
  id: string;
  contractName: string;
  cellType: string;
  unitId: string | null;
  status: string;
  // Schedule
  weeklyHours: number;
  visitsPerWeek: number;
  hoursPerVisit: number;
  daysSelected: string[];
  siteType: string;
  // Financials
  sellRatePerHour: number;
  labourRatePerHour: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  annualValue: number;
  weeklyLabourCost: number;
  monthlyLabourCost: number;
  consumablesPercent: number;
  grossMarginPercent: number;
  // Supervision
  supervisorHoursAlloc: number | null;
  supervisorRate: number;
  // Dates
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  noticePeriodDays: number;
  // Pilot
  isPilot: boolean;
  pilotEndDate: string | null;
  pilotMonthlyRate: number | null;
  standardMonthlyRate: number | null;
  // Team
  teamLead: string | null;
  subcontractorId: string | null;
  subcontractor: { id: string; companyName: string | null; contactName: string } | null;
  // Quality
  latestAuditScore: number;
  previousAuditScore: number;
  auditFrequency: string | null;
  nextAuditDate: string | null;
  // Health
  healthStatus: string;
  daysSinceLastContact: number;
  complaintCount: number;
  staffingStatus: string;
  // Onboarding
  onboardingComplete: boolean;
  onboardingStage: string;
  // Exit
  exitReason: string | null;
  exitNotes: string | null;
  notes: string | null;
  // Linked
  dealId: string | null;
  accountId: string | null;
  quoteId: string | null;
  deal: { id: string; name: string; stage: string } | null;
  account: { id: string; name: string } | null;
  quote: { id: string; quoteRef: string } | null;
  // Related
  audits: AuditRecord[];
  activities: ActivityRecord[];
  documents: DocumentRecord[];
  issues: IssueRecord[];
  tasks: TaskRecord[];
  createdAt: string;
  updatedAt: string;
}

interface AuditRecord {
  id: string;
  auditDate: string;
  overallScore: number;
  auditor: { id: string; name: string } | null;
  requiresFollowUp: boolean;
  followUpCompleted: boolean;
}

interface ActivityRecord {
  id: string;
  activityType: string;
  subject: string | null;
  body: string | null;
  performer: { id: string; name: string } | null;
  createdAt: string;
}

interface DocumentRecord {
  id: string;
  documentType: string;
  name: string;
  fileUrl: string | null;
  createdAt: string;
}

interface IssueRecord {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string | null;
  reportedAt: string;
  resolvedAt: string | null;
}

interface TaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  sourceWorkflow: string | null;
}

// ---------------------------------------------------------------------------
// Enum/Display helpers
// ---------------------------------------------------------------------------

const CONTRACT_STATUS_OPTIONS = [
  { value: "mobilising", label: "Mobilising" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "notice_given", label: "Notice Given" },
  { value: "terminated", label: "Terminated" },
  { value: "archived", label: "Archived" },
];

const SITE_TYPE_OPTIONS = [
  { value: "OfficeCommercial", label: "Office/Commercial" },
  { value: "WelfareConstruction", label: "Welfare/Construction" },
  { value: "HospitalityVenue", label: "Hospitality/Venue" },
  { value: "EducationInstitutional", label: "Education/Institutional" },
  { value: "SpecialistIndustrial", label: "Specialist/Industrial" },
  { value: "DentalMedical", label: "Dental/Medical" },
];

const EXIT_REASON_OPTIONS = [
  { value: "client_terminated", label: "Client Terminated" },
  { value: "mutual_agreement", label: "Mutual Agreement" },
  { value: "performance_issues", label: "Performance Issues" },
  { value: "cost_reduction", label: "Cost Reduction" },
  { value: "contract_expired", label: "Contract Expired" },
  { value: "other", label: "Other" },
];

function statusLabel(value: string): string {
  return (
    CONTRACT_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function siteTypeLabel(value: string): string {
  return SITE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

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
  switch (health) {
    case "GREEN":
      return "Green";
    case "AMBER":
      return "Amber";
    case "RED":
      return "Red";
    default:
      return health;
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function issueStatusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800 border-red-200";
    case "in_progress":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "resolved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "closed":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function auditScoreBg(score: number): string {
  if (score >= 85) return "bg-green-100 text-green-800";
  if (score >= 70) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function marginTrafficLight(gm: number): string {
  if (gm >= 35) return "bg-green-500";
  if (gm >= 25) return "bg-yellow-500";
  return "bg-red-500";
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

function formatDateTime(iso: string): string {
  try {
    return format(new Date(iso), "dd MMM yyyy HH:mm");
  } catch {
    return "--";
  }
}

function activityTypeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function activityIcon(type: string) {
  switch (type) {
    case "call":
      return <PhoneCall className="h-4 w-4 text-blue-500" />;
    case "email_sent":
    case "cadence_email_sent":
      return <Send className="h-4 w-4 text-emerald-500" />;
    case "meeting":
    case "site_visit":
      return <Calendar className="h-4 w-4 text-amber-500" />;
    case "note":
      return <StickyNote className="h-4 w-4 text-slate-500" />;
    case "audit_completed":
      return <ClipboardCheck className="h-4 w-4 text-indigo-500" />;
    case "contract_created":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "deal_stage_change":
      return <ArrowRightCircle className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function documentTypeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Onboarding milestones
// ---------------------------------------------------------------------------

const ONBOARDING_MILESTONES = [
  { key: "mobilising", label: "Mobilising", workflow: "contract_onboarding_mobilising" },
  { key: "week_1_call", label: "Week 1 Call", workflow: "contract_onboarding_week1" },
  { key: "week_2_meeting", label: "Week 2 Meeting", workflow: "contract_onboarding_week2" },
  { key: "week_4_audit", label: "Week 4 Audit", workflow: "contract_onboarding_week4" },
  { key: "week_8_call", label: "Week 8 Call", workflow: "contract_onboarding_week8" },
  { key: "week_12_review", label: "Week 12 Review", workflow: "contract_onboarding_week12" },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const contractId = params.id as string;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [exitNotes, setExitNotes] = useState("");
  const [terminating, setTerminating] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/contracts");
          return;
        }
        throw new Error("Failed to fetch contract");
      }
      const json = await res.json();
      setContract(json.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contract.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [contractId, router, toast]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  async function handleTerminate() {
    if (!exitReason) {
      toast({ title: "Error", description: "Please select an exit reason.", variant: "destructive" });
      return;
    }
    setTerminating(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "terminated",
          exitReason,
          exitNotes: exitNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to terminate");
      toast({ title: "Contract Terminated", description: "The contract has been terminated." });
      setTerminateOpen(false);
      fetchContract();
    } catch {
      toast({ title: "Error", description: "Failed to terminate contract.", variant: "destructive" });
    } finally {
      setTerminating(false);
    }
  }

  // Determine onboarding milestone status from tasks
  function getMilestoneStatus(milestoneWorkflow: string): "completed" | "pending" {
    if (!contract) return "pending";
    const task = contract.tasks.find(
      (t) => t.sourceWorkflow === milestoneWorkflow
    );
    if (task && (task.status === "completed" || task.completedAt)) return "completed";
    return "pending";
  }

  // Audit trend
  function auditTrend(): "improving" | "declining" | "stable" | null {
    if (!contract || contract.audits.length < 2) return null;
    const sorted = [...contract.audits].sort(
      (a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime()
    );
    const latest = Number(sorted[0].overallScore);
    const previous = Number(sorted[1].overallScore);
    if (latest > previous) return "improving";
    if (latest < previous) return "declining";
    return "stable";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Contract not found.
      </div>
    );
  }

  const trend = auditTrend();
  const gm = Number(contract.grossMarginPercent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/contracts")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                {contract.contractName}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-medium ${cellTypeBadgeClass(contract.cellType)}`}
              >
                Cell {contract.cellType}
              </Badge>
              {contract.unitId && (
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  {contract.unitId}
                </code>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusBadgeClass(contract.status)}`}
              >
                {statusLabel(contract.status)}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-3 w-3 rounded-full ${healthDotClass(contract.healthStatus)}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {healthLabel(contract.healthStatus)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Health Status: {healthLabel(contract.healthStatus)}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MoreHorizontal className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Contract
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Schedule Audit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquare className="h-4 w-4 mr-2" />
                Log Activity
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Create Task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-700"
                onClick={() => setTerminateOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Terminate Contract
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content area */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        {/* ====== OVERVIEW TAB ====== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overview Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Contract Name
                    </p>
                    <p className="font-medium">{contract.contractName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Cell Type
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${cellTypeBadgeClass(contract.cellType)}`}
                    >
                      Cell {contract.cellType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Unit ID
                    </p>
                    <p>
                      {contract.unitId ? (
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {contract.unitId}
                        </code>
                      ) : (
                        "--"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Status
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${statusBadgeClass(contract.status)}`}
                    >
                      {statusLabel(contract.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Start Date
                    </p>
                    <p>{formatDate(contract.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      End Date
                    </p>
                    <p>{formatDate(contract.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Renewal Date
                    </p>
                    <p>{formatDate(contract.renewalDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Notice Period
                    </p>
                    <p>{contract.noticePeriodDays} days</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Site Type
                    </p>
                    <p>{siteTypeLabel(contract.siteType)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Days
                    </p>
                    <p>{contract.daysSelected.join(", ") || "--"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Visits / Week
                    </p>
                    <p>{contract.visitsPerWeek}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Weekly Hours
                    </p>
                    <p>{Number(contract.weeklyHours).toFixed(1)}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team & Links Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team & Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Team Lead
                    </p>
                    <p className="font-medium">{contract.teamLead || "--"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Subcontractor
                    </p>
                    {contract.subcontractor ? (
                      <Link
                        href={`/subcontractors/${contract.subcontractor.id}`}
                        className="text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                      >
                        {contract.subcontractor.companyName || contract.subcontractor.contactName}
                      </Link>
                    ) : (
                      <p className="text-muted-foreground">--</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                    Linked Records
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contract.deal && (
                      <Link href={`/pipeline?deal=${contract.deal.id}`}>
                        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                          <ExternalLink className="h-3 w-3" />
                          Deal: {contract.deal.name}
                        </Badge>
                      </Link>
                    )}
                    {contract.account && (
                      <Link href={`/accounts/${contract.account.id}`}>
                        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                          <ExternalLink className="h-3 w-3" />
                          Account: {contract.account.name}
                        </Badge>
                      </Link>
                    )}
                    {contract.quote && (
                      <Link href={`/quotes/${contract.quote.id}`}>
                        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                          <ExternalLink className="h-3 w-3" />
                          Quote: {contract.quote.quoteRef}
                        </Badge>
                      </Link>
                    )}
                    {!contract.deal && !contract.account && !contract.quote && (
                      <p className="text-sm text-muted-foreground italic">No linked records</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Health info */}
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                    Health Indicators
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${healthDotClass(contract.healthStatus)}`} />
                      <span>{healthLabel(contract.healthStatus)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Days since contact:</span>{" "}
                      <span className="font-medium">{contract.daysSinceLastContact}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Complaints:</span>{" "}
                      <span className="font-medium">{contract.complaintCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Staffing:</span>{" "}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ml-1 ${
                          contract.staffingStatus === "Stable"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : contract.staffingStatus === "Risk"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {contract.staffingStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Onboarding Tracker */}
          {!contract.onboardingComplete && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Onboarding Tracker
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline bar */}
                  <div className="flex items-center justify-between">
                    {ONBOARDING_MILESTONES.map((milestone, idx) => {
                      const status = getMilestoneStatus(milestone.workflow);
                      const isCompleted = status === "completed";
                      return (
                        <div key={milestone.key} className="flex flex-col items-center flex-1">
                          {/* Connector line */}
                          {idx > 0 && (
                            <div className="absolute top-4 h-0.5 bg-border" style={{
                              left: `${((idx - 1) / (ONBOARDING_MILESTONES.length - 1)) * 100 + (50 / ONBOARDING_MILESTONES.length)}%`,
                              width: `${100 / ONBOARDING_MILESTONES.length}%`,
                            }} />
                          )}
                          <div
                            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                              isCompleted
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <p
                            className={`text-[10px] mt-1.5 text-center font-medium ${
                              isCompleted ? "text-emerald-700" : "text-muted-foreground"
                            }`}
                          >
                            {milestone.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Background connector line */}
                  <div className="absolute top-4 left-[8%] right-[8%] h-0.5 bg-border -z-0" />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== FINANCIALS TAB ====== */}
        <TabsContent value="financials" className="space-y-6">
          {/* Top highlight boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Monthly Revenue
                  </p>
                  <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(Number(contract.monthlyRevenue))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Annual Value
                  </p>
                  <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(Number(contract.annualValue))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Sell Rate / hr
                  </p>
                  <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(Number(contract.sellRatePerHour))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Gross Margin %
                  </p>
                  <div className={`h-3 w-3 rounded-full ${marginTrafficLight(gm)}`} />
                </div>
                <p className="text-2xl font-bold">{gm.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {gm >= 35 ? "Healthy" : gm >= 25 ? "Review needed" : "Below target"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Financial details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Weekly Revenue
                  </p>
                  <p className="font-medium">{formatCurrency(Number(contract.weeklyRevenue))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Weekly Labour Cost
                  </p>
                  <p className="font-medium">{formatCurrency(Number(contract.weeklyLabourCost))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Labour Rate / hr
                  </p>
                  <p className="font-medium">{formatCurrency(Number(contract.labourRatePerHour))}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Consumables %
                  </p>
                  <p className="font-medium">{Number(contract.consumablesPercent).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Supervisor Hours Alloc
                  </p>
                  <p className="font-medium">
                    {contract.supervisorHoursAlloc
                      ? `${Number(contract.supervisorHoursAlloc).toFixed(2)}h`
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Supervisor Rate
                  </p>
                  <p className="font-medium">{formatCurrency(Number(contract.supervisorRate))}</p>
                </div>
              </div>

              {/* Pilot pricing section */}
              {contract.isPilot && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                        PILOT
                      </Badge>
                      Pilot Pricing
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-8 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          Pilot End Date
                        </p>
                        <p className="font-medium">{formatDate(contract.pilotEndDate)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          Pilot Monthly Rate
                        </p>
                        <p className="font-medium">
                          {contract.pilotMonthlyRate
                            ? formatCurrency(Number(contract.pilotMonthlyRate))
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                          Standard Monthly Rate
                        </p>
                        <p className="font-medium">
                          {contract.standardMonthlyRate
                            ? formatCurrency(Number(contract.standardMonthlyRate))
                            : "--"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== AUDITS TAB ====== */}
        <TabsContent value="audits" className="space-y-6">
          {/* Audit trend */}
          {trend && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                trend === "improving"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : trend === "declining"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              {trend === "improving" ? (
                <TrendingUp className="h-4 w-4" />
              ) : trend === "declining" ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              Audit scores are{" "}
              <span className="font-medium">
                {trend === "improving"
                  ? "improving"
                  : trend === "declining"
                    ? "declining"
                    : "stable"}
              </span>
              {" "}
              (Latest: {Number(contract.latestAuditScore).toFixed(1)}%, Previous: {Number(contract.previousAuditScore).toFixed(1)}%)
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Audit History</CardTitle>
                {contract.nextAuditDate && (
                  <p className="text-xs text-muted-foreground">
                    Next audit: {formatDate(contract.nextAuditDate)}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contract.audits.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No audits recorded yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Score</TableHead>
                      <TableHead className="text-xs">Auditor</TableHead>
                      <TableHead className="text-xs">Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...contract.audits]
                      .sort(
                        (a, b) =>
                          new Date(b.auditDate).getTime() -
                          new Date(a.auditDate).getTime()
                      )
                      .map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell className="text-sm">
                            {formatDate(audit.auditDate)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${auditScoreBg(Number(audit.overallScore))}`}
                            >
                              {Number(audit.overallScore).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {audit.auditor?.name || "--"}
                          </TableCell>
                          <TableCell>
                            {audit.requiresFollowUp ? (
                              audit.followUpCompleted ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                                >
                                  Completed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Needed
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== ACTIVITY TAB ====== */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No activities yet.
                </p>
              ) : (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  {[...contract.activities]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                    .map((activity) => (
                      <div
                        key={activity.id}
                        className="relative flex gap-3 pb-4 last:pb-0"
                      >
                        <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border">
                          {activityIcon(activity.activityType)}
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
        </TabsContent>

        {/* ====== DOCUMENTS TAB ====== */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {contract.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No documents linked to this contract.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Created</TableHead>
                      <TableHead className="text-xs w-20">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contract.documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {doc.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {documentTypeLabel(doc.documentType)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </TableCell>
                        <TableCell>
                          {doc.fileUrl ? (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex"
                            >
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== ISSUES TAB ====== */}
        <TabsContent value="issues" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Issues</CardTitle>
                {contract.issues.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Open:{" "}
                      <span className="font-medium text-foreground">
                        {contract.issues.filter((i) => i.status === "open" || i.status === "in_progress").length}
                      </span>
                    </span>
                    <span>
                      Closed:{" "}
                      <span className="font-medium text-foreground">
                        {contract.issues.filter((i) => i.status === "resolved" || i.status === "closed").length}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contract.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No issues reported for this contract.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs">Severity</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Reported</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...contract.issues]
                      .sort(
                        (a, b) =>
                          new Date(b.reportedAt).getTime() -
                          new Date(a.reportedAt).getTime()
                      )
                      .map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <AlertTriangle
                                className={`h-3.5 w-3.5 ${
                                  issue.severity === "critical"
                                    ? "text-red-500"
                                    : issue.severity === "high"
                                      ? "text-orange-500"
                                      : "text-gray-400"
                                }`}
                              />
                              {issue.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${severityBadgeClass(issue.severity)}`}
                            >
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium ${issueStatusBadgeClass(issue.status)}`}
                            >
                              {issue.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {issue.category
                              ? issue.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                              : "--"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDate(issue.reportedAt)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {issue.resolvedAt ? formatDate(issue.resolvedAt) : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Terminate Contract Dialog */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Contract</DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate &quot;{contract.contractName}&quot;?
              This action will update the contract status to terminated. Please provide
              an exit reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">
                Exit Reason <span className="text-red-500">*</span>
              </Label>
              <Select value={exitReason} onValueChange={setExitReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Exit Notes</Label>
              <Textarea
                value={exitNotes}
                onChange={(e) => setExitNotes(e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Additional details about the termination..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTerminateOpen(false)}
              disabled={terminating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTerminate}
              disabled={terminating}
              className="gap-1.5"
            >
              {terminating && <Loader2 className="h-4 w-4 animate-spin" />}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
