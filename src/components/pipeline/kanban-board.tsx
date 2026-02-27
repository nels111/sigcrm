"use client";

import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { DealCard, type PipelineDeal } from "@/components/pipeline/deal-card";
import { LossReasonDialog } from "@/components/pipeline/loss-reason-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

// Display labels for each stage
const STAGE_LABELS: Record<string, string> = {
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

// Subtle header colors for each stage
const STAGE_COLORS: Record<string, string> = {
  NewLead: "bg-slate-100 border-slate-300",
  Contacted: "bg-sky-50 border-sky-200",
  SiteSurveyBooked: "bg-indigo-50 border-indigo-200",
  SurveyComplete: "bg-violet-50 border-violet-200",
  QuoteSent: "bg-amber-50 border-amber-200",
  Negotiation: "bg-orange-50 border-orange-200",
  ClosedWonRecurring: "bg-emerald-50 border-emerald-300",
  ClosedWonOneOff: "bg-green-50 border-green-200",
  ClosedLostRecurring: "bg-red-50 border-red-200",
  ClosedLostOneOff: "bg-red-50 border-red-200",
};

// Dot accent colors for stage headers
const STAGE_DOT_COLORS: Record<string, string> = {
  NewLead: "bg-slate-400",
  Contacted: "bg-sky-400",
  SiteSurveyBooked: "bg-indigo-400",
  SurveyComplete: "bg-violet-400",
  QuoteSent: "bg-amber-400",
  Negotiation: "bg-orange-400",
  ClosedWonRecurring: "bg-emerald-500",
  ClosedWonOneOff: "bg-green-500",
  ClosedLostRecurring: "bg-red-400",
  ClosedLostOneOff: "bg-red-400",
};

const LOST_STAGES = new Set(["ClosedLostRecurring", "ClosedLostOneOff"]);
const WON_STAGES = new Set(["ClosedWonRecurring", "ClosedWonOneOff"]);

// Main visible stages (always shown)
const MAIN_STAGES = [
  "NewLead",
  "Contacted",
  "SiteSurveyBooked",
  "SurveyComplete",
  "QuoteSent",
  "Negotiation",
  "ClosedWonRecurring",
  "ClosedWonOneOff",
];

// Hidden stages (toggled)
const HIDDEN_STAGES = ["ClosedLostRecurring", "ClosedLostOneOff"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function sumMonthlyValue(deals: PipelineDeal[]): number {
  return deals.reduce((sum, d) => {
    const v = d.monthlyValue
      ? typeof d.monthlyValue === "string"
        ? parseFloat(d.monthlyValue)
        : d.monthlyValue
      : 0;
    return sum + v;
  }, 0);
}

interface KanbanBoardProps {
  initialPipeline: Record<string, PipelineDeal[]>;
}

interface PendingLossMove {
  dealId: string;
  dealName: string;
  sourceStage: string;
  destinationStage: string;
  sourceIndex: number;
  destinationIndex: number;
}

export function KanbanBoard({ initialPipeline }: KanbanBoardProps) {
  const [pipeline, setPipeline] =
    useState<Record<string, PipelineDeal[]>>(initialPipeline);
  const [pendingLoss, setPendingLoss] = useState<PendingLossMove | null>(null);
  const [showLostColumns, setShowLostColumns] = useState(false);
  const { toast } = useToast();

  const visibleStages = showLostColumns
    ? [...MAIN_STAGES, ...HIDDEN_STAGES]
    : MAIN_STAGES;

  const lostCount = HIDDEN_STAGES.reduce(
    (sum, stage) => sum + (pipeline[stage]?.length || 0),
    0
  );

  const moveCard = useCallback(
    (
      sourceStage: string,
      destStage: string,
      sourceIndex: number,
      destIndex: number
    ) => {
      setPipeline((prev) => {
        const next = { ...prev };
        const sourceList = [...(next[sourceStage] || [])];
        const destList =
          sourceStage === destStage
            ? sourceList
            : [...(next[destStage] || [])];

        const [moved] = sourceList.splice(sourceIndex, 1);
        if (!moved) return prev;

        moved.stage = destStage;
        destList.splice(destIndex, 0, moved);

        next[sourceStage] = sourceList;
        if (sourceStage !== destStage) {
          next[destStage] = destList;
        }

        return next;
      });
    },
    []
  );

  const revertMove = useCallback(
    (
      sourceStage: string,
      destStage: string,
      sourceIndex: number,
      destIndex: number
    ) => {
      moveCard(destStage, sourceStage, destIndex, sourceIndex);
    },
    [moveCard]
  );

  async function updateStageOnServer(
    dealId: string,
    newStage: string,
    lossReason?: string,
    lossNotes?: string
  ) {
    const body: Record<string, string> = { stage: newStage };
    if (lossReason) body.lossReason = lossReason;
    if (lossNotes) body.lossNotes = lossNotes;

    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error("Failed to update stage");
    }

    return res.json();
  }

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;

    // Dropped outside
    if (!destination) return;

    // Same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceStage = source.droppableId;
    const destStage = destination.droppableId;

    // Optimistically move the card
    moveCard(sourceStage, destStage, source.index, destination.index);

    // Check if dropping to a Lost stage
    if (LOST_STAGES.has(destStage)) {
      const deal = pipeline[sourceStage]?.[source.index];
      setPendingLoss({
        dealId: draggableId,
        dealName: deal?.account?.name ?? deal?.name ?? "this deal",
        sourceStage,
        destinationStage: destStage,
        sourceIndex: source.index,
        destinationIndex: destination.index,
      });
      return;
    }

    // Proceed with server update
    try {
      await updateStageOnServer(draggableId, destStage);

      // Check for Won stages
      if (WON_STAGES.has(destStage)) {
        toast({
          title: "Deal Won!",
          description:
            destStage === "ClosedWonRecurring"
              ? "Congratulations! Mobilisation workflow will be triggered."
              : "Congratulations! One-off deal closed successfully.",
        });
      }

      // Update daysInStage to 0 for the moved card
      if (sourceStage !== destStage) {
        setPipeline((prev) => {
          const next = { ...prev };
          const stageDeals = [...(next[destStage] || [])];
          const dealIndex = stageDeals.findIndex((d) => d.id === draggableId);
          if (dealIndex !== -1) {
            stageDeals[dealIndex] = {
              ...stageDeals[dealIndex],
              daysInStage: 0,
              stage: destStage,
            };
            next[destStage] = stageDeals;
          }
          return next;
        });
      }
    } catch {
      // Revert on error
      revertMove(sourceStage, destStage, source.index, destination.index);
      toast({
        title: "Error",
        description: "Failed to update deal stage. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function handleLossConfirm(lossReason: string, lossNotes: string) {
    if (!pendingLoss) return;

    try {
      await updateStageOnServer(
        pendingLoss.dealId,
        pendingLoss.destinationStage,
        lossReason,
        lossNotes
      );

      toast({
        title: "Deal Marked as Lost",
        description: `Loss reason: ${lossReason}`,
      });
    } catch {
      // Revert the optimistic move
      revertMove(
        pendingLoss.sourceStage,
        pendingLoss.destinationStage,
        pendingLoss.sourceIndex,
        pendingLoss.destinationIndex
      );
      toast({
        title: "Error",
        description: "Failed to update deal stage. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingLoss(null);
    }
  }

  function handleLossCancel() {
    if (!pendingLoss) return;

    // Revert the optimistic move
    revertMove(
      pendingLoss.sourceStage,
      pendingLoss.destinationStage,
      pendingLoss.sourceIndex,
      pendingLoss.destinationIndex
    );
    setPendingLoss(null);
  }

  return (
    <>
      {/* Toggle for Lost columns */}
      <div className="flex items-center justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLostColumns((prev) => !prev)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showLostColumns ? (
            <EyeOff className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <Eye className="h-3.5 w-3.5 mr-1.5" />
          )}
          {showLostColumns
            ? "Hide Lost columns"
            : `Show Lost columns (${lostCount})`}
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: "fit-content" }}>
            {visibleStages.map((stage) => {
              const deals = pipeline[stage] || [];
              const totalValue = sumMonthlyValue(deals);
              const isLostStage = LOST_STAGES.has(stage);

              return (
                <div
                  key={stage}
                  className={cn(
                    "flex flex-col shrink-0",
                    isLostStage ? "w-[240px]" : "w-[280px]"
                  )}
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      "rounded-t-lg border-b-2 px-3 py-2.5",
                      STAGE_COLORS[stage] || "bg-gray-50 border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          STAGE_DOT_COLORS[stage] || "bg-gray-400"
                        )}
                      />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                        {STAGE_LABELS[stage] || stage}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {deals.length} deal{deals.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {formatCurrency(totalValue)}/mo
                      </span>
                    </div>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={stage}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 min-h-[200px] space-y-2 rounded-b-lg border border-t-0 p-2 transition-colors",
                          snapshot.isDraggingOver && isLostStage
                            ? "bg-red-50/50 border-red-200"
                            : snapshot.isDraggingOver
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-gray-50/50 border-gray-200"
                        )}
                      >
                        {deals.map((deal, index) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            index={index}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DragDropContext>

      {/* Loss Reason Dialog */}
      <LossReasonDialog
        open={pendingLoss !== null}
        dealName={pendingLoss?.dealName ?? ""}
        onConfirm={handleLossConfirm}
        onCancel={handleLossCancel}
      />
    </>
  );
}
