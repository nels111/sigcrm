"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  PoundSterling,
  Send,
  User,
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteDetail {
  id: string;
  quoteRef: string;
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  hoursPerDay: string;
  frequencyPerWeek: number;
  daysSelected: string[];
  siteType: string;
  marginPercent: string;
  productCostWeekly: string;
  overheadCostWeekly: string;
  applyPilotPricing: boolean;
  // Calculated
  hourlyRate: string;
  weeklyLabourCost: string;
  totalWeeklySpend: string;
  weeklyCharge: string;
  monthlyTotal: string;
  annualTotal: string;
  weeklyProfit: string;
  monthlyProfit: string;
  // Pilot
  pilotMonthlyTotal: string | null;
  pilotSavings: string | null;
  pilotStartDate: string | null;
  pilotEndDate: string | null;
  pilotReviewDate: string | null;
  standardPricingStartDate: string | null;
  // Scope
  scopeOfWorks: string;
  // Document
  pdfPath: string | null;
  pdfUrl: string | null;
  // Status
  status: string;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  // Follow-up
  followUpCount: number;
  lastFollowUpAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  deal: { id: string; name: string; stage: string } | null;
  lead: { id: string; companyName: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITE_TYPE_LABELS: Record<string, string> = {
  OfficeCommercial: "Office/Commercial",
  WelfareConstruction: "Welfare/Construction",
  HospitalityVenue: "Hospitality/Venue",
  EducationInstitutional: "Education/Institutional",
  SpecialistIndustrial: "Specialist/Industrial",
  DentalMedical: "Dental/Medical",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-gray-100 text-gray-700 border-gray-200";
    case "sent":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    case "expired":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function formatCurrency(value: string | number | null): string {
  if (value == null) return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "--";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatCurrencyRound(value: string | number | null): string {
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

function formatDateShort(iso: string | null): string {
  if (!iso) return "--";
  return format(new Date(iso), "dd MMM yyyy");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/quotes");
          return;
        }
        throw new Error("Failed to fetch quote");
      }
      const json = await res.json();
      setQuote(json.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load quote.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [quoteId, router, toast]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  async function handleAction(action: string) {
    const actionMap: Record<string, Record<string, unknown>> = {
      mark_accepted: { status: "accepted" },
      mark_rejected: { status: "rejected" },
    };

    const payload = actionMap[action];
    if (!payload) return;

    setActionLoading(action);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${action.replace("_", " ")}`);
      }
      toast({
        title: "Success",
        description: `Quote ${action.replace("_", " ")} successfully.`,
      });
      fetchQuote();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : `Action failed.`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendQuote() {
    setActionLoading("send");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to send quote");
      }
      toast({
        title: "Quote Sent",
        description: `Quote sent to ${quote?.contactName} at ${quote?.contactEmail}`,
      });
      fetchQuote();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to send quote.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Quote not found.</p>
        <Button variant="outline" onClick={() => router.push("/quotes")}>
          Back to Quotes
        </Button>
      </div>
    );
  }

  const impliedSellRate =
    parseFloat(quote.hoursPerDay) * quote.frequencyPerWeek > 0
      ? parseFloat(quote.weeklyCharge) /
        (parseFloat(quote.hoursPerDay) * quote.frequencyPerWeek)
      : 0;
  const grossMarginPercent =
    parseFloat(quote.weeklyCharge) > 0
      ? ((parseFloat(quote.weeklyCharge) - parseFloat(quote.totalWeeklySpend)) /
          parseFloat(quote.weeklyCharge)) *
        100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/quotes")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                {quote.quoteRef}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-medium capitalize ${statusBadgeClass(quote.status)}`}
              >
                {quote.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {quote.companyName} &middot; Created{" "}
              {formatDateShort(quote.createdAt)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(`/api/quotes/${quoteId}/pdf`, "_blank")}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
          {quote.status !== "accepted" && quote.status !== "rejected" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={actionLoading === "send"}
              onClick={() => handleSendQuote()}
            >
              {actionLoading === "send" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send to Prospect
            </Button>
          )}
          {quote.status !== "accepted" && (
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              disabled={actionLoading === "mark_accepted"}
              onClick={() => handleAction("mark_accepted")}
            >
              {actionLoading === "mark_accepted" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Mark Accepted
            </Button>
          )}
          {quote.status !== "rejected" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={actionLoading === "mark_rejected"}
              onClick={() => handleAction("mark_rejected")}
            >
              {actionLoading === "mark_rejected" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Mark Rejected
            </Button>
          )}
        </div>
      </div>

      {/* Linked Records */}
      {(quote.deal || quote.lead) && (
        <div className="flex flex-wrap gap-3">
          {quote.deal && (
            <Link href={`/deals/${quote.deal.id}`}>
              <Badge
                variant="outline"
                className="gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors py-1.5 px-3"
              >
                <FileText className="h-3 w-3" />
                Deal: {quote.deal.name}
              </Badge>
            </Link>
          )}
          {quote.lead && (
            <Link href={`/leads/${quote.lead.id}`}>
              <Badge
                variant="outline"
                className="gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors py-1.5 px-3"
              >
                <User className="h-3 w-3" />
                Lead: {quote.lead.companyName}
              </Badge>
            </Link>
          )}
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left panel (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company & Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                    Company
                  </p>
                  <p className="font-medium">{quote.companyName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                    Contact
                  </p>
                  <p className="font-medium">{quote.contactName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                    Email
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`mailto:${quote.contactEmail}`}
                      className="text-emerald-600 hover:underline"
                    >
                      {quote.contactEmail}
                    </a>
                  </div>
                </div>
                {quote.contactPhone && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                      Phone
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{quote.contactPhone}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                  Address
                </p>
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                  <p className="whitespace-pre-wrap">{quote.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PoundSterling className="h-4 w-4" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Client Totals highlight */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                    Monthly Total
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatCurrencyRound(quote.monthlyTotal)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                    Annual Total
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatCurrencyRound(quote.annualTotal)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">
                    Sell Rate/hr
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      impliedSellRate < 25
                        ? "text-red-600"
                        : impliedSellRate < 27
                        ? "text-amber-600"
                        : "text-blue-700"
                    }`}
                  >
                    {"\u00A3"}
                    {impliedSellRate.toFixed(2)}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-[10px] uppercase tracking-wide text-purple-700 font-medium">
                    Gross Margin
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      grossMarginPercent < 25
                        ? "text-red-600"
                        : "text-purple-700"
                    }`}
                  >
                    {grossMarginPercent.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Detailed breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Hourly Rate (labour)
                  </span>
                  <span className="font-medium">
                    {"\u00A3"}
                    {parseFloat(quote.hourlyRate).toFixed(2)}/hr
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Weekly Labour Cost
                  </span>
                  <span className="font-medium">
                    {formatCurrency(quote.weeklyLabourCost)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Product Cost (weekly)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(quote.productCostWeekly)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Overhead Cost (weekly)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(quote.overheadCostWeekly)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Total Weekly Spend
                  </span>
                  <span className="font-medium">
                    {formatCurrency(quote.totalWeeklySpend)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Weekly Charge
                  </span>
                  <span className="font-medium">
                    {formatCurrency(quote.weeklyCharge)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Weekly Profit
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatCurrency(quote.weeklyProfit)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">
                    Monthly Profit
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatCurrency(quote.monthlyProfit)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Margin %</span>
                  <span className="font-medium">
                    {parseFloat(quote.marginPercent).toFixed(2)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pilot Pricing */}
          {quote.applyPilotPricing && quote.pilotMonthlyTotal && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Pilot Pricing (30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-blue-100 border border-blue-200">
                    <p className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">
                      Pilot Monthly
                    </p>
                    <p className="text-lg font-bold text-blue-800">
                      {formatCurrencyRound(quote.pilotMonthlyTotal)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white border border-blue-200">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Standard Monthly
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrencyRound(quote.monthlyTotal)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-100 border border-blue-200">
                    <p className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">
                      Client Saves
                    </p>
                    <p className="text-lg font-bold text-blue-800">
                      {formatCurrencyRound(quote.pilotSavings)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Pilot Start
                    </p>
                    <p className="font-medium">
                      {formatDateShort(quote.pilotStartDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Pilot End
                    </p>
                    <p className="font-medium">
                      {formatDateShort(quote.pilotEndDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Review Date
                    </p>
                    <p className="font-medium">
                      {formatDateShort(quote.pilotReviewDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Standard Pricing Starts
                    </p>
                    <p className="font-medium">
                      {formatDateShort(quote.standardPricingStartDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scope of Works Preview */}
          {quote.scopeOfWorks && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Scope of Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                  {quote.scopeOfWorks}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Site Type</span>
                <span className="font-medium">
                  {SITE_TYPE_LABELS[quote.siteType] || quote.siteType}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours Per Day</span>
                <span className="font-medium">
                  {parseFloat(quote.hoursPerDay)}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Frequency Per Week
                </span>
                <span className="font-medium">
                  {quote.frequencyPerWeek} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Total Weekly Hours
                </span>
                <span className="font-medium">
                  {(
                    parseFloat(quote.hoursPerDay) * quote.frequencyPerWeek
                  ).toFixed(1)}
                  h
                </span>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1.5">Cleaning Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {quote.daysSelected.map((day) => (
                    <Badge key={day} variant="secondary" className="text-xs">
                      {day.slice(0, 3)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Status & Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-medium capitalize ${statusBadgeClass(quote.status)}`}
                >
                  {quote.status}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(quote.createdAt)}</span>
              </div>
              {quote.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span>{formatDateTime(quote.sentAt)}</span>
                </div>
              )}
              {quote.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accepted</span>
                  <span className="text-emerald-700 font-medium">
                    {formatDateTime(quote.acceptedAt)}
                  </span>
                </div>
              )}
              {quote.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rejected</span>
                  <span className="text-red-700 font-medium">
                    {formatDateTime(quote.rejectedAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{formatDateTime(quote.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                Follow-up History
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Follow-ups Sent
                  </span>
                  <span className="font-medium">{quote.followUpCount}</span>
                </div>
                {quote.lastFollowUpAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Last Follow-up
                    </span>
                    <span>{formatDateTime(quote.lastFollowUpAt)}</span>
                  </div>
                )}
                {quote.nextFollowUpAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Next Follow-up
                    </span>
                    <span className="font-medium text-amber-700">
                      {formatDateShort(quote.nextFollowUpAt)}
                    </span>
                  </div>
                )}
                {quote.followUpCount === 0 && !quote.nextFollowUpAt && (
                  <p className="text-muted-foreground italic py-2 text-center">
                    No follow-ups sent yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Linked Records */}
          {(quote.deal || quote.lead) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Linked Records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quote.deal && (
                  <Link
                    href={`/deals/${quote.deal.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Deal</p>
                      <p className="text-sm font-medium">{quote.deal.name}</p>
                    </div>
                    <Badge variant="secondary" className="text-[11px] capitalize">
                      {quote.deal.stage
                        .replace(/([A-Z])/g, " $1")
                        .trim()}
                    </Badge>
                  </Link>
                )}
                {quote.lead && (
                  <Link
                    href={`/leads/${quote.lead.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Lead</p>
                      <p className="text-sm font-medium">
                        {quote.lead.companyName}
                      </p>
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
