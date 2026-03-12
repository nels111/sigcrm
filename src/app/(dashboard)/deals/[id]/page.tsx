"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Banknote,
  FileText,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ListChecks,
  Lightbulb,
  ChevronRight,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateTaskDialog } from "@/components/shared/create-task-dialog";
import { useToast } from "@/hooks/use-toast";

// ───── Types ─────
interface DealDetail {
  id: string;
  name: string;
  stage: string;
  probability: number;
  amount: string | null;
  monthlyValue: string | null;
  weeklyValue: string | null;
  weeklyHours: string | null;
  cellType: string | null;
  dealType: string;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  lossReason: string | null;
  lossNotes: string | null;
  stageChangedAt: string;
  notes: string | null;
  createdAt: string;
  account: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
  } | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string;
    email: string | null;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role?: string;
  } | null;
  quotes: Array<{
    id: string;
    quoteRef: string;
    status: string;
    monthlyTotal: string;
    createdAt: string;
  }>;
  contracts: Array<{
    id: string;
    contractName: string;
    status: string;
    monthlyRevenue: string;
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    subject: string | null;
    body: string | null;
    createdAt: string;
    performer: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    assignee: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  }>;
  emails: Array<{
    id: string;
    direction: string;
    fromAddress: string;
    toAddress: string;
    subject: string | null;
    bodyHtml: string | null;
    bodyText: string | null;
    status: string;
    sentAt: string | null;
    receivedAt: string | null;
    createdAt: string;
  }>;
}

// ───── Constants ─────
const DEAL_STAGES = [
  { key: "NewLead", label: "New Lead" },
  { key: "Contacted", label: "Contacted" },
  { key: "SiteSurveyBooked", label: "Site Survey" },
  { key: "SurveyComplete", label: "Survey Done" },
  { key: "QuoteSent", label: "Quote Sent" },
  { key: "Negotiation", label: "Negotiation" },
  { key: "ClosedWonRecurring", label: "Won (Recurring)" },
  { key: "ClosedWonOneOff", label: "Won (One-Off)" },
];

const STAGE_LABELS: Record<string, string> = {
  NewLead: "New Lead",
  Contacted: "Contacted",
  SiteSurveyBooked: "Site Survey Booked",
  SurveyComplete: "Survey Complete",
  QuoteSent: "Quote Sent",
  Negotiation: "Negotiation",
  ClosedWonRecurring: "Closed Won Recurring",
  ClosedWonOneOff: "Closed Won One-Off",
  ClosedLostRecurring: "Closed Lost Recurring",
  ClosedLostOneOff: "Closed Lost One-Off",
};

const NEGOTIATION_LEVERS = [
  {
    number: 1,
    title: "Reduce Scope",
    description: "Enhanced \u2192 Standard cleaning package",
    icon: "scope",
  },
  {
    number: 2,
    title: "Reduce Frequency",
    description: "5 \u2192 3 days per week",
    icon: "frequency",
  },
  {
    number: 3,
    title: "Adjust Timing",
    description: "Daytime cleaning is cheaper than evening/night",
    icon: "timing",
  },
  {
    number: 4,
    title: "Consumables",
    description: "Client supplies own products = ~5% discount",
    icon: "consumables",
  },
  {
    number: 5,
    title: "Phased Start",
    description: "Begin with core areas first, expand later",
    icon: "phased",
  },
  {
    number: 6,
    title: "Contract Length",
    description: "12-month commitment for better rate",
    icon: "contract",
  },
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email_sent: <Mail className="h-3.5 w-3.5" />,
  email_received: <Mail className="h-3.5 w-3.5" />,
  meeting: <Calendar className="h-3.5 w-3.5" />,
  site_visit: <Building2 className="h-3.5 w-3.5" />,
  note: <MessageSquare className="h-3.5 w-3.5" />,
  quote_sent: <FileText className="h-3.5 w-3.5" />,
  deal_stage_change: <ArrowUpRight className="h-3.5 w-3.5" />,
  task_completed: <CheckCircle2 className="h-3.5 w-3.5" />,
};

// ───── Helpers ─────
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

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStageIndex(stage: string): number {
  return DEAL_STAGES.findIndex((s) => s.key === stage);
}

