"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const LOSS_REASONS = [
  { value: "Price", label: "Price" },
  { value: "Quality", label: "Quality" },
  { value: "ChangeOfProvider", label: "Change of Provider" },
  { value: "BusinessClosed", label: "Business Closed" },
  { value: "BudgetCuts", label: "Budget Cuts" },
  { value: "NoResponse", label: "No Response" },
  { value: "Competitor", label: "Competitor" },
  { value: "Other", label: "Other" },
] as const;

interface LossReasonDialogProps {
  open: boolean;
  dealName: string;
  onConfirm: (lossReason: string, lossNotes: string) => void;
  onCancel: () => void;
}

export function LossReasonDialog({
  open,
  dealName,
  onConfirm,
  onCancel,
}: LossReasonDialogProps) {
  const [lossReason, setLossReason] = useState("");
  const [lossNotes, setLossNotes] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    if (!lossReason) {
      setError("Please select a loss reason");
      return;
    }
    onConfirm(lossReason, lossNotes);
    setLossReason("");
    setLossNotes("");
    setError("");
  }

  function handleCancel() {
    setLossReason("");
    setLossNotes("");
    setError("");
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Deal as Lost</DialogTitle>
          <DialogDescription>
            Record why <span className="font-medium">{dealName}</span> was lost.
            This helps improve future conversion rates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="loss-reason">
              Loss Reason <span className="text-red-500">*</span>
            </Label>
            <Select value={lossReason} onValueChange={setLossReason}>
              <SelectTrigger id="loss-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="loss-notes">Notes (optional)</Label>
            <Textarea
              id="loss-notes"
              placeholder="Any additional context about the loss..."
              value={lossNotes}
              onChange={(e) => setLossNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
          >
            Confirm Loss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
