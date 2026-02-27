"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Clock,
  Loader2,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CellContract {
  id: string;
  contractName: string;
  weeklyHours: number;
  monthlyRevenue: number;
  healthStatus: string;
  teamLead: string | null;
  latestAuditScore: number;
}

interface PipelineDeal {
  id: string;
  name: string;
  stage: string;
  monthlyValue: number | null;
  weeklyHours: number | null;
}

interface CellData {
  cellType: string;
  label: string;
  hoursRange: string;
  totalContracts: number;
  totalHours: number;
  totalMonthlyRevenue: number;
  contracts: CellContract[];
  pipeline: PipelineDeal[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function cellHeaderBg(cellType: string): string {
  switch (cellType) {
    case "A":
      return "bg-blue-50 border-blue-200";
    case "B":
      return "bg-amber-50 border-amber-200";
    case "C":
      return "bg-purple-50 border-purple-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

function cellHeaderText(cellType: string): string {
  switch (cellType) {
    case "A":
      return "text-blue-800";
    case "B":
      return "text-amber-800";
    case "C":
      return "text-purple-800";
    default:
      return "text-gray-800";
  }
}

function auditScoreColor(score: number): string {
  if (score >= 85) return "text-green-700 bg-green-100";
  if (score >= 70) return "text-amber-700 bg-amber-100";
  return "text-red-700 bg-red-100";
}

function stageLabel(stage: string): string {
  return stage
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CellDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [cells, setCells] = useState<CellData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCells = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contracts/cells");
      if (!res.ok) throw new Error("Failed to fetch cells");
      const json = await res.json();
      setCells(json.data.cells);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load cell dashboard.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCells();
  }, [fetchCells]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-2xl font-bold tracking-tight">
              Cell Type Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of contracts by cell type with pipeline preview.
            </p>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {cells.map((cell) => (
          <div key={cell.cellType} className="space-y-4">
            {/* Cell header card */}
            <Card className={`border-2 ${cellHeaderBg(cell.cellType)}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-sm font-bold px-3 py-1 ${cellTypeBadgeClass(cell.cellType)}`}
                    >
                      Cell {cell.cellType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {cell.hoursRange}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Briefcase className={`h-3.5 w-3.5 ${cellHeaderText(cell.cellType)}`} />
                    </div>
                    <p className={`text-lg font-bold ${cellHeaderText(cell.cellType)}`}>
                      {cell.totalContracts}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Contracts
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <Clock className={`h-3.5 w-3.5 ${cellHeaderText(cell.cellType)}`} />
                    </div>
                    <p className={`text-lg font-bold ${cellHeaderText(cell.cellType)}`}>
                      {Number(cell.totalHours).toFixed(0)}h
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Total Hours
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <PoundSterling className={`h-3.5 w-3.5 ${cellHeaderText(cell.cellType)}`} />
                    </div>
                    <p className={`text-lg font-bold ${cellHeaderText(cell.cellType)}`}>
                      {formatCurrency(Number(cell.totalMonthlyRevenue))}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Monthly Rev
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract cards */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-3">
                {cell.contracts.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic text-center py-6">
                    No contracts in this cell.
                  </div>
                ) : (
                  cell.contracts.map((contract) => (
                    <Link
                      key={contract.id}
                      href={`/contracts/${contract.id}`}
                      className="block"
                    >
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-1.5">
                            <p className="text-sm font-medium truncate pr-2">
                              {contract.contractName}
                            </p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`h-3 w-3 rounded-full shrink-0 mt-0.5 ${healthDotClass(contract.healthStatus)}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {healthLabel(contract.healthStatus)}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3">
                              <span>{Number(contract.weeklyHours).toFixed(1)}h/wk</span>
                              <span className="font-medium text-foreground">
                                {formatCurrencyFull(Number(contract.monthlyRevenue))}/mo
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${auditScoreColor(Number(contract.latestAuditScore))}`}
                            >
                              {Number(contract.latestAuditScore).toFixed(0)}%
                            </span>
                          </div>
                          {contract.teamLead && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground">
                                {contract.teamLead}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Pipeline Preview */}
            {cell.pipeline.length > 0 && (
              <Card className="border-dashed">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Pipeline Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-2">
                    {cell.pipeline.map((deal) => (
                      <div
                        key={deal.id}
                        className="flex items-center justify-between text-xs py-1 border-b last:border-0"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-medium truncate">{deal.name}</p>
                          <p className="text-muted-foreground">
                            {stageLabel(deal.stage)}
                          </p>
                        </div>
                        <span className="font-medium text-foreground shrink-0">
                          {deal.monthlyValue
                            ? formatCurrencyFull(Number(deal.monthlyValue))
                            : "--"}
                          /mo
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* If no cells returned */}
        {cells.length === 0 && (
          <div className="col-span-3 flex items-center justify-center h-64 text-muted-foreground">
            No cell data available.
          </div>
        )}
      </div>
    </div>
  );
}
