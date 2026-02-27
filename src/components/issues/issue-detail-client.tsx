"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Shield,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IssueDetail {
  id: string;
  contractId: string;
  title: string;
  description: string;
  severity: string;
  category: string | null;
  status: string;
  slaBreached: boolean;
  reportedAt: string;
  reportedBy: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaResponseTarget: string | null;
  slaResolutionTarget: string | null;
  resolution: string | null;
  rootCause: string | null;
  assignedTo: string | null;
  contract: {
    id: string;
    contractName: string;
    status?: string;
    account?: { id: string; name: string } | null;
  };
  account: { id: string; name: string } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  activities: Array<{
    id: string;
    activityType: string;
    subject: string | null;
    body: string | null;
    createdAt: string;
    performer: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", styles[severity] ?? "")}
    >
      {severity}
    </Badge>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 border-blue-200",
    in_progress: "bg-amber-100 text-amber-800 border-amber-200",
    resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    closed: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", styles[status] ?? "")}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}

function slaTimeRemaining(target: string | null, completedAt: string | null) {
  if (!target) return { text: "No target set", breached: false };
  const targetDate = new Date(target);

  if (completedAt) {
    const completed = new Date(completedAt);
    if (completed <= targetDate) {
      return { text: "Completed on time", breached: false };
    }
    return { text: "Completed late", breached: true };
  }

  if (isPast(targetDate)) {
    return {
      text: `Breached ${formatDistanceToNow(targetDate, { addSuffix: true })}`,
      breached: true,
    };
  }

  return {
    text: `${formatDistanceToNow(targetDate)} remaining`,
    breached: false,
  };
}

const ROOT_CAUSE_OPTIONS = [
  { value: "training_gap", label: "Training Gap" },
  { value: "equipment_failure", label: "Equipment Failure" },
  { value: "process_flaw", label: "Process Flaw" },
  { value: "performance_issue", label: "Performance Issue" },
  { value: "other", label: "Other" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveText, setResolveText] = useState("");
  const [resolveRootCause, setResolveRootCause] = useState("");

  const fetchIssue = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}`);
      if (!res.ok) throw new Error("Issue not found");
      const json = await res.json();
      setIssue(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issue");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  async function performAction(action: string, extraData?: Record<string, unknown>) {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { ...extraData };

      if (action === "respond") {
        body.firstResponseAt = new Date().toISOString();
        body.status = "in_progress";
      } else if (action === "resolve") {
        body.resolvedAt = new Date().toISOString();
        body.status = "resolved";
      } else if (action === "close") {
        body.status = "closed";
      }

      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${action}`);
      }

      toast({
        title: "Success",
        description: `Issue ${action === "respond" ? "responded to" : action === "resolve" ? "resolved" : "closed"} successfully.`,
      });

      fetchIssue();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Action failed.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve() {
    if (!resolveText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a resolution description.",
        variant: "destructive",
      });
      return;
    }

    await performAction("resolve", {
      resolution: resolveText.trim(),
      rootCause: resolveRootCause || null,
    });
    setResolveOpen(false);
    setResolveText("");
    setResolveRootCause("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading issue...
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "Issue not found"}</p>
        <Button variant="outline" onClick={() => router.push("/issues")}>
          Back to Issues
        </Button>
      </div>
    );
  }

  const slaResponse = slaTimeRemaining(
    issue.slaResponseTarget,
    issue.firstResponseAt
  );
  const slaResolution = slaTimeRemaining(
    issue.slaResolutionTarget,
    issue.resolvedAt
  );

  const isOpen = issue.status === "open";
  const isInProgress = issue.status === "in_progress";
  const isResolved = issue.status === "resolved";
  const isClosed = issue.status === "closed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/issues")}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {issue.title}
            </h1>
            {severityBadge(issue.severity)}
            {statusBadge(issue.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {issue.contract.contractName}
            {issue.account && ` - ${issue.account.name}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* SLA Card */}
          <Card
            className={cn(
              issue.slaBreached && "border-red-200 bg-red-50/30"
            )}
          >
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                SLA Status
                {issue.slaBreached && (
                  <Badge variant="destructive" className="text-[11px]">
                    BREACHED
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Response SLA */}
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">
                    Response Target
                  </p>
                  <p className="text-sm font-medium mt-1">
                    {issue.slaResponseTarget
                      ? format(
                          new Date(issue.slaResponseTarget),
                          "dd MMM yyyy HH:mm"
                        )
                      : "--"}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      slaResponse.breached
                        ? "text-red-600 font-medium"
                        : "text-emerald-600"
                    )}
                  >
                    {slaResponse.text}
                  </p>
                </div>

                {/* Resolution SLA */}
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">
                    Resolution Target
                  </p>
                  <p className="text-sm font-medium mt-1">
                    {issue.slaResolutionTarget
                      ? format(
                          new Date(issue.slaResolutionTarget),
                          "dd MMM yyyy HH:mm"
                        )
                      : "--"}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      slaResolution.breached
                        ? "text-red-600 font-medium"
                        : "text-emerald-600"
                    )}
                  >
                    {slaResolution.text}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {issue.description}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium capitalize">
                      {issue.category?.replace("_", " ") ?? "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reported By</p>
                    <p className="font-medium">{issue.reportedBy ?? "--"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reported At</p>
                    <p className="font-medium">
                      {format(
                        new Date(issue.reportedAt),
                        "dd MMM yyyy HH:mm"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned To</p>
                    <p className="font-medium">
                      {issue.assignee?.name ?? "Unassigned"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resolution Card (when resolved/closed) */}
          {(isResolved || isClosed) && issue.resolution && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Resolution</p>
                    <p className="text-sm mt-1 whitespace-pre-wrap">
                      {issue.resolution}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Root Cause</p>
                      <p className="font-medium capitalize">
                        {issue.rootCause?.replace("_", " ") ?? "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resolved At</p>
                      <p className="font-medium">
                        {issue.resolvedAt
                          ? format(
                              new Date(issue.resolvedAt),
                              "dd MMM yyyy HH:mm"
                            )
                          : "--"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!issue.activities || issue.activities.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {issue.activities.map((activity, i) => (
                    <div key={activity.id} className="relative flex gap-3">
                      {i < issue.activities.length - 1 && (
                        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                      )}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground z-10">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {activity.subject ||
                              activity.activityType.replace(/_/g, " ")}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(activity.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {activity.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {activity.body}
                          </p>
                        )}
                        {activity.performer && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            by {activity.performer.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isOpen && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => performAction("respond")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
                  Respond
                </Button>
              )}

              {(isOpen || isInProgress) && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => setResolveOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                  Resolve
                </Button>
              )}

              {isResolved && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => performAction("close")}
                >
                  <XCircle className="h-4 w-4 mr-2 text-gray-600" />
                  Close
                </Button>
              )}

              {isClosed && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  This issue has been closed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Contract</p>
                <p className="font-medium">{issue.contract.contractName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Severity</p>
                <div className="mt-1">{severityBadge(issue.severity)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">{statusBadge(issue.status)}</div>
              </div>
              {issue.firstResponseAt && (
                <div>
                  <p className="text-muted-foreground">First Response</p>
                  <p className="font-medium">
                    {format(
                      new Date(issue.firstResponseAt),
                      "dd MMM yyyy HH:mm"
                    )}
                  </p>
                </div>
              )}
              {issue.resolvedAt && (
                <div>
                  <p className="text-muted-foreground">Resolved At</p>
                  <p className="font-medium">
                    {format(
                      new Date(issue.resolvedAt),
                      "dd MMM yyyy HH:mm"
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resolve Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Resolution *</Label>
              <Textarea
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                className="mt-1"
                rows={4}
              />
            </div>
            <div>
              <Label>Root Cause</Label>
              <Select
                value={resolveRootCause}
                onValueChange={setResolveRootCause}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select root cause..." />
                </SelectTrigger>
                <SelectContent>
                  {ROOT_CAUSE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                "Resolve Issue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
