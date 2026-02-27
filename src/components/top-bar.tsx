"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Bell,
  Search,
  Menu,
  LogOut,
  Settings,
  User,
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

interface TopBarProps {
  onMobileMenuToggle: () => void;
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const user = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; role?: string }
    | undefined;

  // Placeholder unread notification count
  const unreadCount = 3;

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
        {/* Notification bell */}
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>

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
