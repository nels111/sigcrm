"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, Calendar } from "lucide-react";
import type { PipelineDeal } from "@/components/pipeline/deal-card";

// Stage probability weights for forecast calculation
const STAGE_PROBABILITY: Record<string, number> = {
  NewLead: 0.05,
  Contacted: 0.10,
  SiteSurveyBooked: 0.20,
  SurveyComplete: 0.30,
  QuoteSent: 0.40,
  Negotiation: 0.60,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface ForecastPanelProps {
  deals: PipelineDeal[];
}

function computeForecast(deals: PipelineDeal[], daysWindow: number) {
  // Only include open pipeline stages (not Won or Lost)
  const openStages = new Set([
    "NewLead",
    "Contacted",
    "SiteSurveyBooked",
    "SurveyComplete",
    "QuoteSent",
    "Negotiation",
  ]);

  // For the window-based forecasting, include deals based on reasonable close timelines
  const windowDeals = deals.filter((d) => openStages.has(d.stage));

  // Apply a time-decay: deals closer to closing (later stages) are more likely within window
  const stageCloseEstimate: Record<string, number> = {
    NewLead: 90,
    Contacted: 75,
    SiteSurveyBooked: 60,
    SurveyComplete: 45,
    QuoteSent: 30,
    Negotiation: 14,
  };

  const filtered = windowDeals.filter((d) => {
    const estimatedDays = (stageCloseEstimate[d.stage] ?? 90) - d.daysInStage;
    return estimatedDays <= daysWindow;
  });

  const count = filtered.length;
  let totalValue = 0;
  let weightedValue = 0;

  for (const deal of filtered) {
    const mv = deal.monthlyValue
      ? typeof deal.monthlyValue === "string"
        ? parseFloat(deal.monthlyValue)
        : deal.monthlyValue
      : 0;
    const probability = STAGE_PROBABILITY[deal.stage] ?? 0;
    totalValue += mv;
    weightedValue += mv * probability;
  }

  return { count, totalValue, weightedValue };
}

export function ForecastPanel({ deals }: ForecastPanelProps) {
  const forecast30 = computeForecast(deals, 30);
  const forecast60 = computeForecast(deals, 60);
  const forecast90 = computeForecast(deals, 90);

  const forecasts = [
    { label: "30 Days", ...forecast30, bg: "bg-blue-50/80 border-blue-100" },
    { label: "60 Days", ...forecast60, bg: "bg-amber-50/80 border-amber-100" },
    { label: "90 Days", ...forecast90, bg: "bg-emerald-50/80 border-emerald-100" },
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Pipeline Forecast</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecasts.map((f) => (
          <Card key={f.label} className={f.bg}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {f.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Deals</span>
                <span className="text-lg font-bold">{f.count}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Total Value</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(f.totalValue)}/mo
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-xs text-muted-foreground">Weighted Value</span>
                <span className="text-sm font-bold text-emerald-600">
                  {formatCurrency(f.weightedValue)}/mo
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
