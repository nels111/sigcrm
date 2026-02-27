"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface DuplicateMatch {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  leadStatus: string;
  assignee: { id: string; name: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const INDUSTRY_OPTIONS = [
  { value: "PBSA", label: "PBSA" },
  { value: "PostConstruction", label: "Post Construction" },
  { value: "BioHazard", label: "Bio Hazard" },
  { value: "Industrial", label: "Industrial" },
  { value: "CommercialOffices", label: "Commercial Offices" },
  { value: "CareSector", label: "Care Sector" },
  { value: "School", label: "School" },
  { value: "Leisure", label: "Leisure" },
  { value: "CommercialGeneral", label: "Commercial (General)" },
  { value: "DentalMedical", label: "Dental/Medical" },
  { value: "HospitalityVenue", label: "Hospitality/Venue" },
  { value: "WelfareConstruction", label: "Welfare/Construction" },
];

const SOURCE_OPTIONS = [
  { value: "LandingPage", label: "Landing Page" },
  { value: "ColdCall", label: "Cold Call" },
  { value: "Referral", label: "Referral" },
  { value: "NetworkEvent", label: "Network Event" },
  { value: "ApolloAI", label: "Apollo AI" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Facebook", label: "Facebook" },
  { value: "XTwitter", label: "X (Twitter)" },
  { value: "WebResearch", label: "Web Research" },
  { value: "Chat", label: "Chat" },
  { value: "GoogleAds", label: "Google Ads" },
  { value: "Seminar", label: "Seminar" },
  { value: "TradeShow", label: "Trade Show" },
  { value: "QuickCapture", label: "Quick Capture" },
  { value: "QuoteForm", label: "Quote Form" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadFormDialog({ open, onOpenChange, onSuccess }: LeadFormDialogProps) {
  const { toast } = useToast();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [leadSource, setLeadSource] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  function resetForm() {
    setCompanyName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setAddress("");
    setIndustry("");
    setLeadSource("");
    setDuplicates([]);
    setShowDuplicateWarning(false);
  }

  function handleClose(value: boolean) {
    if (!value) resetForm();
    onOpenChange(value);
  }

  async function handleSubmit(force = false) {
    if (!companyName.trim() || !contactName.trim()) {
      toast({
        title: "Validation Error",
        description: "Company Name and Contact Name are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string | boolean> = {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
      };

      if (contactEmail.trim()) payload.contactEmail = contactEmail.trim();
      if (contactPhone.trim()) payload.contactPhone = contactPhone.trim();
      if (address.trim()) payload.address = address.trim();
      if (industry) payload.industry = industry;
      if (leadSource) payload.leadSource = leadSource;
      if (force) payload.force = true;

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.status === 409 && json.duplicateFound) {
        setDuplicates(json.matches || []);
        setShowDuplicateWarning(true);
        return;
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to create lead");
      }

      toast({ title: "Lead Created", description: `${companyName} has been added.` });
      resetForm();
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create lead.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Enter the details for the new lead. Company name and contact name are required.
          </DialogDescription>
        </DialogHeader>

        {/* Duplicate warning */}
        {showDuplicateWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Potential Duplicate{duplicates.length > 1 ? "s" : ""} Found
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  The following existing lead{duplicates.length > 1 ? "s" : ""} match your entry:
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="rounded border border-amber-200 bg-white p-2.5 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dup.companyName}</span>
                    <span className="text-xs text-muted-foreground">
                      {dup.leadStatus.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dup.contactName}
                    {dup.contactEmail ? ` - ${dup.contactEmail}` : ""}
                    {dup.assignee ? ` (Assigned to ${dup.assignee.name})` : ""}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setShowDuplicateWarning(false)}
              >
                Go Back & Edit
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Create Anyway
              </Button>
            </div>
          </div>
        )}

        {/* Form fields */}
        {!showDuplicateWarning && (
          <div className="grid gap-4 py-2">
            {/* Company Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="companyName" className="text-sm">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>

            {/* Contact Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="contactName" className="text-sm">
                Contact Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
              />
            </div>

            {/* Email & Phone side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="contactEmail" className="text-sm">
                  Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="john@acme.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactPhone" className="text-sm">
                  Phone
                </Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="07700 900000"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-1.5">
              <Label htmlFor="address" className="text-sm">
                Address
              </Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 High Street, London"
              />
            </div>

            {/* Industry & Source side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Lead Source</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showDuplicateWarning && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit()} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Lead
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
