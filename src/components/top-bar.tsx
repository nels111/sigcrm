"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  Search,
  Menu,
  LogOut,
  Settings,
  User,
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
} from "lucide-react";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipeline": "Pipeline",
  "/leads": "Leads",
  "/contacts": "Contacts",
  "/accounts": "Accounts",
  "/quotes": "Quotes",
  "/marketing": "Marketing",
  "/calendar": "Calendar",
  "/contracts": "Contracts",
  "/audits": "Audits",
  "/subcontractors": "Subcontractors",
  "/issues": "Issues",
  "/tasks": "Tasks",
  "/documents": "Documents",
  "/reports": "Reports",
  "/notifications": "Notifications",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Check for nested routes
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route + "/")) return title;
  }

  return "Dashboard";
}

function getRoleBadgeVariant(role: string | undefined) {
  switch (role) {
    case "admin":
      return "default";
    case "sales":
      return "secondary";
    case "operations":
      return "outline";
    default:
      return "secondary";
  }
}

function getUserInitials(name: string | undefined | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

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

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_lead":
      return <UserPlus className="h-4 w-4 text-emerald-500" />;
    case "deal_stage_change":
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    case "deal_won":
      return <Trophy className="h-4 w-4 text-yellow-500" />;
    case "deal_lost":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "quote_not_followed_up":
      return <FileText className="h-4 w-4 text-orange-500" />;
    case "stale_deal":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "task_overdue":
      return <Clock className="h-4 w-4 text-red-500" />;
    case "audit_due":
      return <ClipboardCheck className="h-4 w-4 text-purple-500" />;
    case "contract_renewal":
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case "compliance_expiry":
      return <Shield className="h-4 w-4 text-red-500" />;
    case "issue_raised":
    case "issue_sla_breach":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "cadence_reply":
      return <Mail className="h-4 w-4 text-emerald-500" />;
    case "calendly_booking":
      return <Calendar className="h-4 w-4 text-emerald-500" />;
    case "health_score_change":
      return <Heart className="h-4 w-4 text-amber-500" />;
    case "onboarding_milestone":
      return <CheckCheck className="h-4 w-4 text-blue-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
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

interface TopBarProps {
  onMobileMenuToggle: () => void;
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);

  const user = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; role?: string }
    | undefined;

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail — bell will show 0
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch latest notifications when popover opens
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (popoverOpen) {
      fetchNotifications();
    }
  }, [popoverOpen, fetchNotifications]);

  // Mark a single notification as read
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: "PUT",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Continue navigation even if mark-read fails
      }
    }

    setPopoverOpen(false);
    if (notification.linkUrl) {
      router.push(notification.linkUrl);
    }
  };

  // Mark all as read
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
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center w-full max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, contacts, deals..."
            className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-emerald-500/50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell with popover */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Mark All Read
                </button>
              )}
            </div>

            <ScrollArea className="h-[360px]">
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        !notification.read ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {getNotificationIcon(notification.notificationType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${!notification.read ? "font-semibold" : "font-medium"}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="mt-2 shrink-0">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="border-t px-4 py-2">
              <button
                onClick={() => {
                  setPopoverOpen(false);
                  router.push("/notifications");
                }}
                className="w-full text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1"
              >
                View All Notifications
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 h-auto py-1.5"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.image || undefined}
                  alt={user?.name || "User"}
                />
                <AvatarFallback className="bg-emerald-600 text-white text-xs font-semibold">
                  {getUserInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">
                  {user?.name || "User"}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {user?.email || ""}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium leading-none">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground leading-none">
                  {user?.email || ""}
                </p>
                <Badge
                  variant={getRoleBadgeVariant(user?.role)}
                  className="w-fit mt-1 capitalize text-[10px]"
                >
                  {user?.role || "user"}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
