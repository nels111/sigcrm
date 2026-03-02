"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Inbox,
  Send,
  Mail,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  PenSquare,
  Reply,
  Forward,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./compose-dialog";
import Link from "next/link";

interface EmailItem {
  id: string;
  direction: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  status: string;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  messageId: string | null;
  inReplyTo: string | null;
  threadId: string | null;
  deal: { id: string; name: string } | null;
  lead: { id: string; companyName: string; contactName: string } | null;
  contact: { id: string; firstName: string | null; lastName: string; email: string | null } | null;
  account: { id: string; name: string } | null;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailsPageClient() {
  const searchParams = useSearchParams();
  const composeParam = searchParams.get("compose");
  const defaultTo = searchParams.get("to") || "";
  const defaultDealId = searchParams.get("dealId") || "";
  const defaultLeadId = searchParams.get("leadId") || "";

  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(composeParam === "true");
  const [replyTo, setReplyTo] = useState<EmailItem | null>(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (filter !== "all") params.set("direction", filter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/emails?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setEmails(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  function handleReply(email: EmailItem) {
    setReplyTo(email);
    setComposeOpen(true);
  }

  function getLinkedEntity(email: EmailItem) {
    if (email.deal) return { label: email.deal.name, href: `/deals/${email.deal.id}` };
    if (email.lead) return { label: email.lead.companyName, href: `/leads/${email.lead.id}` };
    if (email.account) return { label: email.account.name, href: `/accounts/${email.account.id}` };
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Emails</h2>
          <p className="text-sm text-muted-foreground">
            View and manage all emails
          </p>
        </div>
        <Button onClick={() => { setReplyTo(null); setComposeOpen(true); }} className="gap-2">
          <PenSquare className="h-4 w-4" />
          Compose
        </Button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-4">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
            <TabsTrigger value="inbound" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="outbound" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Sent
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Email list + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[500px]">
        {/* Email list (left) */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  No emails found
                </div>
              ) : (
                <div className="divide-y">
                  {emails.map((email) => {
                    const isSelected = selectedEmail?.id === email.id;
                    return (
                      <button
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                          isSelected && "bg-emerald-50 border-l-2 border-emerald-500"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate pr-2">
                            {email.direction === "inbound"
                              ? email.fromAddress
                              : email.toAddress}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDateTime(email.sentAt || email.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm truncate">
                          {email.subject || "(no subject)"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              email.direction === "inbound"
                                ? "border-blue-200 text-blue-700"
                                : "border-emerald-200 text-emerald-700"
                            )}
                          >
                            {email.direction === "inbound" ? "Received" : "Sent"}
                          </Badge>
                          {email.status === "failed" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Failed
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email detail (right) */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            {selectedEmail ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <CardTitle className="text-base">
                        {selectedEmail.subject || "(no subject)"}
                      </CardTitle>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">From:</span>{" "}
                          {selectedEmail.fromAddress}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">To:</span>{" "}
                          {selectedEmail.toAddress}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Date:</span>{" "}
                          {formatFullDate(selectedEmail.sentAt || selectedEmail.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleReply(selectedEmail)}
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setReplyTo(null);
                          setComposeOpen(true);
                        }}
                      >
                        <Forward className="h-3.5 w-3.5" />
                        Forward
                      </Button>
                    </div>
                  </div>

                  {/* Linked entity */}
                  {(() => {
                    const linked = getLinkedEntity(selectedEmail);
                    if (!linked) return null;
                    return (
                      <div className="mt-2">
                        <Link
                          href={linked.href}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Linked to: {linked.label}
                        </Link>
                      </div>
                    );
                  })()}
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  {selectedEmail.bodyHtml ? (
                    <div
                      className="prose prose-sm max-w-none [&_a]:text-emerald-600"
                      dangerouslySetInnerHTML={{
                        __html: selectedEmail.bodyHtml,
                      }}
                    />
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {selectedEmail.bodyText || "No content"}
                    </pre>
                  )}
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select an email to view</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
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
