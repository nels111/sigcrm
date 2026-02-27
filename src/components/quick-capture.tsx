"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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
import {
  Plus,
  X,
  UserPlus,
  ClipboardList,
  Check,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RecentDeal {
  id: string;
  name: string;
  account?: { name: string } | null;
}

type CaptureMode = null | "lead" | "activity";

const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "site_visit", label: "Site Visit" },
  { value: "email_sent", label: "Email Sent" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "note", label: "Note" },
];

export function QuickCapture() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Lead form state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [leadNotes, setLeadNotes] = useState("");

  // Activity form state
  const [recentDeals, setRecentDeals] = useState<RecentDeal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState("");
  const [activityType, setActivityType] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Fetch recent deals when activity mode is selected
  const fetchRecentDeals = useCallback(async () => {
    setLoadingDeals(true);
    try {
      const res = await fetch("/api/deals?limit=10&sortBy=updatedAt&sortOrder=desc");
      if (res.ok) {
        const data = await res.json();
        setRecentDeals(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingDeals(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "activity") {
      fetchRecentDeals();
    }
  }, [mode, fetchRecentDeals]);

  const resetForms = () => {
    setCompanyName("");
    setContactName("");
    setContactInfo("");
    setLeadNotes("");
    setSelectedDealId("");
    setActivityType("");
    setActivityNotes("");
  };

  const handleClose = () => {
    setIsOpen(false);
    setMode(null);
    resetForms();
    setShowSuccess(false);
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !contactName.trim()) {
      toast({
        title: "Required fields",
        description: "Company Name and Contact Name are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Detect if contactInfo is email or phone
      const isEmail = contactInfo.includes("@");
      const leadPayload: Record<string, string> = {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        leadSource: "QuickCapture",
      };

      if (contactInfo.trim()) {
        if (isEmail) {
          leadPayload.contactEmail = contactInfo.trim();
        } else {
          leadPayload.contactPhone = contactInfo.trim();
        }
      }

      if (leadNotes.trim()) {
        leadPayload.notes = leadNotes.trim();
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...leadPayload, force: true }),
      });

      if (res.ok) {
        setShowSuccess(true);
        toast({
          title: "Lead captured!",
          description: `${companyName} has been added as a new lead.`,
        });
        resetForms();
        setTimeout(() => {
          setShowSuccess(false);
          setMode(null);
          setIsOpen(false);
        }, 1500);
      } else {
        const errorData = await res.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to create lead.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDealId || !activityType) {
      toast({
        title: "Required fields",
        description: "Please select a deal and activity type.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const activityPayload: Record<string, string | undefined> = {
        activityType,
        dealId: selectedDealId,
        subject: `Quick Capture: ${ACTIVITY_TYPES.find((t) => t.value === activityType)?.label || activityType}`,
        body: activityNotes.trim() || undefined,
        performedBy: (session?.user as { id?: string })?.id || undefined,
      };

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload),
      });

      if (res.ok) {
        setShowSuccess(true);
        toast({
          title: "Activity logged!",
          description: "Your activity has been recorded.",
        });
        resetForms();
        setTimeout(() => {
          setShowSuccess(false);
          setMode(null);
          setIsOpen(false);
        }, 1500);
      } else {
        const errorData = await res.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to log activity.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render if not authenticated
  if (!session) return null;

  return (
    <>
      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={handleClose}
        />
      )}

      {/* Floating panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-background border rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
              <h3 className="text-sm font-semibold">
                {mode === null && "Quick Capture"}
                {mode === "lead" && "New Lead"}
                {mode === "activity" && "Log Activity"}
              </h3>
              <button onClick={handleClose} className="hover:opacity-80">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success state */}
            {showSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-emerald-600">
                  {mode === "lead" ? "Lead captured!" : "Activity logged!"}
                </p>
              </div>
            ) : mode === null ? (
              /* Mode selection */
              <div className="p-4 space-y-3">
                <button
                  onClick={() => setMode("lead")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                    <UserPlus className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">New Lead</p>
                    <p className="text-xs text-muted-foreground">
                      Capture a lead in 5 seconds
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setMode("activity")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Log Activity</p>
                    <p className="text-xs text-muted-foreground">
                      Record a call, meeting, or note
                    </p>
                  </div>
                </button>
              </div>
            ) : mode === "lead" ? (
              /* New Lead form */
              <form onSubmit={handleSubmitLead} className="p-4 space-y-3">
                <div>
                  <Label htmlFor="qc-company" className="text-xs font-medium">
                    Company Name *
                  </Label>
                  <Input
                    id="qc-company"
                    placeholder="e.g. Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 h-9"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="qc-contact" className="text-xs font-medium">
                    Contact Name *
                  </Label>
                  <Input
                    id="qc-contact"
                    placeholder="e.g. John Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="mt-1 h-9"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="qc-info" className="text-xs font-medium">
                    Phone or Email
                  </Label>
                  <Input
                    id="qc-info"
                    placeholder="Phone number or email"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    className="mt-1 h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="qc-notes" className="text-xs font-medium">
                    Notes
                  </Label>
                  <Textarea
                    id="qc-notes"
                    placeholder="Quick notes..."
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                    className="mt-1 min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMode(null);
                      resetForms();
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Capture Lead"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              /* Log Activity form */
              <form onSubmit={handleSubmitActivity} className="p-4 space-y-3">
                <div>
                  <Label htmlFor="qc-deal" className="text-xs font-medium">
                    Deal *
                  </Label>
                  {loadingDeals ? (
                    <div className="flex items-center gap-2 mt-1 h-9 px-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading deals...
                    </div>
                  ) : (
                    <Select
                      value={selectedDealId}
                      onValueChange={setSelectedDealId}
                    >
                      <SelectTrigger id="qc-deal" className="mt-1 h-9">
                        <SelectValue placeholder="Select a deal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {recentDeals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            <span className="truncate">
                              {deal.name}
                              {deal.account?.name
                                ? ` - ${deal.account.name}`
                                : ""}
                            </span>
                          </SelectItem>
                        ))}
                        {recentDeals.length === 0 && (
                          <SelectItem value="_none" disabled>
                            No deals found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor="qc-activity-type"
                    className="text-xs font-medium"
                  >
                    Activity Type *
                  </Label>
                  <Select
                    value={activityType}
                    onValueChange={setActivityType}
                  >
                    <SelectTrigger id="qc-activity-type" className="mt-1 h-9">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="qc-activity-notes"
                    className="text-xs font-medium"
                  >
                    Quick Notes
                  </Label>
                  <Textarea
                    id="qc-activity-notes"
                    placeholder="What happened?"
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    className="mt-1 min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMode(null);
                      resetForms();
                    }}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Log Activity"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          isOpen
            ? "bg-gray-600 hover:bg-gray-700 rotate-45"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
        aria-label={isOpen ? "Close quick capture" : "Quick capture"}
      >
        <Plus className="h-6 w-6 text-white" />
      </button>
    </>
  );
}