// ───── Component ─────
export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<"call" | "note">("call");

  async function fetchDealData() {
    try {
      const res = await fetch(`/api/deals/${dealId}`);
      if (!res.ok) throw new Error("Deal not found");
      const json = await res.json();
      setDeal(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deal");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogActivity(type: "call" | "note") {
    setActivityType(type);
    setActivityDialogOpen(true);
  }

  async function submitActivity(subject: string, body: string, duration?: number) {
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: activityType,
          subject,
          body,
          dealId,
          metadata: duration ? { duration } : {},
        }),
      });
      if (!res.ok) throw new Error("Failed to log activity");
      toast({ title: "Activity logged", description: `${activityType === "call" ? "Call" : "Note"} logged successfully.` });
      setActivityDialogOpen(false);
      fetchDealData();
    } catch {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
    }
  }

  useEffect(() => {
    async function fetchDeal() {
      try {
        const res = await fetch(`/api/deals/${dealId}`);
        if (!res.ok) throw new Error("Deal not found");
        const json = await res.json();
        setDeal(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load deal");
      } finally {
        setLoading(false);
      }
    }
    fetchDeal();
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">
          Loading deal...
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "Deal not found"}</p>
        <Button variant="outline" onClick={() => router.push("/pipeline")}>
          Back to Pipeline
        </Button>
      </div>
    );
  }

  const currentStageIdx = getStageIndex(deal.stage);
  const isLost = deal.stage.startsWith("ClosedLost");
  const isWon = deal.stage.startsWith("ClosedWon");
  const isNegotiation = deal.stage === "Negotiation";

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/pipeline")}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {deal.name}
            </h1>
            <Badge
              variant={isWon ? "default" : isLost ? "destructive" : "secondary"}
              className={cn(
                isWon && "bg-emerald-600 hover:bg-emerald-600"
              )}
            >
              {STAGE_LABELS[deal.stage] || deal.stage}
            </Badge>
            {deal.dealType && (
              <Badge variant="outline" className="capitalize">
                {deal.dealType.replace("_", " ")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {deal.account?.name ?? "No account linked"}
            {deal.contact &&
              ` \u2022 ${deal.contact.firstName ?? ""} ${deal.contact.lastName}`}
          </p>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-1">
            {DEAL_STAGES.map((stage, i) => {
              const isCompleted = i < currentStageIdx;
              const isCurrent = i === currentStageIdx;
              const isLostStage = isLost && isCurrent;

              return (
                <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "h-2 w-full rounded-full transition-colors",
                      isCompleted && "bg-emerald-500",
                      isCurrent && !isLostStage && "bg-emerald-400",
                      isLostStage && "bg-red-500",
                      !isCompleted && !isCurrent && "bg-muted"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] text-center leading-tight hidden md:block",
                      (isCompleted || isCurrent) && !isLostStage
                        ? "text-foreground font-medium"
                        : isLostStage
                        ? "text-red-600 font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT PANEL (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Account</p>
                  <p className="font-medium">
                    {deal.account ? (
                      <Link
                        href={`/accounts/${deal.account.id}`}
                        className="text-emerald-600 hover:underline"
                      >
                        {deal.account.name}
                      </Link>
                    ) : (
                      "--"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact</p>
                  <p className="font-medium">
                    {deal.contact
                      ? `${deal.contact.firstName ?? ""} ${deal.contact.lastName}`
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">
                    {deal.assignee?.name ?? "--"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Deal Type</p>
                  <p className="font-medium capitalize">
                    {deal.dealType?.replace("_", " ") ?? "--"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cell Type</p>
                  <p className="font-medium">
                    {deal.cellType
                      ? `Cell ${deal.cellType} (${deal.weeklyHours}h/wk)`
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Probability</p>
                  <p className="font-medium">{deal.probability}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(deal.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stage Changed</p>
                  <p className="font-medium">
                    {formatDate(deal.stageChangedAt)}
                  </p>
                </div>
                {deal.expectedCloseDate && (
                  <div>
                    <p className="text-muted-foreground">Expected Close</p>
                    <p className="font-medium">
                      {formatDate(deal.expectedCloseDate)}
                    </p>
                  </div>
                )}
                {deal.actualCloseDate && (
                  <div>
                    <p className="text-muted-foreground">Actual Close</p>
                    <p className="font-medium">
                      {formatDate(deal.actualCloseDate)}
                    </p>
                  </div>
                )}
              </div>
              {deal.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{deal.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Financials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-xs text-muted-foreground">Monthly Value</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrency(deal.monthlyValue)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-xs text-muted-foreground">Weekly Value</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(deal.weeklyValue)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-xs text-muted-foreground">Deal Amount</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatCurrency(deal.amount)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs text-muted-foreground">Weekly Hours</p>
                  <p className="text-lg font-bold text-amber-600">
                    {deal.weeklyHours
                      ? `${parseFloat(String(deal.weeklyHours))}h`
                      : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Quote */}
          {deal.quotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Linked Quotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deal.quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{quote.quoteRef}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(quote.createdAt)} \u2022{" "}
                          {formatCurrency(quote.monthlyTotal)}/mo
                        </p>
                      </div>
                      <Badge
                        variant={
                          quote.status === "accepted"
                            ? "default"
                            : quote.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className={cn(
                          quote.status === "accepted" &&
                            "bg-emerald-600 hover:bg-emerald-600"
                        )}
                      >
                        {quote.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Negotiation Playbook */}
          {isNegotiation && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-orange-500" />
                  Negotiation Playbook
                </CardTitle>
                <CardDescription>
                  Use these levers in order when negotiating price with the
                  client. Start from the top and work down.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {NEGOTIATION_LEVERS.map((lever) => (
                    <div
                      key={lever.number}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white border border-orange-100"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-sm font-bold">
                        {lever.number}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {lever.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lever.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Emails */}
          <DealEmailListCard emails={deal.emails} />

          {/* Loss details */}
          {isLost && deal.lossReason && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Loss Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Reason</p>
                    <p className="font-medium">{deal.lossReason}</p>
                  </div>
                  {deal.lossNotes && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Notes</p>
                      <p className="font-medium whitespace-pre-wrap">
                        {deal.lossNotes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT PANEL (1/3) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => handleLogActivity("call")}
              >
                <Phone className="h-4 w-4 mr-2" />
                Log Call
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/emails?compose=true&dealId=${dealId}&to=${deal.contact?.email || ""}`)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/calendar?new=true&dealId=${dealId}`)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => handleLogActivity("note")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => setTaskDialogOpen(true)}
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/quotes/new?dealId=${dealId}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            </CardContent>
          </Card>

          {/* Tasks */}
          {deal.tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deal.tasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <div
                      className={cn(
                        "mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                        task.status === "completed"
                          ? "border-emerald-500 bg-emerald-500"
                          : task.priority === "urgent"
                          ? "border-red-400"
                          : task.priority === "high"
                          ? "border-amber-400"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {task.status === "completed" && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "truncate",
                          task.status === "completed" &&
                            "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due {formatDate(task.dueDate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deal.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {deal.activities.map((activity, i) => (
                    <div key={activity.id} className="relative flex gap-3">
                      {/* Timeline line */}
                      {i < deal.activities.length - 1 && (
                        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                      )}
                      {/* Icon */}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground z-10">
                        {ACTIVITY_ICONS[activity.activityType] ?? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {activity.subject ||
                              activity.activityType.replace(/_/g, " ")}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                        </div>
                        {activity.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {activity.body}
                          </p>
                        )}
                        {activity.performer && (
                          <div className="flex items-center gap-1 mt-1">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-slate-200">
                                {getInitials(activity.performer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">
                              {activity.performer.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        dealId={dealId}
        onSuccess={fetchDealData}
      />

      {/* Activity Log Dialog (Call / Note) */}
      <ActivityLogInlineDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        type={activityType}
        onSubmit={submitActivity}
      />
    </div>
  );
}

// Expandable email list for the deal
function DealEmailListCard({
  emails,
}: {
  emails: DealDetail["emails"];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Emails ({emails.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No emails linked to this deal.
          </p>
        ) : (
          <div className="space-y-2">
            {emails.slice(0, 15).map((email) => {
              const isExpanded = expandedId === email.id;
              return (
                <div
                  key={email.id}
                  className={cn(
                    "rounded-lg border text-sm overflow-hidden",
                    email.direction === "outbound"
                      ? "border-l-4 border-l-[#0B3D91]"
                      : "border-l-4 border-l-gray-300"
                  )}
                >
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : email.id)
                    }
                    className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors"
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
                      {formatDate(
                        email.sentAt || email.receivedAt || email.createdAt
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t bg-muted/20">
                      {email.bodyHtml ? (
                        <div
                          className="text-sm prose prose-sm max-w-none [&_img]:max-w-full"
                          dangerouslySetInnerHTML={{
                            __html: email.bodyHtml,
                          }}
                        />
                      ) : (
                        <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                          {email.bodyText || "No content"}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Inline activity log dialog for Log Call / Add Note
function ActivityLogInlineDialog({
  open,
  onOpenChange,
  type,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "call" | "note";
  onSubmit: (subject: string, body: string, duration?: number) => void;
}) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {type === "call" ? "Log Call" : "Add Note"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="activity-subject">Subject</Label>
            <Input
              id="activity-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === "call" ? "Call with..." : "Note about..."}
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="activity-body">
              {type === "call" ? "Call Notes" : "Note Content"}
            </Label>
            <Textarea
              id="activity-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter details..."
              className="mt-1"
              rows={4}
            />
          </div>
          {type === "call" && (
            <div>
              <Label htmlFor="activity-duration">Duration (minutes)</Label>
              <Input
                id="activity-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 15"
                className="mt-1 w-32"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={submitting || !subject.trim()}
            onClick={async () => {
              setSubmitting(true);
              await onSubmit(
                subject,
                body,
                duration ? parseInt(duration) : undefined
              );
              setSubmitting(false);
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {type === "call" ? "Log Call" : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
