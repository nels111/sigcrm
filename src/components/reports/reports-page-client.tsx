"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Sprout,
  DollarSign,
  Calculator,
  ClipboardCheck,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyDecimal(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
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
  return labels[stage] || stage;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    LandingPage: "Landing Page",
    ColdCall: "Cold Call",
    Referral: "Referral",
    NetworkEvent: "Network Event",
    ApolloAI: "Apollo AI",
    LinkedIn: "LinkedIn",
    Facebook: "Facebook",
    XTwitter: "X (Twitter)",
    WebResearch: "Web Research",
    Chat: "Chat",
    GoogleAds: "Google Ads",
    Seminar: "Seminar",
    TradeShow: "Trade Show",
    QuickCapture: "Quick Capture",
    QuoteForm: "Quote Form",
    Unknown: "Unknown",
  };
  return labels[source] || source;
}

function marginColorClass(percent: number): string {
  if (percent >= 35) return "text-emerald-600";
  if (percent >= 25) return "text-amber-600";
  return "text-red-600";
}

function marginBgClass(percent: number): string {
  if (percent >= 35) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (percent >= 25) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  totalMonthlyValue: number;
  weightedForecast: number;
  avgDaysInStage: number;
}

interface PipelineData {
  stages: PipelineStage[];
  summary: {
    totalActiveDeals: number;
    totalActiveValue: number;
    totalWeightedForecast: number;
    totalDeals: number;
  };
}

interface ConversionItem {
  from: string;
  to: string;
  actual: number;
  target: number;
  variance: number;
  counts: { from: number; to: number };
}

interface ConversionData {
  conversions: ConversionItem[];
  summary: {
    totalLeads: number;
    totalMeetings: number;
    totalQuotes: number;
    totalWins: number;
    overallConversion: number;
  };
}

interface AttributionItem {
  source: string;
  totalLeads: number;
  convertedLeads: number;
  wonDeals: number;
  conversionRate: number;
  winRate: number;
  wonRevenue: number;
}

interface AttributionData {
  attribution: AttributionItem[];
  summary: {
    totalLeads: number;
    totalConverted: number;
    totalWon: number;
    totalWonRevenue: number;
  };
}

interface GrowthTrend {
  month: string;
  hoursAdded: number;
  cumulativeHours: number;
}

interface GrowthData {
  target: number;
  currentTotalHours: number;
  progress: number;
  remainingHours: number;
  projectedDate: string | null;
  contractCount: number;
  trend: GrowthTrend[];
}

interface RevenueCellBreakdown {
  cellType: string;
  contractCount: number;
  totalHours: number;
  totalMonthlyRevenue: number;
  totalAnnualValue: number;
  avgMargin: number;
}

interface RevenueData {
  breakdown: RevenueCellBreakdown[];
  grandTotal: {
    contractCount: number;
    totalHours: number;
    totalMonthlyRevenue: number;
    totalAnnualValue: number;
    avgMargin: number;
  };
}

interface FinancialContract {
  id: string;
  contractName: string;
  cellType: string;
  monthlyRevenue: number;
  monthlyLabourCost: number;
  consumablesPercent: number;
  grossMarginPercent: number;
  marginStatus: string;
}

interface FinancialData {
  contracts: FinancialContract[];
  summary: {
    contractCount: number;
    totalMonthlyRevenue: number;
    totalMonthlyLabourCost: number;
    totalConsumablesCost: number;
    totalGrossProfit: number;
    overallMarginPercent: number;
    overallMarginStatus: string;
    marginDistribution: { green: number; amber: number; red: number };
  };
}

interface ScorecardData {
  generatedAt: string;
  hours: {
    current: number;
    target: number;
    progress: number;
    contractCount: number;
  };
  revenue: { monthlyRevenue: number; annualValue: number };
  costs: {
    monthlyLabourCost: number;
    monthlyConsumables: number;
    totalMonthlyCost: number;
  };
  margins: { avgGrossMargin: number; grossProfit: number };
  deals: {
    active: number;
    won: number;
    lost: number;
    pipelineValue: number;
    winRate: number;
  };
  cadence: { active: number; total: number; percentage: number };
  tasks: {
    total: number;
    completed: number;
    overdue: number;
    completionRate: number;
  };
  audits: { thisMonth: number; avgScore: number };
  activity: { last7Days: number };
}

