"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  PoundSterling,
  Target,
  FileText,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Briefcase,
  Users,
  Activity,
  CheckCircle2,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  FileCheck,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ---------- Types ----------

interface DashboardData {
  pipeline: {
    value: number;
    weightedForecast: number;
    dealsClosingThisMonth: number;
    activeDealCount: number;
  };
  operations: {
    activeContracts: number;
    weeklyHours: number;
    monthlyRevenue: number;
    overdueAudits: number;
    belowTargetMargin: number;
  };
  leads: {
    inCadence: number;
    quotesAwaiting: number;
  };
  tasks: {
    today: TaskItem[];
    overdueCount: number;
  };
  recentActivity: ActivityItem[];
  upcomingMeetings: MeetingItem[];
  staleDeals: StaleDealItem[];
  winLoss: {
    won: number;
    lost: number;
    winRate: number;
  };
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  taskType: string;
  dueDate: string;
  deal: { id: string; name: string } | null;
  lead: { id: string; companyName: string } | null;
  account: { id: string; name: string } | null;
  contract: { id: string; contractName: string } | null;
}

interface ActivityItem {
  id: string;
  activityType: string;
  subject: string;
  createdAt: string;
  deal: { id: string; name: string } | null;
  lead: { id: string; companyName: string } | null;
  account: { id: string; name: string } | null;
  contract: { id: string; contractName: string } | null;
  performer: { id: string; name: string } | null;
}

interface MeetingItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType: string;
  contact: { id: string; firstName: string; lastName: string } | null;
  account: { id: string; name: string } | null;
}

interface StaleDealItem {
  id: string;
  name: string;
  daysStale: number;
  account: { id: string; name: string } | null;
}

// ---------- Helpers ----------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email_sent: Mail,
  email_received: Mail,
  site_visit: MapPin,
  meeting: CalendarDays,
  note: FileText,
  whatsapp: MessageSquare,
  quote_sent: FileCheck,
  quote_accepted: CheckCircle2,
  deal_stage_change: TrendingUp,
  contract_created: Briefcase,
  audit_completed: ClipboardCheck,
  task_completed: CheckCircle2,
  cadence_email_sent: Zap,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

function getLinkedEntity(item: { deal?: { id: string; name: string } | null; lead?: { id: string; companyName: string } | null; account?: { id: string; name: string } | null; contract?: { id: string; contractName: string } | null }): { label: string; href: string } | null {
  if (item.deal) return { label: item.deal.name, href: `/deals/${item.deal.id}` };
  if (item.account) return { label: item.account.name, href: `/accounts/${item.account.id}` };
  if (item.lead) return { label: item.lead.companyName, href: `/leads/${item.lead.id}` };
  if (item.contract) return { label: item.contract.contractName, href: `/contracts/${item.contract.id}` };
  return null;
}

// ---------- KPI Card component ----------

const accentStyles = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    icon: "text-amber-600 dark:text-amber-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "text-blue-600 dark:text-blue-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "text-red-600 dark:text-red-400",
  },
} as const;

type AccentColor = keyof typeof accentStyles;

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { direction: "up" | "down" | "neutral"; label: string };
  progress?: { current: number; target: number; unit?: string };
  accentColor?: AccentColor;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  accentColor = "emerald",
}: KpiCardProps) {
  const accent = accentStyles[accentColor];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.bg}`}
        >
          <Icon className={`h-4 w-4 ${accent.icon}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend.direction === "up" && (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            )}
            {trend.direction === "down" && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={
                trend.direction === "up"
                  ? "text-emerald-600"
                  : trend.direction === "down"
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            >
              {trend.label}
            </span>
          </div>
        )}
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                {progress.current}
                {progress.unit ? ` ${progress.unit}` : ""}
              </span>
              <span>
                {progress.target}
                {progress.unit ? ` ${progress.unit}` : ""} target
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    (progress.current / progress.target) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Loading skeleton ----------

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-32 rounded bg-muted" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-10 w-full rounded bg-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Task list section ----------

