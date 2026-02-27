"use client";

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
  ArrowRight,
} from "lucide-react";

// ---------- KPI Card component ----------

// Tailwind requires full class names at build time — no dynamic interpolation.
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

// ---------- Placeholder section card ----------

interface PlaceholderSectionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: string[];
}

function PlaceholderSection({
  title,
  description,
  icon: Icon,
  items,
}: PlaceholderSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span className="flex-1 text-muted-foreground">{item}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No items to display yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Main dashboard page ----------

export default function DashboardPage() {
  const { data: session } = useSession();

  const user = session?.user as
    | { name?: string | null; role?: string }
    | undefined;

  const userRole = user?.role || "admin";

  // Determine default tab based on role
  const defaultTab =
    userRole === "sales" ? "nicks" : userRole === "admin" ? "nels" : "unified";

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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Pipeline Value"
              value={"\u00A30"}
              subtitle="Total weighted pipeline"
              icon={PoundSterling}
              trend={{ direction: "neutral", label: "No data yet" }}
            />
            <KpiCard
              title="Deals Closing This Month"
              value="0"
              subtitle="Expected close within 30 days"
              icon={Target}
              trend={{ direction: "neutral", label: "No data yet" }}
            />
            <KpiCard
              title="Quotes Awaiting Response"
              value="0"
              subtitle="Sent and pending reply"
              icon={FileText}
            />
            <KpiCard
              title="Active Cadence Count"
              value="0"
              subtitle="Leads in automated outreach"
              icon={Zap}
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Today's Tasks"
              description="Your priorities for today"
              icon={CheckCircle2}
              items={[
                "Follow up on open quotes",
                "Review new inbound leads",
                "Prepare for upcoming site surveys",
              ]}
            />
            <PlaceholderSection
              title="Recent Activity"
              description="Latest actions across the pipeline"
              icon={Activity}
              items={[
                "Quote sent to prospect",
                "Meeting booked via Calendly",
                "Lead moved to Warm Prospect",
              ]}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Upcoming Meetings"
              description="Scheduled for this week"
              icon={CalendarDays}
            />
            <PlaceholderSection
              title="Stale Deals"
              description="Deals with no activity in 14+ days"
              icon={Clock}
            />
          </div>
        </TabsContent>

        {/* Nels's View — Operations focused */}
        <TabsContent value="nels" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Weekly Hours"
              value="0"
              subtitle="Contracted cleaning hours"
              icon={Clock}
              progress={{ current: 0, target: 1000, unit: "hrs" }}
            />
            <KpiCard
              title="Active Contracts"
              value="0"
              subtitle="Currently active sites"
              icon={Briefcase}
              trend={{ direction: "neutral", label: "No data yet" }}
            />
            <KpiCard
              title="Overdue Audits"
              value="0"
              subtitle="Past scheduled audit date"
              icon={ShieldCheck}
            />
            <KpiCard
              title="Compliance Alerts"
              value="0"
              subtitle="Items requiring attention"
              icon={AlertTriangle}
              accentColor="amber"
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Today's Tasks"
              description="Operational priorities for today"
              icon={CheckCircle2}
              items={[
                "Complete site audit at account",
                "Review subcontractor compliance",
                "Resolve open issue tickets",
              ]}
            />
            <PlaceholderSection
              title="Contract Health"
              description="Sites needing attention"
              icon={Activity}
              items={[
                "Amber status: review required",
                "Upcoming contract renewal",
                "Staff shortage flagged",
              ]}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Upcoming Audits"
              description="Scheduled for this week"
              icon={ShieldCheck}
            />
            <PlaceholderSection
              title="Open Issues"
              description="Unresolved client issues"
              icon={AlertTriangle}
            />
          </div>
        </TabsContent>

        {/* Unified View */}
        <TabsContent value="unified" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Weekly Hours"
              value="0"
              subtitle="Total contracted hours"
              icon={Clock}
              progress={{ current: 0, target: 1000, unit: "hrs" }}
            />
            <KpiCard
              title="Monthly Revenue"
              value={"\u00A30"}
              subtitle="Recurring monthly revenue"
              icon={PoundSterling}
              trend={{ direction: "neutral", label: "No data yet" }}
            />
            <KpiCard
              title="Pipeline Value"
              value={"\u00A30"}
              subtitle="Weighted deal value"
              icon={Target}
              trend={{ direction: "neutral", label: "No data yet" }}
            />
            <KpiCard
              title="Active Leads in Cadence"
              value="0"
              subtitle="Leads in automated outreach"
              icon={Users}
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Today's Tasks"
              description="Combined priority tasks"
              icon={CheckCircle2}
              items={[
                "Follow up on open quotes",
                "Complete site audit at account",
                "Review new inbound leads",
              ]}
            />
            <PlaceholderSection
              title="Activity Feed"
              description="Latest actions across the business"
              icon={Activity}
              items={[
                "New lead captured from landing page",
                "Audit completed: 92% score",
                "Contract activated for new site",
              ]}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PlaceholderSection
              title="Upcoming This Week"
              description="Meetings, audits, and deadlines"
              icon={CalendarDays}
            />
            <PlaceholderSection
              title="Attention Required"
              description="Items needing review"
              icon={AlertTriangle}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
