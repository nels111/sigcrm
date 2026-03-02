"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "note", label: "Note" },
  { value: "whatsapp", label: "WhatsApp" },
];

interface ActivityLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  dealId?: string;
  leadId?: string;
  accountId?: string;
  contractId?: string;
  contactId?: string;
  defaultType?: string;
}

export function ActivityLogDialog({
  open,
  onOpenChange,
  onSuccess,
  dealId,
  leadId,
  accountId,
  contractId,
  contactId,
  defaultType = "call",
}: ActivityLogDialogProps) {
  const { toast } = useToast();

  const [activityType, setActivityType] = useState(defaultType);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setActivityType(defaultType);
      setSubject("");
      setBody("");
      setDuration("");
      setOutcome("");
    }
  }, [open, defaultType]);

  async function handleSubmit() {
    if (!subject.trim()) {
      toast({ title: "Subject required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (duration) metadata.duration = parseInt(duration);
      if (outcome) metadata.outcome = outcome;

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType,
          subject: subject.trim(),
          body: body.trim() || undefined,
          dealId: dealId || undefined,
          leadId: leadId || undefined,
          accountId: accountId || undefined,
          contractId: contractId || undefined,
          contactId: contactId || undefined,
          metadata,
        }),
      });

      if (!res.ok) throw new Error("Failed to log activity");

      toast({ title: "Activity logged" });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const isCall = activityType === "call";
  const typeLabel = ACTIVITY_TYPES.find((t) => t.value === activityType)?.label || "Activity";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Log {typeLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="activity-subject">Subject *</Label>
            <Input
              id="activity-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={isCall ? "Call with..." : "Subject..."}
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="activity-notes">Notes</Label>
            <Textarea
              id="activity-notes"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter details..."
              className="mt-1"
              rows={4}
            />
          </div>

          {isCall && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="activity-duration">Duration (min)</Label>
                <Input
                  id="activity-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 15"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !subject.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Log {typeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
