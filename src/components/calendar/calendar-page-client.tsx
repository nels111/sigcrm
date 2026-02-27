"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  getHours,
  getMinutes,
  differenceInMinutes,
  parseISO,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Users,
  Briefcase,
  Building2,
  FileText,
  ExternalLink,
  Trash2,
  Edit,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarEventRelation {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  stage?: string;
  contractName?: string;
  status?: string;
  avatarUrl?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventType: string;
  status: string;
  createdBy: string;
  attendees: string[];
  calendlyEventId: string | null;
  calendlyCancelUrl: string | null;
  calendlyRescheduleUrl: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  deal: CalendarEventRelation | null;
  contact: CalendarEventRelation | null;
  account: CalendarEventRelation | null;
  contract: CalendarEventRelation | null;
  creator: CalendarEventRelation | null;
  dealId: string | null;
  contactId: string | null;
  accountId: string | null;
  contractId: string | null;
}

interface LinkOption {
  id: string;
  label: string;
}

type ViewMode = "day" | "week" | "month";
type CalendarFilter = "mine" | "nick" | "both";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  meeting: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  site_visit: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  audit: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  review: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  call: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" },
  personal: { bg: "bg-gray-100 dark:bg-gray-900/30", text: "text-gray-700 dark:text-gray-300", border: "border-gray-300 dark:border-gray-700" },
  other: { bg: "bg-slate-100 dark:bg-slate-900/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-700" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  site_visit: "Site Visit",
  audit: "Audit",
  review: "Review",
  call: "Call",
  personal: "Personal",
  other: "Other",
};

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am - 6pm


// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getEventColor(type: string) {
  return EVENT_COLORS[type] || EVENT_COLORS.other;
}

