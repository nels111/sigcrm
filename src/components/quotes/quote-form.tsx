"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Download,
  Loader2,
  PoundSterling,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { calculateQuote } from "@/lib/quote-calculator";
import type { QuoteCalculation } from "@/lib/quote-calculator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SITE_TYPE_OPTIONS = [
  { value: "OfficeCommercial", label: "Office/Commercial" },
  { value: "WelfareConstruction", label: "Welfare/Construction" },
  { value: "HospitalityVenue", label: "Hospitality/Venue" },
  { value: "EducationInstitutional", label: "Education/Institutional" },
  { value: "SpecialistIndustrial", label: "Specialist/Industrial" },
  { value: "DentalMedical", label: "Dental/Medical" },
];

const FREQUENCY_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i === 0 ? "day" : "days"} per week`,
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormState {
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  hoursPerDay: string;
  frequencyPerWeek: string;
  daysSelected: string[];
  siteType: string;
  marginPercent: string;
  productCostWeekly: string;
  overheadCostWeekly: string;
  applyPilotPricing: boolean;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

interface SuccessData {
  quoteRef: string;
  quoteId: string;
  dealId?: string;
  leadId?: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  monthlyTotal: number;
  annualTotal: number;
  grossMarginPercent: number;
  frequency: string;
  applyPilotPricing: boolean;
  pilotMonthlyTotal: number | null;
  standardMonthlyTotal: number | null;
}

interface ExistingLeadMatch {
  id: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  leadStatus: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuoteForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    companyName: "",
    address: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    hoursPerDay: "",
    frequencyPerWeek: "",
    daysSelected: [],
    siteType: "",
    marginPercent: "43.33",
    productCostWeekly: "0",
    overheadCostWeekly: "0",
    applyPilotPricing: false,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [existingLeads, setExistingLeads] = useState<ExistingLeadMatch[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const leadSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search for existing leads when company name changes
  useEffect(() => {
    if (leadSearchTimer.current) clearTimeout(leadSearchTimer.current);
    const name = form.companyName.trim();
    if (name.length < 3) {
      setExistingLeads([]);
      setSelectedLeadId(null);
      return;
    }
    setLeadSearching(true);
    leadSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(name)}&limit=5`
        );
        if (res.ok) {
          const json = await res.json();
          setExistingLeads(json.data || []);
        }
      } catch {
        // ignore
      } finally {
        setLeadSearching(false);
      }
    }, 500);
    return () => {
      if (leadSearchTimer.current) clearTimeout(leadSearchTimer.current);
    };
  }, [form.companyName]);

  // ── Field updater ──
  const updateField = useCallback(
    (field: keyof FormState, value: string | string[] | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      setErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    []
  );

  // ── Day toggle ──
  const toggleDay = useCallback(
    (day: string) => {
      setForm((prev) => {
        const current = prev.daysSelected;
        const next = current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day];
        return { ...prev, daysSelected: next };
      });
      setErrors((prev) => {
        if (prev.daysSelected) {
          const next = { ...prev };
          delete next.daysSelected;
          return next;
        }
        return prev;
      });
    },
    []
  );

  // ── Live calculation ──
  const calculation: QuoteCalculation | null = useMemo(() => {
    const hoursPerDay = parseFloat(form.hoursPerDay);
    const frequencyPerWeek = parseInt(form.frequencyPerWeek, 10);
    const marginPercent = parseFloat(form.marginPercent);

    if (
      !form.companyName ||
      isNaN(hoursPerDay) ||
      hoursPerDay <= 0 ||
      isNaN(frequencyPerWeek) ||
      frequencyPerWeek <= 0 ||
      isNaN(marginPercent) ||
      marginPercent <= 0 ||
      marginPercent >= 100
    ) {
      return null;
    }

    return calculateQuote({
      companyName: form.companyName,
      address: form.address,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      hoursPerDay,
      frequencyPerWeek,
      daysSelected: form.daysSelected,
      siteType: form.siteType as import("@prisma/client").SiteType,
      marginPercent,
      productCostWeekly: parseFloat(form.productCostWeekly) || 0,
      overheadCostWeekly: parseFloat(form.overheadCostWeekly) || 0,
      applyPilotPricing: form.applyPilotPricing,
    });
  }, [form]);

  // ── Pricing guardrails ──
  const hasFloorRateError =
    calculation && calculation.impliedSellRate < 25 && calculation.impliedSellRate > 0;
  const hasMarginError =
    calculation && calculation.grossMarginPercent < 25 && calculation.grossMarginPercent > 0;
  const hasAmberWarning =
    calculation &&
    calculation.impliedSellRate >= 25 &&
    calculation.impliedSellRate < 27;
  const isBlocked = Boolean(hasMarginError);

  // ── Validation ──
  function validate(): boolean {
    const newErrors: FieldErrors = {};

    if (!form.companyName.trim()) newErrors.companyName = "Company name is required.";
    if (!form.address.trim()) newErrors.address = "Address is required.";
    if (!form.contactName.trim()) newErrors.contactName = "Contact name is required.";
    if (!form.contactEmail.trim()) {
      newErrors.contactEmail = "Contact email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      newErrors.contactEmail = "Please enter a valid email address.";
    }

    const hours = parseFloat(form.hoursPerDay);
    if (!form.hoursPerDay || isNaN(hours) || hours <= 0) {
      newErrors.hoursPerDay = "Hours per day must be greater than 0.";
    }

    if (!form.frequencyPerWeek) {
      newErrors.frequencyPerWeek = "Frequency per week is required.";
    }

    if (form.daysSelected.length === 0) {
      newErrors.daysSelected = "Select at least one day.";
    }

    if (!form.siteType) {
      newErrors.siteType = "Site type is required.";
    }

    const margin = parseFloat(form.marginPercent);
    if (!form.marginPercent || isNaN(margin) || margin <= 0 || margin >= 100) {
      newErrors.marginPercent = "Margin must be between 0 and 100.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }

    if (isBlocked) {
      toast({
        title: "Quote Blocked",
        description: "Margin is below the minimum threshold. This quote cannot be submitted.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        companyName: form.companyName.trim(),
        address: form.address.trim(),
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim() || undefined,
        hoursPerDay: parseFloat(form.hoursPerDay),
        frequencyPerWeek: parseInt(form.frequencyPerWeek, 10),
        daysSelected: form.daysSelected,
        siteType: form.siteType,
        marginPercent: parseFloat(form.marginPercent),
        productCostWeekly: parseFloat(form.productCostWeekly) || 0,
        overheadCostWeekly: parseFloat(form.overheadCostWeekly) || 0,
        applyPilotPricing: form.applyPilotPricing,
      };

      // Link to existing lead if user selected one
      if (selectedLeadId) {
        payload.existingLeadId = selectedLeadId;
      }

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create quote");
      }

      const json = await res.json();
      const quoteData = json.data.quote || json.data;
      const freq = `${form.frequencyPerWeek}x per week (${form.daysSelected.join(", ")}), ${form.hoursPerDay} hours per visit`;
      setSuccessData({
        quoteRef: quoteData.quoteRef,
        quoteId: quoteData.id,
        dealId: quoteData.dealId || json.data.linkedRecords?.dealId,
        leadId: quoteData.leadId || json.data.linkedRecords?.leadId,
        companyName: form.companyName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        monthlyTotal: calculation?.monthlyTotal ?? 0,
        annualTotal: calculation?.annualTotal ?? 0,
        grossMarginPercent: calculation?.grossMarginPercent ?? 0,
        frequency: freq,
        applyPilotPricing: form.applyPilotPricing,
        pilotMonthlyTotal: calculation?.pilot?.pilotMonthlyTotal ?? null,
        standardMonthlyTotal: form.applyPilotPricing ? (calculation?.monthlyTotal ?? null) : null,
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create quote.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/quotes")}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Quote</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create a cleaning services quote for a client.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column -- form fields (3/5) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Company & Contact */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Company & Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">
                    Company Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. Acme Holdings Ltd"
                    value={form.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    className={errors.companyName ? "border-red-400" : ""}
                  />
                  {errors.companyName && (
                    <p className="text-xs text-red-600">{errors.companyName}</p>
                  )}
                  {/* Existing lead matches */}
                  {leadSearching && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Search className="h-3 w-3 animate-pulse" />
                      Checking for existing leads...
                    </p>
                  )}
                  {!leadSearching && existingLeads.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Existing lead(s) found matching this company
                      </p>
                      {existingLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className={`flex items-center justify-between rounded-md border p-2 text-xs cursor-pointer transition-colors ${
                            selectedLeadId === lead.id
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-amber-200 bg-white hover:bg-amber-50/50"
                          }`}
                          onClick={() =>
                            setSelectedLeadId(
                              selectedLeadId === lead.id ? null : lead.id
                            )
                          }
                        >
                          <div>
                            <span className="font-medium">
                              {lead.companyName}
                            </span>
                            {lead.contactName && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {lead.contactName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {lead.leadStatus.replace(/([A-Z])/g, " $1").trim()}
                            </Badge>
                            {selectedLeadId === lead.id ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <span className="text-[10px] text-amber-700">
                                Click to link
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedLeadId && (
                        <p className="text-[10px] text-emerald-700">
                          Quote will be linked to this existing lead instead of
                          creating a new one.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address">
                    Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="address"
                    placeholder="Full site address"
                    rows={3}
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className={errors.address ? "border-red-400" : ""}
                  />
                  {errors.address && (
                    <p className="text-xs text-red-600">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contactName">
                      Contact Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="contactName"
                      placeholder="e.g. John Smith"
                      value={form.contactName}
                      onChange={(e) =>
                        updateField("contactName", e.target.value)
                      }
                      className={errors.contactName ? "border-red-400" : ""}
                    />
                    {errors.contactName && (
                      <p className="text-xs text-red-600">
                        {errors.contactName}
                      </p>
                    )}
                  </div>

                  {/* Contact Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contactEmail">
                      Contact Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="john@acme.co.uk"
                      value={form.contactEmail}
                      onChange={(e) =>
                        updateField("contactEmail", e.target.value)
                      }
                      className={errors.contactEmail ? "border-red-400" : ""}
                    />
                    {errors.contactEmail && (
                      <p className="text-xs text-red-600">
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact Phone */}
                <div className="space-y-1.5 sm:max-w-[50%]">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    placeholder="07xxx xxxxxx"
                    value={form.contactPhone}
                    onChange={(e) =>
                      updateField("contactPhone", e.target.value)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Service Specification */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Service Specification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hours Per Day */}
                  <div className="space-y-1.5">
                    <Label htmlFor="hoursPerDay">
                      Hours Per Day <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="hoursPerDay"
                      type="number"
                      step="0.5"
                      min="0.5"
                      placeholder="e.g. 3"
                      value={form.hoursPerDay}
                      onChange={(e) =>
                        updateField("hoursPerDay", e.target.value)
                      }
                      className={errors.hoursPerDay ? "border-red-400" : ""}
                    />
                    {errors.hoursPerDay && (
                      <p className="text-xs text-red-600">
                        {errors.hoursPerDay}
                      </p>
                    )}
                  </div>

                  {/* Frequency Per Week */}
                  <div className="space-y-1.5">
                    <Label htmlFor="frequencyPerWeek">
                      Frequency Per Week <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.frequencyPerWeek}
                      onValueChange={(val) =>
                        updateField("frequencyPerWeek", val)
                      }
                    >
                      <SelectTrigger
                        id="frequencyPerWeek"
                        className={
                          errors.frequencyPerWeek ? "border-red-400" : ""
                        }
                      >
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.frequencyPerWeek && (
                      <p className="text-xs text-red-600">
                        {errors.frequencyPerWeek}
                      </p>
                    )}
                  </div>
                </div>

                {/* Days Selected */}
                <div className="space-y-2">
                  <Label>
                    On Which Days? <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    {DAYS_OF_WEEK.map((day) => (
                      <label
                        key={day}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={form.daysSelected.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                        />
                        <span className="text-sm">{day.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                  {errors.daysSelected && (
                    <p className="text-xs text-red-600">
                      {errors.daysSelected}
                    </p>
                  )}
                </div>

                {/* Site Type */}
                <div className="space-y-1.5">
                  <Label htmlFor="siteType">
                    Site Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.siteType}
                    onValueChange={(val) => updateField("siteType", val)}
                  >
                    <SelectTrigger
                      id="siteType"
                      className={errors.siteType ? "border-red-400" : ""}
                    >
                      <SelectValue placeholder="Select site type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.siteType && (
                    <p className="text-xs text-red-600">{errors.siteType}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Margin */}
                  <div className="space-y-1.5">
                    <Label htmlFor="marginPercent">
                      Margin % <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="marginPercent"
                      type="number"
                      step="0.01"
                      min="1"
                      max="99"
                      value={form.marginPercent}
                      onChange={(e) =>
                        updateField("marginPercent", e.target.value)
                      }
                      className={errors.marginPercent ? "border-red-400" : ""}
                    />
                    {errors.marginPercent && (
                      <p className="text-xs text-red-600">
                        {errors.marginPercent}
                      </p>
                    )}
                  </div>

                  {/* Product Cost */}
                  <div className="space-y-1.5">
                    <Label htmlFor="productCostWeekly">
                      Product Cost (Weekly) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="productCostWeekly"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.productCostWeekly}
                      onChange={(e) =>
                        updateField("productCostWeekly", e.target.value)
                      }
                    />
                  </div>

                  {/* Overhead Cost */}
                  <div className="space-y-1.5">
                    <Label htmlFor="overheadCostWeekly">
                      Overhead Cost (Weekly) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="overheadCostWeekly"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.overheadCostWeekly}
                      onChange={(e) =>
                        updateField("overheadCostWeekly", e.target.value)
                      }
                    />
                  </div>
                </div>

                {/* Pilot Pricing Toggle */}
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="pilotPricing"
                      className="text-sm font-medium"
                    >
                      Apply Pilot Pricing
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      25% off for 30 days to get the client started.
                    </p>
                  </div>
                  <Switch
                    id="pilotPricing"
                    checked={form.applyPilotPricing}
                    onCheckedChange={(checked) =>
                      updateField("applyPilotPricing", checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing Guardrails */}
            {calculation && (hasFloorRateError || hasMarginError || hasAmberWarning) && (
              <div className="space-y-3">
                {hasMarginError && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        Margin below minimum threshold (25%)
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Current gross margin is{" "}
                        {calculation.grossMarginPercent.toFixed(1)}%. Quote
                        submission is blocked.
                      </p>
                    </div>
                  </div>
                )}
                {hasFloorRateError && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
                    <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        Rate below floor ({"\u00A3"}25/hr)
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        Current implied sell rate is{" "}
                        {"\u00A3"}
                        {calculation.impliedSellRate.toFixed(2)}/hr.
                        Requires admin approval.
                      </p>
                    </div>
                  </div>
                )}
                {hasAmberWarning && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Below target rate of {"\u00A3"}27/hr
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Current implied sell rate is{" "}
                        {"\u00A3"}
                        {calculation.impliedSellRate.toFixed(2)}/hr.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting || isBlocked}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Quote...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Quote
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/quotes")}
              >
                Cancel
              </Button>
            </div>
          </div>

          {/* Right column -- live calculation preview (2/5) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-6 space-y-4">
              <Card
                className={
                  calculation
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-dashed"
                }
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Live Calculation Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!calculation ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        Fill in the service details to see a live pricing preview.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Cost Breakdown */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                          Cost Breakdown
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Weekly Labour Cost
                            </span>
                            <span className="font-medium">
                              {formatGBP(calculation.weeklyLabourCost)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Total Weekly Spend
                            </span>
                            <span className="font-medium">
                              {formatGBP(calculation.totalWeeklySpend)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Weekly Charge (client pays)
                            </span>
                            <span className="font-medium">
                              {formatGBP(calculation.weeklyCharge)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Client Totals */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                          Client Totals
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 rounded-lg bg-emerald-100 border border-emerald-200">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                              Monthly
                            </p>
                            <p className="text-lg font-bold text-emerald-800">
                              {formatGBP(calculation.monthlyTotal)}
                            </p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-emerald-100 border border-emerald-200">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                              Annual
                            </p>
                            <p className="text-lg font-bold text-emerald-800">
                              {formatGBP(calculation.annualTotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Profit */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                          Profit
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Weekly Profit
                            </span>
                            <span className="font-medium text-emerald-700">
                              {formatGBP(calculation.weeklyProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Monthly Profit
                            </span>
                            <span className="font-medium text-emerald-700">
                              {formatGBP(calculation.monthlyProfit)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Rates & Margin */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                          Rates & Margin
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Implied Sell Rate
                            </span>
                            <span
                              className={`font-medium ${
                                calculation.impliedSellRate < 25
                                  ? "text-red-600"
                                  : calculation.impliedSellRate < 27
                                  ? "text-amber-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {"\u00A3"}
                              {calculation.impliedSellRate.toFixed(2)}/hr
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Gross Margin
                            </span>
                            <span
                              className={`font-medium ${
                                calculation.grossMarginPercent < 25
                                  ? "text-red-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {calculation.grossMarginPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pilot Pricing Section */}
                      {calculation.pilot && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                              Pilot Pricing (30 days)
                            </p>
                            <div className="space-y-1.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Pilot Monthly Total
                                </span>
                                <span className="font-medium text-blue-700">
                                  {formatGBP(
                                    calculation.pilot.pilotMonthlyTotal
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Standard Monthly Total
                                </span>
                                <span className="font-medium">
                                  {formatGBP(calculation.monthlyTotal)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  Pilot Savings
                                </span>
                                <span className="font-medium text-blue-700">
                                  {formatGBP(calculation.pilot.pilotSavings)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>

      {/* Quote Preview Sheet */}
      <QuotePreviewSheet
        data={successData}
        onClose={() => setSuccessData(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Quote Preview Sheet (side drawer after quote creation)
// ---------------------------------------------------------------------------

function QuotePreviewSheet({
  data,
  onClose,
}: {
  data: SuccessData | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [sending, setSending] = useState(false);

  if (!data) return <Sheet open={false}><SheetContent><SheetHeader><SheetTitle /></SheetHeader></SheetContent></Sheet>;

  async function handleSend() {
    if (!data) return;
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${data.quoteId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to send quote");
      }
      toast({
        title: "Quote Sent",
        description: `Quote sent to ${data.contactName} at ${data.contactEmail}`,
      });
      onClose();
      router.push("/quotes");
      router.refresh();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to send quote.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={data !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <SheetTitle>Quote Created</SheetTitle>
          </div>
          <SheetDescription>
            Review and send to your prospect, or save as draft.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Quote Details */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quote Ref</span>
              <span className="font-mono font-medium">{data.quoteRef}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium">{data.companyName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contact</span>
              <span className="font-medium">{data.contactName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-emerald-600">{data.contactEmail}</span>
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div className="space-y-3">
            <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
                Monthly Total
              </p>
              <p className="text-2xl font-bold text-emerald-700">
                {formatGBP(data.monthlyTotal)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Annual Total
                </p>
                <p className="text-lg font-bold">{formatGBP(data.annualTotal)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  Gross Margin
                </p>
                <p className={`text-lg font-bold ${data.grossMarginPercent < 25 ? "text-red-600" : "text-emerald-700"}`}>
                  {data.grossMarginPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div className="text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
              Frequency
            </p>
            <p>{data.frequency}</p>
          </div>

          {/* Pilot Pricing */}
          {data.applyPilotPricing && data.pilotMonthlyTotal != null && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Pilot Pricing (30 days)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <p className="text-[10px] uppercase tracking-wide text-blue-700 font-medium">
                      Pilot Price
                    </p>
                    <p className="text-lg font-bold text-blue-800">
                      {formatGBP(data.pilotMonthlyTotal)}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white border border-blue-200">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Standard Price
                    </p>
                    <p className="text-lg font-bold">
                      {formatGBP(data.standardMonthlyTotal ?? data.monthlyTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() =>
                window.open(`/api/quotes/${data.quoteId}/pdf`, "_blank")
              }
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>

            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={sending}
              onClick={handleSend}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to Prospect
            </Button>

            <Button
              className="w-full gap-2"
              variant="ghost"
              onClick={() => {
                onClose();
                router.push("/quotes");
              }}
            >
              Save as Draft
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
