"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  Calendar,
  FileText,
  Shield,
  Heart,
  Trophy,
  XCircle,
  Mail,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  notificationType: string;
  linkUrl: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const NOTIFICATION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "new_lead", label: "New Lead" },
  { value: "deal_stage_change", label: "Deal Stage Change" },
  { value: "deal_won", label: "Deal Won" },
  { value: "deal_lost", label: "Deal Lost" },
  { value: "quote_not_followed_up", label: "Quote Not Followed Up" },
  { value: "stale_deal", label: "Stale Deal" },
  { value: "task_overdue", label: "Task Overdue" },
  { value: "audit_due", label: "Audit Due" },
  { value: "contract_renewal", label: "Contract Renewal" },
  { value: "compliance_expiry", label: "Compliance Expiry" },
  { value: "issue_raised", label: "Issue Raised" },
  { value: "issue_sla_breach", label: "Issue SLA Breach" },
  { value: "cadence_reply", label: "Cadence Reply" },
  { value: "calendly_booking", label: "Calendly Booking" },
  { value: "weekly_scorecard", label: "Weekly Scorecard" },
  { value: "onboarding_milestone", label: "Onboarding Milestone" },
  { value: "health_score_change", label: "Health Score Change" },
];

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_lead":
      return <UserPlus className="h-5 w-5 text-emerald-500" />;
    case "deal_stage_change":
      return <TrendingUp className="h-5 w-5 text-blue-500" />;
    case "deal_won":
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case "deal_lost":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "quote_not_followed_up":
      return <FileText className="h-5 w-5 text-orange-500" />;
    case "stale_deal":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "task_overdue":
      return <Clock className="h-5 w-5 text-red-500" />;
    case "audit_due":
      return <ClipboardCheck className="h-5 w-5 text-purple-500" />;
    case "contract_renewal":
      return <Calendar className="h-5 w-5 text-blue-500" />;
    case "compliance_expiry":
      return <Shield className="h-5 w-5 text-red-500" />;
    case "issue_raised":
    case "issue_sla_breach":
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    case "cadence_reply":
      return <Mail className="h-5 w-5 text-emerald-500" />;
    case "calendly_booking":
      return <Calendar className="h-5 w-5 text-emerald-500" />;
    case "health_score_change":
      return <Heart className="h-5 w-5 text-amber-500" />;
    case "onboarding_milestone":
      return <CheckCheck className="h-5 w-5 text-blue-500" />;
    case "weekly_scorecard":
      return <FileText className="h-5 w-5 text-purple-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

function getNotificationBgColor(type: string): string {
  switch (type) {
    case "new_lead":
    case "cadence_reply":
    case "calendly_booking":
      return "bg-emerald-50 dark:bg-emerald-950/20";
    case "deal_stage_change":
    case "contract_renewal":
    case "onboarding_milestone":
      return "bg-blue-50 dark:bg-blue-950/20";
    case "deal_won":
      return "bg-yellow-50 dark:bg-yellow-950/20";
    case "deal_lost":
    case "task_overdue":
    case "compliance_expiry":
    case "issue_raised":
    case "issue_sla_breach":
      return "bg-red-50 dark:bg-red-950/20";
    case "stale_deal":
    case "health_score_change":
      return "bg-amber-50 dark:bg-amber-950/20";
    case "quote_not_followed_up":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "audit_due":
    case "weekly_scorecard":
      return "bg-purple-50 dark:bg-purple-950/20";
    default:
      return "bg-muted/50";
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (readFilter === "unread") {
        params.set("read", "false");
      } else if (readFilter === "read") {
        params.set("read", "true");
      }

      if (typeFilter !== "all") {
        params.set("notificationType", typeFilter);
      }

      const res = await fetch(`/api/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data);
        setPagination(data.pagination);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [readFilter, typeFilter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: "PUT",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          )
        );
      } catch {
        // Continue navigation
      }
    }

    if (notification.linkUrl) {
      router.push(notification.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      await fetch("/api/notifications/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
    } catch {
      // Silently fail
    }
  };

  const unreadInView = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {pagination.total} total notification{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        {unreadInView > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="shrink-0"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {NOTIFICATION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications list */}
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {loading ? "Loading..." : `Showing ${notifications.length} of ${pagination.total}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No notifications found</p>
              <p className="text-xs mt-1">
                {readFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full flex items-start gap-4 px-4 py-4 text-left hover:bg-muted/30 transition-colors ${
                    !notification.read ? "bg-emerald-50/30 dark:bg-emerald-950/5" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 shrink-0 p-2 rounded-lg ${getNotificationBgColor(notification.notificationType)}`}
                  >
                    {getNotificationIcon(notification.notificationType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm leading-tight ${
                          !notification.read ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] capitalize whitespace-nowrap">
                          {notification.notificationType.replace(/_/g, " ")}
                        </Badge>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchNotifications(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchNotifications(pagination.page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
