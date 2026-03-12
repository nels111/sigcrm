"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  RefreshCw,
  PenSquare,
  Reply,
  Eye,
  Link2,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function senderName(email: EmailItem): string {
  if (email.direction === "inbound") {
    return email.fromAddress.split("@")[0];
  }
  return email.toAddress.split("@")[0];
}

// ---------------------------------------------------------------------------
// EmailSidebar
// ---------------------------------------------------------------------------

function EmailSidebar({
  emails,
  loading,
  direction,
  setDirection,
  selectedId,
  onSelect,
  onSync,
  syncing,
  search,
  setSearch,
}: {
  emails: EmailItem[];
  loading: boolean;
  direction: "inbound" | "outbound";
  setDirection: (d: "inbound" | "outbound") => void;
  selectedId: string | null;
  onSelect: (email: EmailItem) => void;
  onSync: () => void;
  syncing: boolean;
  search: string;
  setSearch: (s: string) => void;
}) {
  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDirection("inbound")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              direction === "inbound"
                ? "bg-[#0B3D91] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Inbox
          </button>
          <button
            onClick={() => setDirection("outbound")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
              direction === "outbound"
                ? "bg-[#0B3D91] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Sent
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw
            className={cn("h-4 w-4", syncing && "animate-spin")}
          />
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-full" />
                <div className="h-2 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No emails found
          </div>
        ) : (
          <div className="divide-y">
            {emails.map((email) => {
              const isSelected = selectedId === email.id;
              const isUnread = !email.isRead && email.direction === "inbound";
              return (
                <button
                  key={email.id}
                  onClick={() => onSelect(email)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors",
                    isSelected && "bg-blue-50"
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={cn(
                        "text-sm truncate pr-2",
                        isUnread ? "font-semibold" : "font-normal"
                      )}
                    >
                      {senderName(email)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-gray-400">
                        {relativeTime(email.sentAt || email.createdAt)}
                      </span>
                      {isUnread && (
                        <div className="h-2 w-2 rounded-full bg-[#0B3D91]" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {email.subject || "(no subject)"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailDetail
// ---------------------------------------------------------------------------

function EmailDetail({
  email,
  onReply,
}: {
  email: EmailItem | null;
  onReply: (email: EmailItem) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to content
  useEffect(() => {
    if (!email?.bodyHtml || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`
      <html>
        <head><style>body{font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0;padding:8px;}</style></head>
        <body>${email.bodyHtml}</body>
      </html>
    `);
    doc.close();
    const resize = () => {
      iframe.style.height =
        (doc.body?.scrollHeight || 200) + "px";
    };
    resize();
    setTimeout(resize, 100);
  }, [email?.bodyHtml]);

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Select an email</p>
      </div>
    );
  }

  const linked = email.deal
    ? { label: email.deal.name, href: `/deals/${email.deal.id}`, type: "Deal" }
    : email.lead
      ? {
          label: email.lead.companyName,
          href: `/leads/${email.lead.id}`,
          type: "Lead",
        }
      : email.account
        ? {
            label: email.account.name,
            href: `/accounts/${email.account.id}`,
            type: "Account",
          }
        : null;

  const trackingInfo =
    email.direction === "outbound" && email.openCount != null
      ? email.openCount > 0
        ? `Opened ${email.openCount} time${email.openCount > 1 ? "s" : ""}${email.lastOpenedAt ? ` \u00B7 last seen ${relativeTime(email.lastOpenedAt)}` : ""}`
        : "Not yet opened"
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 space-y-1 text-sm">
        <div>
          <span className="text-muted-foreground w-16 inline-block">From:</span>
          <span className="font-medium">{email.fromAddress}</span>
        </div>
        <div>
          <span className="text-muted-foreground w-16 inline-block">To:</span>
          <span>{email.toAddress}</span>
        </div>
        <div>
          <span className="text-muted-foreground w-16 inline-block">Subject:</span>
          <span className="font-medium">{email.subject || "(no subject)"}</span>
        </div>
        <div>
          <span className="text-muted-foreground w-16 inline-block">Date:</span>
          <span>{formatFullDate(email.sentAt || email.createdAt)}</span>
        </div>
      </div>

      <hr />

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {email.bodyHtml ? (
          <iframe
            ref={iframeRef}
            title="Email body"
            className="w-full border-0"
            sandbox="allow-same-origin"
            style={{ minHeight: 200 }}
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans">
            {email.bodyText || "No content"}
          </pre>
        )}
      </div>

      <hr />

      {/* CRM + Tracking + Actions */}
      <div className="px-6 py-3 space-y-2">
        {/* CRM link */}
        <div className="flex items-center gap-2 text-sm">
          {linked ? (
            <Link
              href={linked.href}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <Link2 className="h-3 w-3" />
              {linked.label} &middot; {linked.type}
            </Link>
          ) : (
            <span className="text-xs text-gray-400">Not linked to a CRM record</span>
          )}
        </div>

        {/* Tracking */}
        {trackingInfo && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Eye className="h-3 w-3" />
            {trackingInfo}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onReply(email)}
          >
            <Reply className="h-3.5 w-3.5" />
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        direction,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/emails?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEmails(json.data || []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [direction, debouncedSearch]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

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
      fetchEmails();
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

  function handleReply(email: EmailItem) {
    setReplyTo(email);
    setComposeOpen(true);
  }

  function handleSelect(email: EmailItem) {
    setSelectedEmail(email);
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Emails</h2>
          <p className="text-sm text-muted-foreground">
            View and manage all emails
          </p>
        </div>
        <Button
          onClick={() => {
            setReplyTo(null);
            setComposeOpen(true);
          }}
          className="gap-2"
        >
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] border rounded-lg bg-card min-h-[600px] overflow-hidden">
        <EmailSidebar
          emails={emails}
          loading={loading}
          direction={direction}
          setDirection={setDirection}
          selectedId={selectedEmail?.id ?? null}
          onSelect={handleSelect}
          onSync={handleSync}
          syncing={syncing}
          search={search}
          setSearch={setSearch}
        />
        <EmailDetail email={selectedEmail} onReply={handleReply} />
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