// ---------------------------------------------------------------------------
// Tab Components
// ---------------------------------------------------------------------------

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}

function ErrorState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      {text}
    </div>
  );
}

// Pipeline Tab
function PipelineTab() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/pipeline");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading pipeline data..." />;
  if (!data) return <ErrorState text="Failed to load pipeline data." />;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Active Deals</p>
            <p className="text-2xl font-bold">{data.summary.totalActiveDeals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
            <p className="text-2xl font-bold">
              {formatCurrency(data.summary.totalActiveValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Weighted Forecast</p>
            <p className="text-2xl font-bold">
              {formatCurrency(data.summary.totalWeightedForecast)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deals by stage table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Stage
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Deal Count
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Total Value
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                    Weighted Value
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden lg:table-cell">
                    Avg Days in Stage
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stages.map((stage) => (
                  <TableRow key={stage.stage}>
                    <TableCell className="font-medium">
                      {stageLabel(stage.stage)}
                    </TableCell>
                    <TableCell className="text-right">{stage.count}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(stage.totalValue)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatCurrency(stage.weightedForecast)}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {stage.avgDaysInStage}d
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Conversion Tab
function ConversionTab() {
  const [data, setData] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/conversion");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading conversion data..." />;
  if (!data) return <ErrorState text="Failed to load conversion data." />;

  return (
    <div className="space-y-4">
      {/* Conversion funnel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.conversions.map((conv) => {
          const meetsTarget = conv.actual >= conv.target;
          return (
            <Card key={`${conv.from}-${conv.to}`}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-1">
                  {conv.from} &rarr; {conv.to}
                </p>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    meetsTarget ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {conv.actual}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Target: {conv.target}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {conv.counts.to} of {conv.counts.from}
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-2 text-[11px]",
                    meetsTarget
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-red-100 text-red-800 border-red-200"
                  )}
                >
                  {conv.variance >= 0 ? "+" : ""}
                  {conv.variance}% vs target
                </Badge>
              </CardContent>
            </Card>
          );
        })}

        {/* Average Sales Cycle card */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-1">
              Average Sales Cycle
            </p>
            <p className="text-3xl font-bold text-muted-foreground">--</p>
            <p className="text-xs text-muted-foreground mt-1">
              Target: 14-30 days
            </p>
            <p className="text-xs text-muted-foreground">
              Overall: {data.summary.overallConversion}% lead-to-win
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Attribution Tab
function AttributionTab() {
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/attribution");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading attribution data..." />;
  if (!data) return <ErrorState text="Failed to load attribution data." />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Source Attribution</CardTitle>
          <CardDescription>
            Performance breakdown by lead source, sorted by total leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Lead Source
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Total Leads
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                    Converted
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                    Won Deals
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden lg:table-cell">
                    Won Value
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Conversion Rate
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attribution
                  .filter((a) => a.totalLeads > 0)
                  .map((attr) => (
                    <TableRow key={attr.source}>
                      <TableCell className="font-medium">
                        {sourceLabel(attr.source)}
                      </TableCell>
                      <TableCell className="text-right">
                        {attr.totalLeads}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {attr.convertedLeads}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {attr.wonDeals}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        {formatCurrency(attr.wonRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            attr.conversionRate > 0
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          )}
                        >
                          {attr.conversionRate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                {/* Summary row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {data.summary.totalLeads}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {data.summary.totalConverted}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {data.summary.totalWon}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {formatCurrency(data.summary.totalWonRevenue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {data.summary.totalLeads > 0
                      ? (
                          (data.summary.totalConverted /
                            data.summary.totalLeads) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Growth Tab
function GrowthTab() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/growth");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading growth data..." />;
  if (!data) return <ErrorState text="Failed to load growth data." />;

  if (data.contractCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Sprout className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground font-medium">No active contracts yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Growth tracking will appear once contracts are created.
        </p>
      </div>
    );
  }

  const progressPercent = Math.min(100, data.progress);

  return (
    <div className="space-y-6">
      {/* Main progress section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Growth Tracker: 1,000 Weekly Hours Target
          </CardTitle>
          <CardDescription>
            Track progress toward the 1,000 weekly contracted hours goal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Big number */}
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold text-emerald-600">
                {data.currentTotalHours.toFixed(1)}
              </span>
              <span className="text-lg text-muted-foreground mb-1">
                / {data.target} hours
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
                style={{ width: `${progressPercent}%` }}
              >
                {progressPercent >= 15 && (
                  <span className="text-xs font-bold text-white">
                    {data.progress}%
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold">{data.progress}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-lg font-semibold">
                  {data.remainingHours.toFixed(1)}h
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Contracts</p>
                <p className="text-lg font-semibold">{data.contractCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Projected Completion
                </p>
                <p className="text-lg font-semibold">
                  {data.projectedDate === "Achieved"
                    ? "Achieved!"
                    : data.projectedDate || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly trend */}
      {data.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Hours Added</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium uppercase tracking-wide">
                      Month
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                      Hours Added
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                      Cumulative Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trend.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">
                        +{row.hoursAdded.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {row.cumulativeHours.toFixed(1)}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Revenue Tab
function RevenueTab() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/revenue");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading revenue data..." />;
  if (!data) return <ErrorState text="Failed to load revenue data." />;

  if (data.grandTotal.contractCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <DollarSign className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground font-medium">No revenue data yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue breakdown will appear once contracts are active.
        </p>
      </div>
    );
  }

  const cellColors: Record<string, string> = {
    A: "border-blue-200 bg-blue-50/50",
    B: "border-amber-200 bg-amber-50/50",
    C: "border-purple-200 bg-purple-50/50",
  };

  return (
    <div className="space-y-6">
      {/* Cell type cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.breakdown.map((cell) => (
          <Card key={cell.cellType} className={cellColors[cell.cellType] || ""}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  Cell {cell.cellType}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contracts</span>
                  <span className="font-semibold">{cell.contractCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekly Hours</span>
                  <span className="font-semibold">{cell.totalHours}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Revenue</span>
                  <span className="font-semibold">
                    {formatCurrencyDecimal(cell.totalMonthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Value</span>
                  <span className="font-semibold">
                    {formatCurrency(cell.totalAnnualValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Margin</span>
                  <span
                    className={cn("font-semibold", marginColorClass(cell.avgMargin))}
                  >
                    {cell.avgMargin}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grand totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Total Contracts</p>
              <p className="text-xl font-bold">{data.grandTotal.contractCount}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-xl font-bold">{data.grandTotal.totalHours}h</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Monthly Revenue</p>
              <p className="text-xl font-bold">
                {formatCurrencyDecimal(data.grandTotal.totalMonthlyRevenue)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Annual Value</p>
              <p className="text-xl font-bold">
                {formatCurrency(data.grandTotal.totalAnnualValue)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Avg Margin</p>
              <p
                className={cn(
                  "text-xl font-bold",
                  marginColorClass(data.grandTotal.avgMargin)
                )}
              >
                {data.grandTotal.avgMargin}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Financial Tab
function FinancialTab() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/financial");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState text="Loading financial data..." />;
  if (!data) return <ErrorState text="Failed to load financial data." />;

  if (data.summary.contractCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Calculator className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground font-medium">No financial data yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Financial detail will appear once contracts are active.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Margin distribution */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Green (&ge;35%)</p>
            <p className="text-2xl font-bold text-emerald-600">
              {data.summary.marginDistribution.green}
            </p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Amber (25-34%)</p>
            <p className="text-2xl font-bold text-amber-600">
              {data.summary.marginDistribution.amber}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Red (&lt;25%)</p>
            <p className="text-2xl font-bold text-red-600">
              {data.summary.marginDistribution.red}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contracts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract Financial Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Contract
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">
                    Cell
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Monthly Revenue
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden md:table-cell">
                    Labour Cost
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right hidden lg:table-cell">
                    Consumables %
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-right">
                    Gross Margin %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.contractName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {c.cellType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyDecimal(c.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell">
                      {formatCurrencyDecimal(c.monthlyLabourCost)}
                    </TableCell>
                    <TableCell className="text-right hidden lg:table-cell">
                      {c.consumablesPercent}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px] font-semibold",
                          marginBgClass(c.grossMarginPercent)
                        )}
                      >
                        {c.grossMarginPercent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Summary row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>
                    Total ({data.summary.contractCount} contracts)
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatCurrencyDecimal(data.summary.totalMonthlyRevenue)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {formatCurrencyDecimal(data.summary.totalMonthlyLabourCost)}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    --
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-semibold",
                        marginBgClass(data.summary.overallMarginPercent)
                      )}
                    >
                      {data.summary.overallMarginPercent}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Scorecard Tab
function ScorecardTab() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const isAdmin = session?.user?.role === "admin";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/scorecard");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/scorecard", { method: "POST" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.data);
      toast({
        title: "Scorecard Generated",
        description: "Weekly scorecard has been generated successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate scorecard.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState text="Loading scorecard..." />;

  return (
    <div className="space-y-6">
      {/* Header with generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Weekly Scorecard</h3>
          {data?.generatedAt && (
            <p className="text-sm text-muted-foreground">
              Last generated:{" "}
              {new Date(data.generatedAt).toLocaleString("en-GB")}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate Now
          </Button>
        )}
      </div>

      {!data ? (
        <ErrorState text="No scorecard data available. Click Generate Now to create one." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hours */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-500" />
                Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Weekly Hours</span>
                  <span className="font-semibold">{data.hours.current}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold">{data.hours.target}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-emerald-600">
                    {data.hours.progress}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contracts</span>
                  <span className="font-semibold">
                    {data.hours.contractCount}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Revenue</span>
                  <span className="font-semibold">
                    {formatCurrencyDecimal(data.revenue.monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Value</span>
                  <span className="font-semibold">
                    {formatCurrency(data.revenue.annualValue)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Costs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-amber-500" />
                Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labour Cost</span>
                  <span className="font-semibold">
                    {formatCurrencyDecimal(data.costs.monthlyLabourCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Consumables</span>
                  <span className="font-semibold">
                    {formatCurrencyDecimal(data.costs.monthlyConsumables)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-medium">
                    Total Monthly Cost
                  </span>
                  <span className="font-bold">
                    {formatCurrencyDecimal(data.costs.totalMonthlyCost)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Margins */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Margins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Gross Margin</span>
                  <span
                    className={cn(
                      "font-semibold",
                      marginColorClass(data.margins.avgGrossMargin)
                    )}
                  >
                    {data.margins.avgGrossMargin}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Profit</span>
                  <span className="font-semibold">
                    {formatCurrencyDecimal(data.margins.grossProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Deals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-semibold">{data.deals.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Won</span>
                  <span className="font-semibold text-emerald-600">
                    {data.deals.won}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lost</span>
                  <span className="font-semibold text-red-600">
                    {data.deals.lost}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pipeline Value</span>
                  <span className="font-semibold">
                    {formatCurrency(data.deals.pipelineValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-semibold">{data.deals.winRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cadence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                Cadence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active in Cadence</span>
                  <span className="font-semibold">{data.cadence.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Leads</span>
                  <span className="font-semibold">{data.cadence.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cadence Rate</span>
                  <span className="font-semibold">
                    {data.cadence.percentage}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-sky-500" />
                Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{data.tasks.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold text-emerald-600">
                    {data.tasks.completed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overdue</span>
                  <span
                    className={cn(
                      "font-semibold",
                      data.tasks.overdue > 0 ? "text-red-600" : ""
                    )}
                  >
                    {data.tasks.overdue}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold">
                    {data.tasks.completionRate}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-violet-500" />
                Audits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-semibold">{data.audits.thisMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Score</span>
                  <span className="font-semibold">{data.audits.avgScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Activities (7 days)
                  </span>
                  <span className="font-semibold">
                    {data.activity.last7Days}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function ReportsPageClient() {
  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Business intelligence dashboards and performance metrics.
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pipeline" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="conversion" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Conversion
          </TabsTrigger>
          <TabsTrigger value="attribution" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Attribution
          </TabsTrigger>
          <TabsTrigger value="growth" className="gap-1.5">
            <Sprout className="h-3.5 w-3.5" />
            Growth
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="scorecard" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Scorecard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="conversion">
          <ConversionTab />
        </TabsContent>
        <TabsContent value="attribution">
          <AttributionTab />
        </TabsContent>
        <TabsContent value="growth">
          <GrowthTab />
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueTab />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialTab />
        </TabsContent>
        <TabsContent value="scorecard">
          <ScorecardTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
