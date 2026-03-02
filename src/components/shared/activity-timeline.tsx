"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Phone,
  Mail,
  Send,
  Calendar,
  MapPin,
  StickyNote,
  FileText,
  CheckCircle2,
  ArrowRightCircle,
  ClipboardCheck,
  Clock,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

interface Activity {
  id: string;
  activityType: string;
  subject: string | null;
  body: string | null;
  createdAt: string;
  performer: { id: string; name: string } | null;
}

const ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4 text-blue-500" />,
  email_sent: <Send className="h-4 w-4 text-emerald-500" />,
  email_received: <Mail className="h-4 w-4 text-sky-500" />,
  cadence_email_sent: <Send className="h-4 w-4 text-violet-500" />,
  meeting: <Calendar className="h-4 w-4 text-amber-500" />,
  site_visit: <MapPin className="h-4 w-4 text-orange-500" />,
  note: <StickyNote className="h-4 w-4 text-slate-500" />,
  whatsapp: <MessageSquare className="h-4 w-4 text-green-500" />,
  quote_sent: <FileText className="h-4 w-4 text-violet-500" />,
  quote_accepted: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  quote_rejected: <FileText className="h-4 w-4 text-red-500" />,
  deal_stage_change: <ArrowRightCircle className="h-4 w-4 text-indigo-500" />,
  contract_created: <ClipboardCheck className="h-4 w-4 text-emerald-500" />,
  audit_completed: <ClipboardCheck className="h-4 w-4 text-blue-500" />,
  task_completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  quick_capture: <StickyNote className="h-4 w-4 text-amber-500" />,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface ActivityTimelineProps {
  entityType: "deal" | "lead" | "account" | "contract" | "contact";
  entityId: string;
  title?: string;
}

export function ActivityTimeline({
  entityType,
  entityId,
  title = "Activity Timeline",
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        [`${entityType}Id`]: entityId,
        limit: "20",
      });
      const res = await fetch(`/api/activities?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setActivities(json.data || []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={fetchActivities}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading...
          </p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            No activities yet.
          </p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border">
                  {ICONS[activity.activityType] || (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium">
                      {typeLabel(activity.activityType)}
                    </p>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDateTime(activity.createdAt)}
                    </span>
                  </div>
                  {activity.subject && (
                    <p className="text-sm text-foreground mt-0.5">
                      {activity.subject}
                    </p>
                  )}
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
  );
}
