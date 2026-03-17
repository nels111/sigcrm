"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  PenSquare,
  ArrowLeft,
  Reply,
  Eye,
  Link2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./compose-dialog";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailItem {
  id: string;
  direction: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  status: string;
  isRead?: boolean;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  messageId: string | null;
  inReplyTo: string | null;
  threadId: string | null;
  openCount?: number;
  openedAt?: string | null;
  lastOpenedAt?: string | null;
  mailAccount?: "nick" | "nelson" | "hello";
  deal: { id: string; name: string } | null;
  lead: { id: string; companyName: string; contactName: string } | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string;
    email: string | null;
  } | null;
  account: { id: string; name: string } | null;
}

interface DateGroup {
  label: string;
  emails: EmailItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmailDate(email: EmailItem): Date {
  return new Date(email.sentAt || email.receivedAt || email.createdAt);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function displayName(email: EmailItem): string {
  if (email.direction === "inbound") {
    if (email.contact) {
      const parts = [email.contact.firstName, email.contact.lastName].filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
    // Use the part before @ but capitalize first letter
    const local = email.fromAddress.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  // Outbound — show recipient
  if (email.contact) {
    const parts = [email.contact.firstName, email.contact.lastName].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  const local = email.toAddress.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function bodyPreview(email: EmailItem): string {
  const text = email.bodyText || "";
  if (text) return text.replace(/\s+/g, " ").trim().slice(0, 120);
  if (email.bodyHtml) {
    // Strip HTML tags for preview
    return email.bodyHtml
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }
  return "";
}

function dateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const emailDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (emailDay.getTime() === today.getTime()) return "Today";
  if (emailDay.getTime() === yesterday.getTime()) return "Yesterday";
  if (emailDay >= weekAgo) {
    return date.toLocaleDateString("en-GB", { weekday: "long" });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(emails: EmailItem[]): DateGroup[] {
  const groups: Map<string, EmailItem[]> = new Map();
  for (const email of emails) {
    const d = getEmailDate(email);
    const label = dateLabel(d);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(email);
  }
  return Array.from(groups.entries()).map(([label, emails]) => ({
    label,
    emails,
  }));
}

function timeDisplay(email: EmailItem): string {
  const dateStr = email.sentAt || email.receivedAt || email.createdAt;
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (emailDay.getTime() === today.getTime()) {
    return formatTime(dateStr);
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// EmailDetailView — iOS-style full detail
// ---------------------------------------------------------------------------

function EmailDetailView({
  email,
  onBack,
  onReply,
}: {
  email: EmailItem;
  onBack: () => void;
  onReply: (email: EmailItem) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!email.bodyHtml || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 15px;
              line-height: 1.5;
              color: #1d1d1f;
              margin: 0;
              padding: 0;
              -webkit-font-smoothing: antialiased;
            }
            a { color: #007AFF; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>${email.bodyHtml}</body>
      </html>
    `);
    doc.close();
    const resize = () => {
      iframe.style.height = (doc.body?.scrollHeight || 300) + "px";
    };
    resize();
    setTimeout(resize, 200);
  }, [email.bodyHtml]);

  const linked = email.deal
    ? { label: email.deal.name, href: `/deals/${email.deal.id}`, type: "Deal" }
    : email.lead
      ? { label: email.lead.companyName, href: `/leads/${email.lead.id}`, type: "Lead" }
      : email.account
        ? { label: email.account.name, href: `/accounts/${email.account.id}`, type: "Account" }
        : null;

  const trackingInfo =
    email.direction === "outbound" && email.openCount != null
      ? email.openCount > 0
        ? `Opened ${email.openCount} time${email.openCount > 1 ? "s" : ""}${email.lastOpenedAt ? ` \u00B7 last ${relativeTime(email.lastOpenedAt)}` : ""}`
        : "Not yet opened"
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/80">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#007AFF] text-sm font-medium hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[#007AFF] hover:text-[#007AFF]/70 gap-1.5"
          onClick={() => onReply(email)}
        >
          <Reply className="h-4 w-4" />
          Reply
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4">
          {/* Subject */}
          <h2 className="text-xl font-semibold text-gray-900 leading-tight">
            {email.subject || "(no subject)"}
          </h2>

          {/* Meta */}
          <div className="mt-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {displayName(email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{displayName(email)}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatFullDate(email.sentAt || email.createdAt)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {email.direction === "inbound" ? "From" : "To"}:{" "}
                {email.direction === "inbound" ? email.fromAddress : email.toAddress}
              </p>
              {email.direction === "outbound" && (
                <p className="text-xs text-gray-400 mt-0.5">
                  From: {email.fromAddress}
                </p>
              )}
            </div>
          </div>

          {/* CRM link */}
          {linked && (
            <Link
              href={linked.href}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#007AFF] bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
            >
              <Link2 className="h-3 w-3" />
              {linked.label} &middot; {linked.type}
            </Link>
          )}

          {/* Tracking */}
          {trackingInfo && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <Eye className="h-3 w-3" />
              {trackingInfo}
            </div>
          )}

          {/* Body */}
          <div className="mt-5">
            {email.bodyHtml ? (
              <iframe
                ref={iframeRef}
                title="Email body"
                className="w-full border-0"
                sandbox="allow-same-origin"
                style={{ minHeight: 200 }}
              />
            ) : (
              <p className="text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed">
                {email.bodyText || "No content"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component — iOS Mail style
// ---------------------------------------------------------------------------

export function EmailsPageClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const composeParam = searchParams.get("compose");
  const defaultTo = searchParams.get("to") || "";
  const defaultDealId = searchParams.get("dealId") || "";
  const defaultLeadId = searchParams.get("leadId") || "";

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(composeParam === "true");
  const [replyTo, setReplyTo] = useState<EmailItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mailboxes, setMailboxes] = useState<("nick" | "nelson" | "hello")[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<"nick" | "nelson" | "hello" | "all">("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [autoPolling] = useState(true);

  // Load accessible mailboxes
  useEffect(() => {
    async function loadMailboxes() {
      try {
        const res = await fetch("/api/emails/mailboxes");
        if (res.ok) {
          const json = await res.json();
          setMailboxes(json.mailboxes || []);
        }
      } catch {
        // Fallback
        setMailboxes(["nick", "hello"]);
      }
    }
    loadMailboxes();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEmails = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (pageNum === 1) setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: "50",
          direction,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedMailbox !== "all") {
          params.set("mailAccount", selectedMailbox);
        }
        const res = await fetch(`/api/emails?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const newEmails = json.data || [];
        setHasMore(
          json.pagination && json.pagination.page < json.pagination.totalPages
        );
        if (append) {
          setEmails((prev) => [...prev, ...newEmails]);
        } else {
          setEmails(newEmails);
        }
      } catch {
        setEmails([]);
      } finally {
        setLoading(false);
      }
    },
    [direction, debouncedSearch, selectedMailbox]
  );

  useEffect(() => {
    setPage(1);
    fetchEmails(1, false);
  }, [direction, debouncedSearch, selectedMailbox, fetchEmails]);

  // Auto-poll every 60 seconds
  useEffect(() => {
    if (!autoPolling) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/emails/sync", { method: "POST" });
        if (res.ok) {
          // Refresh emails silently
          fetchEmails(1, false);
        }
      } catch {
        // Silent fail on polling
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [autoPolling, fetchEmails]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/emails/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      toast({
        title: "Sync complete",
        description: `${json.synced} new email${json.synced !== 1 ? "s" : ""} imported`,
      });
      fetchEmails(1, false);
    } catch {
      toast({
        title: "Sync failed",
        description: "Could not sync inbox.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEmails(nextPage, true);
  }

  function handleReply(email: EmailItem) {
    setReplyTo(email);
    setComposeOpen(true);
  }

  const dateGroups = groupByDate(emails);

  // If an email is selected, show detail view
  if (selectedEmail) {
    return (
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ minHeight: 600 }}>
        <EmailDetailView
          email={selectedEmail}
          onBack={() => setSelectedEmail(null)}
          onReply={handleReply}
        />
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onSuccess={fetchEmails}
          defaultTo={replyTo?.fromAddress || defaultTo}
          defaultSubject={replyTo?.subject || ""}
          inReplyTo={replyTo?.messageId || undefined}
          dealId={replyTo?.deal?.id || defaultDealId || undefined}
          leadId={replyTo?.lead?.id || defaultLeadId || undefined}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Emails</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          </Button>
          <Button
            onClick={() => {
              setReplyTo(null);
              setComposeOpen(true);
            }}
            size="sm"
            className="gap-1.5 bg-[#007AFF] hover:bg-[#0066DD]"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Compose
          </Button>
        </div>
      </div>

      {/* Mailbox tabs */}
      {mailboxes.length > 0 && (
        <div className="flex gap-2 border-b overflow-x-auto pb-0">
          <button
            onClick={() => {
              setSelectedMailbox("all");
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
              selectedMailbox === "all"
                ? "border-[#007AFF] text-[#007AFF]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            All Mailboxes
          </button>
          {mailboxes.map((mb) => (
            <button
              key={mb}
              onClick={() => {
                setSelectedMailbox(mb);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 capitalize",
                selectedMailbox === mb
                  ? "border-[#007AFF] text-[#007AFF]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {mb}@
            </button>
          ))}
        </div>
      )}

      {/* Segmented control — iOS style */}
      <div className="flex justify-center">
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => {
              setDirection("inbound");
              setPage(1);
            }}
            className={cn(
              "px-6 py-1.5 text-sm font-medium rounded-md transition-all",
              direction === "inbound"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Inbox
          </button>
          <button
            onClick={() => {
              setDirection("outbound");
              setPage(1);
            }}
            className={cn(
              "px-6 py-1.5 text-sm font-medium rounded-md transition-all",
              direction === "outbound"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Sent
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search emails..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 bg-gray-100 border-0 rounded-xl text-sm placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-[#007AFF]"
        />
      </div>

      {/* Email list */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-50 rounded w-2/3" />
                  <div className="h-2.5 bg-gray-50 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-sm">No emails</p>
          </div>
        ) : (
          <div>
            {dateGroups.map((group) => (
              <div key={group.label}>
                {/* Date section header */}
                <div className="px-4 py-2 bg-gray-50/80 border-b">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {group.label}
                  </p>
                </div>
                {/* Emails in this group */}
                <div>
                  {group.emails.map((email, idx) => {
                    const isUnread = !email.isRead && email.direction === "inbound";
                    const preview = bodyPreview(email);
                    return (
                      <button
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={cn(
                          "w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors",
                          idx < group.emails.length - 1 && "border-b border-gray-100"
                        )}
                      >
                        {/* Unread dot */}
                        <div className="flex items-center pt-3 w-2.5 shrink-0">
                          {isUnread && (
                            <div className="h-2.5 w-2.5 rounded-full bg-[#007AFF]" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className={cn(
                                "text-[15px] truncate",
                                isUnread ? "font-semibold text-gray-900" : "font-normal text-gray-900"
                              )}
                            >
                              {displayName(email)}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">
                                {timeDisplay(email)}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                            </div>
                          </div>
                          <p
                            className={cn(
                              "text-sm truncate mt-0.5",
                              isUnread ? "font-medium text-gray-700" : "text-gray-600"
                            )}
                          >
                            {email.subject || "(no subject)"}
                          </p>
                          {preview && (
                            <p className="text-sm text-gray-400 truncate mt-0.5">
                              {preview}
                            </p>
                          )}
                          {email.mailAccount && (
                            <p className="text-xs text-gray-400 mt-0.5 capitalize">
                              {email.mailAccount}@
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <div className="px-4 py-4 border-t flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSuccess={fetchEmails}
        defaultTo={replyTo?.fromAddress || defaultTo}
        defaultSubject={replyTo?.subject || ""}
        inReplyTo={replyTo?.messageId || undefined}
        dealId={replyTo?.deal?.id || defaultDealId || undefined}
        leadId={replyTo?.lead?.id || defaultLeadId || undefined}
      />
    </div>
  );
}