function TasksSection({ tasks, overdueCount }: { tasks: TaskItem[]; overdueCount: number }) {
  if (tasks.length === 0 && overdueCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Today&apos;s Tasks</CardTitle>
          </div>
          <CardDescription>Your priorities for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No tasks due today — nice work!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Today&apos;s Tasks</CardTitle>
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-[11px]">
              {overdueCount} overdue
            </Badge>
          )}
        </div>
        <CardDescription>Your priorities for today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tasks.map((task) => {
            const linked = getLinkedEntity(task);
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px] px-1.5 py-0", PRIORITY_COLORS[task.priority])}
                >
                  {task.priority}
                </Badge>
                <span className="flex-1 truncate font-medium">{task.title}</span>
                {linked && (
                  <Link
                    href={linked.href}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground truncate max-w-[120px]"
                  >
                    {linked.label}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Activity feed section ----------

function ActivitySection({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>
          <CardDescription>Latest actions across the business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No recent activity
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
        <CardDescription>Latest actions across the business</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities.map((act) => {
            const IconComp = ACTIVITY_ICONS[act.activityType] || Activity;
            const entity = getLinkedEntity(act);
            return (
              <div
                key={act.id}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <IconComp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{act.subject}</span>
                {entity && (
                  <Link
                    href={entity.href}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground truncate max-w-[100px]"
                  >
                    {entity.label}
                  </Link>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(act.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Meetings section ----------

function MeetingsSection({ meetings }: { meetings: MeetingItem[] }) {
  if (meetings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Upcoming Meetings</CardTitle>
          </div>
          <CardDescription>Scheduled meetings and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No upcoming meetings
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Upcoming Meetings</CardTitle>
        </div>
        <CardDescription>Scheduled meetings and events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="shrink-0 text-center min-w-[52px]">
                <p className="text-xs text-muted-foreground">
                  {formatDate(meeting.startTime)}
                </p>
                <p className="text-sm font-semibold">
                  {formatTime(meeting.startTime)}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{meeting.title}</p>
                {(meeting.contact || meeting.account) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {meeting.contact
                      ? `${meeting.contact.firstName} ${meeting.contact.lastName}`
                      : ""}
                    {meeting.contact && meeting.account ? " — " : ""}
                    {meeting.account?.name || ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Stale deals section ----------

function StaleDealsSection({ deals }: { deals: StaleDealItem[] }) {
  if (deals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Stale Deals</CardTitle>
          </div>
          <CardDescription>Deals with no activity in 14+ days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No stale deals — pipeline is moving!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Stale Deals</CardTitle>
        </div>
        <CardDescription>Deals with no activity in 14+ days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {deals.map((deal) => (
            <Link
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{deal.name}</p>
                {deal.account && (
                  <p className="text-xs text-muted-foreground truncate">
                    {deal.account.name}
                  </p>
                )}
              </div>
              <Badge variant="destructive" className="shrink-0 text-[10px]">
                {deal.daysStale}d stale
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Main dashboard page ----------

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const user = session?.user as
    | { name?: string | null; role?: string }
    | undefined;

  const userRole = user?.role || "admin";

  const defaultTab =
    userRole === "sales" ? "nicks" : userRole === "admin" ? "nels" : "unified";

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error();
        const json = await res.json();
        setDashData(json.data);
      } catch {
        setDashData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const d = dashData;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome back
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <Badge variant="outline" className="capitalize text-xs">
            {userRole}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Here is what is happening across your business today.
        </p>
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="nicks">Nick&apos;s View</TabsTrigger>
          <TabsTrigger value="nels">Nels&apos;s View</TabsTrigger>
          <TabsTrigger value="unified">Unified</TabsTrigger>
        </TabsList>

        {/* Nick's View — Sales focused */}
        <TabsContent value="nicks" className="space-y-6">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Tasks & Meetings at the TOP (Nick's preference) */}
              <div className="grid gap-4 md:grid-cols-2">
                <TasksSection
                  tasks={d?.tasks.today ?? []}
                  overdueCount={d?.tasks.overdueCount ?? 0}
                />
                <MeetingsSection meetings={d?.upcomingMeetings ?? []} />
              </div>

              <Separator />

              {/* KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="Pipeline Value"
                  value={formatCurrency(d?.pipeline.value ?? 0)}
                  subtitle="Total active pipeline"
                  icon={PoundSterling}
                  trend={
                    d?.pipeline.weightedForecast
                      ? {
                          direction: "neutral",
                          label: `${formatCurrency(d.pipeline.weightedForecast)} weighted`,
                        }
                      : { direction: "neutral", label: "No data yet" }
                  }
                />
                <KpiCard
                  title="Deals Closing This Month"
                  value={String(d?.pipeline.dealsClosingThisMonth ?? 0)}
                  subtitle="Expected close within 30 days"
                  icon={Target}
                  trend={{
                    direction:
                      (d?.pipeline.dealsClosingThisMonth ?? 0) > 0
                        ? "up"
                        : "neutral",
                    label:
                      (d?.pipeline.dealsClosingThisMonth ?? 0) > 0
                        ? `${d?.pipeline.activeDealCount} total active`
                        : "No data yet",
                  }}
                />
                <KpiCard
                  title="Quotes Awaiting Response"
                  value={String(d?.leads.quotesAwaiting ?? 0)}
                  subtitle="Sent and pending reply"
                  icon={FileText}
                />
                <KpiCard
                  title="Active Cadence Count"
                  value={String(d?.leads.inCadence ?? 0)}
                  subtitle="Leads in automated outreach"
                  icon={Zap}
                />
              </div>

              {/* Financial KPIs */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="Monthly Revenue"
                  value={formatCurrency(d?.operations.monthlyRevenue ?? 0)}
                  subtitle="Recurring monthly revenue"
                  icon={PoundSterling}
                  accentColor="blue"
                />
                <KpiCard
                  title="Win Rate"
                  value={`${d?.winLoss.winRate ?? 0}%`}
                  subtitle={`${d?.winLoss.won ?? 0} won / ${d?.winLoss.lost ?? 0} lost`}
                  icon={Target}
                  accentColor={
                    (d?.winLoss.winRate ?? 0) >= 50 ? "emerald" : "amber"
                  }
                />
                <KpiCard
                  title="Weekly Hours"
                  value={String(d?.operations.weeklyHours ?? 0)}
                  subtitle="Contracted cleaning hours"
                  icon={Clock}
                  progress={{
                    current: d?.operations.weeklyHours ?? 0,
                    target: 1000,
                    unit: "hrs",
                  }}
                />
                <KpiCard
                  title="Below Target Margin"
                  value={String(d?.operations.belowTargetMargin ?? 0)}
                  subtitle="Contracts below 35% margin"
                  icon={AlertTriangle}
                  accentColor={
                    (d?.operations.belowTargetMargin ?? 0) > 0 ? "red" : "emerald"
                  }
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <ActivitySection activities={d?.recentActivity ?? []} />
                <StaleDealsSection deals={d?.staleDeals ?? []} />
              </div>
            </>
          )}
        </TabsContent>

        {/* Nels's View — Operations focused */}
        <TabsContent value="nels" className="space-y-6">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="Weekly Hours"
                  value={String(d?.operations.weeklyHours ?? 0)}
                  subtitle="Contracted cleaning hours"
                  icon={Clock}
                  progress={{
                    current: d?.operations.weeklyHours ?? 0,
                    target: 1000,
                    unit: "hrs",
                  }}
                />
                <KpiCard
                  title="Active Contracts"
                  value={String(d?.operations.activeContracts ?? 0)}
                  subtitle="Currently active sites"
                  icon={Briefcase}
                  trend={{
                    direction:
                      (d?.operations.activeContracts ?? 0) > 0
                        ? "up"
                        : "neutral",
                    label:
                      (d?.operations.activeContracts ?? 0) > 0
                        ? `${formatCurrency(d?.operations.monthlyRevenue ?? 0)}/mo revenue`
                        : "No data yet",
                  }}
                />
                <KpiCard
                  title="Monthly Revenue"
                  value={formatCurrency(d?.operations.monthlyRevenue ?? 0)}
                  subtitle="Recurring monthly revenue"
                  icon={PoundSterling}
                  accentColor="blue"
                />
                <KpiCard
                  title="Overdue Audits"
                  value={String(d?.operations.overdueAudits ?? 0)}
                  subtitle="Past scheduled audit date"
                  icon={ShieldCheck}
                  accentColor={
                    (d?.operations.overdueAudits ?? 0) > 0 ? "red" : "emerald"
                  }
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <TasksSection
                  tasks={d?.tasks.today ?? []}
                  overdueCount={d?.tasks.overdueCount ?? 0}
                />
                <ActivitySection activities={d?.recentActivity ?? []} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MeetingsSection meetings={d?.upcomingMeetings ?? []} />
                <StaleDealsSection deals={d?.staleDeals ?? []} />
              </div>
            </>
          )}
        </TabsContent>

        {/* Unified View */}
        <TabsContent value="unified" className="space-y-6">
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  title="Weekly Hours"
                  value={String(d?.operations.weeklyHours ?? 0)}
                  subtitle="Total contracted hours"
                  icon={Clock}
                  progress={{
                    current: d?.operations.weeklyHours ?? 0,
                    target: 1000,
                    unit: "hrs",
                  }}
                />
                <KpiCard
                  title="Monthly Revenue"
                  value={formatCurrency(d?.operations.monthlyRevenue ?? 0)}
                  subtitle="Recurring monthly revenue"
                  icon={PoundSterling}
                  trend={{
                    direction:
                      (d?.operations.monthlyRevenue ?? 0) > 0
                        ? "up"
                        : "neutral",
                    label:
                      (d?.operations.monthlyRevenue ?? 0) > 0
                        ? `${d?.operations.activeContracts} active contracts`
                        : "No data yet",
                  }}
                />
                <KpiCard
                  title="Pipeline Value"
                  value={formatCurrency(d?.pipeline.value ?? 0)}
                  subtitle="Weighted deal value"
                  icon={Target}
                  trend={{
                    direction:
                      (d?.pipeline.value ?? 0) > 0 ? "up" : "neutral",
                    label:
                      (d?.pipeline.value ?? 0) > 0
                        ? `${d?.winLoss.winRate}% win rate`
                        : "No data yet",
                  }}
                />
                <KpiCard
                  title="Active Leads in Cadence"
                  value={String(d?.leads.inCadence ?? 0)}
                  subtitle="Leads in automated outreach"
                  icon={Users}
                />
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <TasksSection
                  tasks={d?.tasks.today ?? []}
                  overdueCount={d?.tasks.overdueCount ?? 0}
                />
                <ActivitySection activities={d?.recentActivity ?? []} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MeetingsSection meetings={d?.upcomingMeetings ?? []} />
                <StaleDealsSection deals={d?.staleDeals ?? []} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
