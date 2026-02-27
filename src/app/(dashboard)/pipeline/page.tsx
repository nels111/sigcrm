import { Kanban, ArrowRight } from "lucide-react";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { ForecastPanel } from "@/components/pipeline/forecast-panel";
import { Card, CardContent } from "@/components/ui/card";
import type { PipelineDeal } from "@/components/pipeline/deal-card";

interface PipelineApiResponse {
  data: {
    pipeline: Record<string, PipelineDeal[]>;
    stages: string[];
    summary: Array<{
      stage: string;
      count: number;
      totalAmount: number;
      totalMonthlyValue: number;
    }>;
    totalDeals: number;
  };
}

async function getPipelineData(): Promise<PipelineApiResponse["data"]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/deals/pipeline`, {
    cache: "no-store",
  });

  if (!res.ok) {
    // Return empty data on error
    return {
      pipeline: {},
      stages: [],
      summary: [],
      totalDeals: 0,
    };
  }

  const json: PipelineApiResponse = await res.json();
  return json.data;
}

function calculateConversionRates(summary: PipelineApiResponse["data"]["summary"]) {
  const countByStage: Record<string, number> = {};
  for (const s of summary) {
    countByStage[s.stage] = s.count;
  }

  // Leads = NewLead + Contacted
  const leads =
    (countByStage["NewLead"] || 0) + (countByStage["Contacted"] || 0);
  // Meetings = SiteSurveyBooked + SurveyComplete
  const meetings =
    (countByStage["SiteSurveyBooked"] || 0) +
    (countByStage["SurveyComplete"] || 0);
  // Quotes = QuoteSent + Negotiation
  const quotes =
    (countByStage["QuoteSent"] || 0) + (countByStage["Negotiation"] || 0);
  // Wins = ClosedWonRecurring + ClosedWonOneOff
  const wins =
    (countByStage["ClosedWonRecurring"] || 0) +
    (countByStage["ClosedWonOneOff"] || 0);

  const totalInputForMeetings = leads + meetings + quotes + wins;
  const totalInputForQuotes = meetings + quotes + wins;
  const totalInputForWins = quotes + wins;

  const leadsToMeetings =
    totalInputForMeetings > 0
      ? Math.round((meetings / totalInputForMeetings) * 100)
      : 0;
  const meetingsToQuotes =
    totalInputForQuotes > 0
      ? Math.round((quotes / totalInputForQuotes) * 100)
      : 0;
  const quotesToWins =
    totalInputForWins > 0
      ? Math.round((wins / totalInputForWins) * 100)
      : 0;

  return { leadsToMeetings, meetingsToQuotes, quotesToWins };
}

function calculateAverageCycleDays(
  pipeline: Record<string, PipelineDeal[]>
): number {
  // Calculate average daysInStage across all won deals
  const wonDeals = [
    ...(pipeline["ClosedWonRecurring"] || []),
    ...(pipeline["ClosedWonOneOff"] || []),
  ];

  if (wonDeals.length === 0) {
    // Fall back to average across all active deals
    const allDeals = Object.values(pipeline).flat();
    if (allDeals.length === 0) return 0;
    const total = allDeals.reduce((sum, d) => sum + d.daysInStage, 0);
    return Math.round(total / allDeals.length);
  }

  const total = wonDeals.reduce((sum, d) => sum + d.daysInStage, 0);
  return Math.round(total / wonDeals.length);
}

export default async function PipelinePage() {
  const data = await getPipelineData();
  const { pipeline, summary } = data;

  const rates = calculateConversionRates(summary);
  const avgCycle = calculateAverageCycleDays(pipeline);

  // Collect all deals for the forecast panel
  const allDeals: PipelineDeal[] = Object.values(pipeline).flat();

  const stats = [
    {
      label: "Leads \u2192 Meetings",
      value: `${rates.leadsToMeetings}%`,
    },
    {
      label: "Meetings \u2192 Quotes",
      value: `${rates.meetingsToQuotes}%`,
    },
    {
      label: "Quotes \u2192 Wins",
      value: `${rates.quotesToWins}%`,
    },
    {
      label: "Average Cycle",
      value: `${avgCycle} days`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
          <Kanban className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Drag and drop deals between stages to update their progress.
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <Card className="border-dashed">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
                {i < stats.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <KanbanBoard initialPipeline={pipeline} />

      {/* Forecast Panel */}
      <ForecastPanel deals={allDeals} />
    </div>
  );
}
