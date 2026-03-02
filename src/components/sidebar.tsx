"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Contact,
  Building2,
  FileText,
  Mail,
  Calendar,
  Briefcase,
  ClipboardCheck,
  HardHat,
  AlertTriangle,
  CheckSquare,
  FolderOpen,
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Bell,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Pipeline", href: "/pipeline", icon: Kanban },
      { label: "Leads", href: "/leads", icon: Users },
      { label: "Contacts", href: "/contacts", icon: Contact },
      { label: "Accounts", href: "/accounts", icon: Building2 },
    ],
  },
  {
    title: "SALES",
    items: [
      { label: "Quotes", href: "/quotes", icon: FileText },
      { label: "Emails", href: "/emails", icon: Inbox },
      { label: "Marketing", href: "/marketing", icon: Mail },
      { label: "Calendar", href: "/calendar", icon: Calendar },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Contracts", href: "/contracts", icon: Briefcase },
      { label: "Audits", href: "/audits", icon: ClipboardCheck },
      { label: "Subcontractors", href: "/subcontractors", icon: HardHat },
      { label: "Issues", href: "/issues", icon: AlertTriangle },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Documents", href: "/documents", icon: FolderOpen },
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-slate-800">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-700/50">
        <Image
          src="/logo.png"
          alt="Signature Cleans"
          width={36}
          height={36}
          className="shrink-0 rounded-lg"
        />
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-bold text-white tracking-wide">
              Signature OS
            </span>
            <span className="truncate text-[11px] text-slate-400">
              CRM Platform
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              {collapsed && (
                <Separator className="mb-2 bg-slate-700/50" />
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));

                  const linkContent = (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        collapsed && "justify-center px-2",
                        isActive
                          ? "bg-emerald-600/20 text-emerald-400"
                          : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive
                            ? "text-emerald-400"
                            : "text-slate-400"
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {isActive && !collapsed && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <div key={item.href}>
                      {linkContent}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 border-r border-slate-700/30 bg-slate-800 transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[280px]"
        )}
      >
        <SidebarNav collapsed={collapsed} />

        {/* Collapse toggle */}
        <div className="border-t border-slate-700/50 p-3 bg-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full text-slate-400 hover:text-white hover:bg-slate-700/50",
              collapsed && "px-2"
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span className="ml-2 text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar (sheet overlay) */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 bg-slate-800 border-slate-700/30"
        >
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarNav collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