function getContactName(contact: CalendarEventRelation | null): string {
  if (!contact) return "";
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarPageClient() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("both");

  // Data
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Create/Edit form
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formEventType, setFormEventType] = useState("meeting");
  const [formDealId, setFormDealId] = useState("");
  const [formContactId, setFormContactId] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formContractId, setFormContractId] = useState("");
  const [saving, setSaving] = useState(false);

  // Link options for dropdowns
  const [deals, setDeals] = useState<LinkOption[]>([]);
  const [contacts, setContacts] = useState<LinkOption[]>([]);
  const [accounts, setAccounts] = useState<LinkOption[]>([]);
  const [contracts, setContracts] = useState<LinkOption[]>([]);

  // Computed date range
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    }
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { start: ws, end: we };
    }
    // month
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const gridStart = startOfWeek(ms, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(me, { weekStartsOn: 1 });
    return { start: gridStart, end: gridEnd };
  }, [viewMode, currentDate]);

  // ---------------------------------------------------------------------------
  // Fetch events
  // ---------------------------------------------------------------------------

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      });
      const res = await fetch(`/api/calendar?${params}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const json = await res.json();
      setEvents(json.data || []);
    } catch {
      toast({ title: "Error", description: "Could not load calendar events.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateRange, toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ---------------------------------------------------------------------------
  // Fetch link options (for create/edit form)
  // ---------------------------------------------------------------------------

  const fetchLinkOptions = useCallback(async () => {
    try {
      const [dealsRes, contactsRes, accountsRes, contractsRes] = await Promise.all([
        fetch("/api/deals?limit=100"),
        fetch("/api/contacts?limit=100"),
        fetch("/api/accounts?limit=100"),
        fetch("/api/contracts?limit=100"),
      ]);

      if (dealsRes.ok) {
        const d = await dealsRes.json();
        const items = d.data || d;
        setDeals(
          (Array.isArray(items) ? items : []).map((x: { id: string; name: string }) => ({
            id: x.id,
            label: x.name,
          }))
        );
      }

      if (contactsRes.ok) {
        const c = await contactsRes.json();
        const items = c.data || c;
        setContacts(
          (Array.isArray(items) ? items : []).map(
            (x: { id: string; firstName?: string; lastName: string }) => ({
              id: x.id,
              label: [x.firstName, x.lastName].filter(Boolean).join(" "),
            })
          )
        );
      }

      if (accountsRes.ok) {
        const a = await accountsRes.json();
        const items = a.data || a;
        setAccounts(
          (Array.isArray(items) ? items : []).map((x: { id: string; name: string }) => ({
            id: x.id,
            label: x.name,
          }))
        );
      }

      if (contractsRes.ok) {
        const ct = await contractsRes.json();
        const items = ct.data || ct;
        setContracts(
          (Array.isArray(items) ? items : []).map(
            (x: { id: string; contractName: string }) => ({
              id: x.id,
              label: x.contractName,
            })
          )
        );
      }
    } catch {
      // Silently fail - options just won't be available
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function goToday() {
    setCurrentDate(new Date());
  }

  function goPrev() {
    if (viewMode === "day") setCurrentDate((d) => subDays(d, 1));
    if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    if (viewMode === "month") setCurrentDate((d) => subMonths(d, 1));
  }

  function goNext() {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, 1));
    if (viewMode === "week") setCurrentDate((d) => addWeeks(d, 1));
    if (viewMode === "month") setCurrentDate((d) => addMonths(d, 1));
  }

  // ---------------------------------------------------------------------------
  // Create / Edit
  // ---------------------------------------------------------------------------

  function openCreate(date?: Date, hour?: number) {
    setEditMode(false);
    setSelectedEvent(null);
    const targetDate = date || new Date();
    const dateStr = format(targetDate, "yyyy-MM-dd");
    setFormTitle("");
    setFormDescription("");
    setFormStartDate(dateStr);
    setFormEndDate(dateStr);
    if (hour !== undefined) {
      setFormStartTime(`${String(hour).padStart(2, "0")}:00`);
      setFormEndTime(`${String(hour + 1).padStart(2, "0")}:00`);
    } else {
      setFormStartTime("09:00");
      setFormEndTime("10:00");
    }
    setFormAllDay(false);
    setFormEventType("meeting");
    setFormDealId("");
    setFormContactId("");
    setFormAccountId("");
    setFormContractId("");
    fetchLinkOptions();
    setCreateOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditMode(true);
    setSelectedEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || "");
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    setFormStartDate(format(start, "yyyy-MM-dd"));
    setFormStartTime(format(start, "HH:mm"));
    setFormEndDate(format(end, "yyyy-MM-dd"));
    setFormEndTime(format(end, "HH:mm"));
    setFormAllDay(event.allDay);
    setFormEventType(event.eventType);
    setFormDealId(event.dealId || "");
    setFormContactId(event.contactId || "");
    setFormAccountId(event.accountId || "");
    setFormContractId(event.contractId || "");
    fetchLinkOptions();
    setCreateOpen(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      toast({ title: "Validation", description: "Title is required.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const startTime = new Date(`${formStartDate}T${formStartTime}:00`);
      const endTime = new Date(`${formEndDate}T${formEndTime}:00`);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        toast({ title: "Validation", description: "Invalid date/time.", variant: "destructive" });
        setSaving(false);
        return;
      }

      if (endTime <= startTime) {
        toast({ title: "Validation", description: "End time must be after start time.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        allDay: formAllDay,
        eventType: formEventType,
        dealId: formDealId || null,
        contactId: formContactId || null,
        accountId: formAccountId || null,
        contractId: formContractId || null,
      };

      if (!editMode) {
        payload.createdBy = session?.user?.id;
      }

      const url = editMode && selectedEvent
        ? `/api/calendar/${selectedEvent.id}`
        : "/api/calendar";
      const method = editMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save event");
      }

      toast({ title: "Success", description: editMode ? "Event updated." : "Event created." });
      setCreateOpen(false);
      fetchEvents();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save event.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(eventId: string) {
    try {
      const res = await fetch(`/api/calendar/${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: "Event deleted." });
      fetchEvents();
    } catch {
      toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
    }
  }

  // ---------------------------------------------------------------------------
  // Mark complete
  // ---------------------------------------------------------------------------

  async function handleMarkComplete(eventId: string) {
    try {
      const res = await fetch(`/api/calendar/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Done", description: "Event marked complete." });
      fetchEvents();
    } catch {
      toast({ title: "Error", description: "Failed to update event.", variant: "destructive" });
    }
  }

  // ---------------------------------------------------------------------------
  // Filtered events
  // ---------------------------------------------------------------------------

  const filteredEvents = useMemo(() => {
    if (calendarFilter === "both") return events;
    const userId = session?.user?.id;
    if (!userId) return events;
    if (calendarFilter === "mine") {
      return events.filter(
        (e) => e.createdBy === userId || e.attendees.includes(userId)
      );
    }
    // nick - show events not created by current user
    return events.filter(
      (e) => e.createdBy !== userId && !e.attendees.includes(userId)
    );
  }, [events, calendarFilter, session?.user?.id]);

  // ---------------------------------------------------------------------------
  // Header label
  // ---------------------------------------------------------------------------

  const headerLabel = useMemo(() => {
    if (viewMode === "day") return format(currentDate, "EEEE, d MMMM yyyy");
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, "d")} - ${format(we, "d MMMM yyyy")}`;
      }
      return `${format(ws, "d MMM")} - ${format(we, "d MMM yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [viewMode, currentDate]);

  // ---------------------------------------------------------------------------
  // Month view: build grid
  // ---------------------------------------------------------------------------

  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [viewMode, dateRange]);

  // ---------------------------------------------------------------------------
  // Week/Day view: events for a specific day
  // ---------------------------------------------------------------------------

  function eventsForDay(day: Date): CalendarEvent[] {
    return filteredEvents.filter((e) => {
      const start = parseISO(e.startTime);
      return isSameDay(start, day);
    });
  }

  function allDayEventsForDay(day: Date): CalendarEvent[] {
    return filteredEvents.filter((e) => {
      if (!e.allDay) return false;
      const start = parseISO(e.startTime);
      const end = parseISO(e.endTime);
      return day >= startOfDay(start) && day <= endOfDay(end);
    });
  }

  function timedEventsForDay(day: Date): CalendarEvent[] {
    return filteredEvents.filter((e) => {
      if (e.allDay) return false;
      const start = parseISO(e.startTime);
      return isSameDay(start, day);
    });
  }

  // ---------------------------------------------------------------------------
  // Time slot positioning
  // ---------------------------------------------------------------------------

  function getEventPosition(event: CalendarEvent) {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const startMinutesFromTop = (getHours(start) - 8) * 60 + getMinutes(start);
    const durationMinutes = differenceInMinutes(end, start);
    const top = Math.max(0, startMinutesFromTop);
    const height = Math.max(20, Math.min(durationMinutes, (18 - 8) * 60 - top));
    return { top, height };
  }

  // ---------------------------------------------------------------------------
  // Event detail popover content
  // ---------------------------------------------------------------------------

  function renderEventDetail(event: CalendarEvent) {
    const color = getEventColor(event.eventType);
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);

    return (
      <div className="space-y-3 max-w-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-base leading-tight">{event.title}</h3>
            <Badge className={cn("mt-1", color.bg, color.text, "border", color.border)} variant="outline">
              {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
            </Badge>
            {event.status === "completed" && (
              <Badge className="ml-1 mt-1" variant="secondary">Completed</Badge>
            )}
            {event.status === "cancelled" && (
              <Badge className="ml-1 mt-1" variant="destructive">Cancelled</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {event.allDay ? (
            <span>All day - {format(start, "d MMM yyyy")}</span>
          ) : (
            <span>
              {format(start, "d MMM yyyy, h:mm a")} - {format(end, "h:mm a")}
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}

        {event.creator && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Created by {event.creator.name}</span>
          </div>
        )}

        {/* Linked records */}
        <div className="space-y-1.5">
          {event.deal && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Deal: {event.deal.name}</span>
            </div>
          )}
          {event.contact && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Contact: {getContactName(event.contact)}</span>
            </div>
          )}
          {event.account && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Account: {event.account.name}</span>
            </div>
          )}
          {event.contract && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Contract: {event.contract.contractName}</span>
            </div>
          )}
        </div>

        {/* Calendly links */}
        {(event.calendlyCancelUrl || event.calendlyRescheduleUrl) && (
          <div className="space-y-1">
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Calendly</p>
            <div className="flex gap-2">
              {event.calendlyRescheduleUrl && (
                <a
                  href={event.calendlyRescheduleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  Reschedule <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {event.calendlyCancelUrl && (
                <a
                  href={event.calendlyCancelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                >
                  Cancel <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(event)}>
            <Edit className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          {event.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={() => handleMarkComplete(event.id)}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Complete
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => handleDelete(event.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Event pill for month view
  // ---------------------------------------------------------------------------

  function EventPill({ event }: { event: CalendarEvent }) {
    const color = getEventColor(event.eventType);
    const start = parseISO(event.startTime);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate border-l-2 cursor-pointer transition-opacity hover:opacity-80",
              color.bg,
              color.text,
              color.border
            )}
          >
            {!event.allDay && (
              <span className="font-medium">{format(start, "h:mm")} </span>
            )}
            {event.title}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          {renderEventDetail(event)}
        </PopoverContent>
      </Popover>
    );
  }

  // ---------------------------------------------------------------------------
  // Event block for week/day view
  // ---------------------------------------------------------------------------

  function EventBlock({ event }: { event: CalendarEvent }) {
    const color = getEventColor(event.eventType);
    const { top, height } = getEventPosition(event);
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const pixelPerMinute = 64 / 60; // 64px per hour slot
    const topPx = top * pixelPerMinute;
    const heightPx = Math.max(20, height * pixelPerMinute);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "absolute left-1 right-1 rounded px-1.5 py-0.5 text-[11px] leading-tight border-l-2 overflow-hidden cursor-pointer transition-opacity hover:opacity-80 z-10",
              color.bg,
              color.text,
              color.border
            )}
            style={{ top: `${topPx}px`, height: `${heightPx}px` }}
          >
            <div className="font-medium truncate">{event.title}</div>
            {heightPx > 30 && (
              <div className="opacity-70 truncate">
                {format(start, "h:mm a")} - {format(end, "h:mm a")}
              </div>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          {renderEventDetail(event)}
        </PopoverContent>
      </Popover>
    );
  }

  // ---------------------------------------------------------------------------
  // Month view
  // ---------------------------------------------------------------------------

  function renderMonthView() {
    const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {weekDayNames.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {monthDays.map((day, idx) => {
            const dayEvents = eventsForDay(day);
            const maxVisible = 3;
            const overflow = dayEvents.length - maxVisible;
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[100px] border-b border-r p-1 cursor-pointer transition-colors hover:bg-muted/30",
                  !isCurrentMonth && "bg-muted/10"
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-radix-popper-content-wrapper]")) return;
                  if ((e.target as HTMLElement).closest("button")) return;
                  setCurrentDate(day);
                  setViewMode("day");
                }}
              >
                <div
                  className={cn(
                    "text-xs font-medium mb-0.5 h-6 w-6 flex items-center justify-center rounded-full",
                    isToday(day) && "bg-primary text-primary-foreground",
                    !isCurrentMonth && "text-muted-foreground"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, maxVisible).map((event) => (
                    <EventPill key={event.id} event={event} />
                  ))}
                  {overflow > 0 && (
                    <button
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDate(day);
                        setViewMode("day");
                      }}
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Week view
  // ---------------------------------------------------------------------------

  function renderWeekView() {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header with day names + dates */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/50">
          <div className="px-1 py-2 text-xs text-muted-foreground" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className="px-2 py-2 text-center cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => {
                setCurrentDate(day);
                setViewMode("day");
              }}
            >
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "text-sm font-medium mx-auto h-7 w-7 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* All-day events row */}
        {weekDays.some((day) => allDayEventsForDay(day).length > 0) && (
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="px-1 py-1 text-[10px] text-muted-foreground flex items-center justify-center">
              All day
            </div>
            {weekDays.map((day) => {
              const allDays = allDayEventsForDay(day);
              return (
                <div key={day.toISOString()} className="px-0.5 py-1 border-l space-y-0.5">
                  {allDays.map((event) => (
                    <EventPill key={event.id} event={event} />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Time grid */}
        <ScrollArea className="h-[600px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Time labels */}
            <div>
              {HOURS.map((h) => (
                <div key={h} className="h-16 border-b px-1 flex items-start pt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const timed = timedEventsForDay(day);
              return (
                <div key={day.toISOString()} className="relative border-l">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="h-16 border-b hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => openCreate(day, h)}
                    />
                  ))}
                  {/* Events positioned absolutely */}
                  {timed.map((event) => (
                    <EventBlock key={event.id} event={event} />
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Day view
  // ---------------------------------------------------------------------------

  function renderDayView() {
    const allDays = allDayEventsForDay(currentDate);
    const timed = timedEventsForDay(currentDate);

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* All-day events */}
        {allDays.length > 0 && (
          <div className="px-3 py-2 border-b bg-muted/30 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">All Day</p>
            {allDays.map((event) => (
              <EventPill key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* Time grid */}
        <ScrollArea className="h-[600px]">
          <div className="grid grid-cols-[60px_1fr] relative">
            {/* Time labels */}
            <div>
              {HOURS.map((h) => (
                <div key={h} className="h-16 border-b px-1 flex items-start pt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className="relative border-l">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="h-16 border-b hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => openCreate(currentDate, h)}
                />
              ))}
              {/* Events */}
              {timed.map((event) => (
                <EventBlock key={event.id} event={event} />
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and manage meetings, site visits, and events.
          </p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2">{headerLabel}</span>
        </div>

        {/* View & calendar toggles */}
        <div className="flex items-center gap-3">
          {/* Calendar filter */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            {(
              [
                { key: "mine", label: "My Calendar" },
                { key: "nick", label: "Nick's Calendar" },
                { key: "both", label: "Both" },
              ] as { key: CalendarFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setCalendarFilter(f.key)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  calendarFilter === f.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View mode */}
          <div className="flex items-center rounded-lg border bg-muted p-0.5">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize",
                  viewMode === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Calendar views */}
      {!loading && (
        <>
          {viewMode === "month" && renderMonthView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "day" && renderDayView()}
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Create / Edit Event Dialog */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editMode ? "Edit Event" : "New Event"}</DialogTitle>
            <DialogDescription>
              {editMode ? "Update the event details below." : "Fill in the details to create a new calendar event."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>

            {/* All day toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="all-day"
                checked={formAllDay}
                onCheckedChange={setFormAllDay}
              />
              <Label htmlFor="all-day" className="text-sm">All day</Label>
            </div>

            {/* Date/time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </div>
              {!formAllDay && (
                <div className="grid gap-1.5">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                />
              </div>
              {!formAllDay && (
                <div className="grid gap-1.5">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Event type */}
            <div className="grid gap-1.5">
              <Label>Event Type</Label>
              <Select value={formEventType} onValueChange={setFormEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea
                id="event-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <Separator />

            {/* Link to records */}
            <p className="text-xs font-medium text-muted-foreground">Link to record (optional)</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Deal</Label>
                <Select value={formDealId} onValueChange={setFormDealId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Contact</Label>
                <Select value={formContactId} onValueChange={setFormContactId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Account</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Contract</Label>
                <Select value={formContractId} onValueChange={setFormContractId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contracts.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editMode ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
