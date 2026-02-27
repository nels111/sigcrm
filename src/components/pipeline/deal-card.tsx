"use client";

import { useRouter } from "next/navigation";
import { Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

export interface PipelineDeal {
  id: string;
  name: string;
  amount: number | string | null;
  monthlyValue: number | string | null;
  weeklyHours: number | string | null;
  cellType: "A" | "B" | "C" | null;
  stage: string;
  stageChangedAt: string;
  daysInStage: number;
  assignee: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  lastActivityDate: string | null;
}

function formatCurrency(value: number | string | null): string {
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function daysSinceActivity(lastActivityDate: string | null): number | null {
  if (!lastActivityDate) return null;
  const now = new Date();
  const last = new Date(lastActivityDate);
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

const CELL_TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700 border-blue-200",
  B: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-purple-100 text-purple-700 border-purple-200",
};

interface DealCardProps {
  deal: PipelineDeal;
  index: number;
}

export function DealCard({ deal, index }: DealCardProps) {
  const router = useRouter();

  const daysSince = daysSinceActivity(deal.lastActivityDate);
  const isStale = daysSince !== null && daysSince >= 14;

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/deals/${deal.id}`)}
          className={cn(
            "rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md cursor-pointer",
            isStale && "border-l-4 border-l-red-500",
            snapshot.isDragging && "shadow-lg ring-2 ring-emerald-400/50 rotate-[2deg]"
          )}
        >
          {/* Company name */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-foreground leading-tight truncate">
              {deal.account?.name ?? deal.name}
            </p>
            {isStale && (
              <Badge
                variant="destructive"
                className="shrink-0 text-[10px] px-1.5 py-0"
              >
                STALE
              </Badge>
            )}
          </div>

          {/* Monthly value — fall back to amount if monthlyValue is null */}
          <p className="mt-1.5 text-sm font-semibold text-emerald-600">
            {deal.monthlyValue != null
              ? `${formatCurrency(deal.monthlyValue)}/mo`
              : deal.amount != null
              ? formatCurrency(deal.amount)
              : "--"}
          </p>

          {/* Meta row: days in stage + cell type */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{deal.daysInStage}d in stage</span>
            </div>
            {deal.cellType && deal.weeklyHours && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  CELL_TYPE_COLORS[deal.cellType]
                )}
              >
                Cell {deal.cellType}
              </Badge>
            )}
            {isStale && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <AlertTriangle className="h-3 w-3" />
                <span>{daysSince}d no activity</span>
              </div>
            )}
          </div>

          {/* Assignee */}
          {deal.assignee && (
            <div className="mt-2 flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px] bg-slate-200 text-slate-600">
                  {getInitials(deal.assignee.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {deal.assignee.name}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
