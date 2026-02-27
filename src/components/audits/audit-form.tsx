"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Star,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  contractName: string;
}

interface GeneralStandards {
  reception: number;
  offices: number;
  toilets: number;
  kitchen: number;
  corridors: number;
  stairs: number;
  meetingRooms: number;
  external: number;
  specialistAreas: number;
  overallImpression: number;
}

interface StaffPerformance {
  punctuality: number;
  uniformCompliance: number;
  checklistAdherence: number;
  communication: number;
  initiative: number;
}

interface HsCompliance {
  ppeWorn: number;
  wetFloorSigns: number;
  coshhSheets: number;
  equipmentCondition: number;
  incidentReporting: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENERAL_STANDARDS_FIELDS: { key: keyof GeneralStandards; label: string }[] = [
  { key: "reception", label: "Reception" },
  { key: "offices", label: "Offices" },
  { key: "toilets", label: "Toilets" },
  { key: "kitchen", label: "Kitchen" },
  { key: "corridors", label: "Corridors" },
  { key: "stairs", label: "Stairs" },
  { key: "meetingRooms", label: "Meeting Rooms" },
  { key: "external", label: "External" },
  { key: "specialistAreas", label: "Specialist Areas" },
  { key: "overallImpression", label: "Overall Impression" },
];

const STAFF_PERFORMANCE_FIELDS: { key: keyof StaffPerformance; label: string }[] = [
  { key: "punctuality", label: "Punctuality" },
  { key: "uniformCompliance", label: "Uniform Compliance" },
  { key: "checklistAdherence", label: "Checklist Adherence" },
  { key: "communication", label: "Communication" },
  { key: "initiative", label: "Initiative" },
];

const HS_COMPLIANCE_FIELDS: { key: keyof HsCompliance; label: string }[] = [
  { key: "ppeWorn", label: "PPE Worn" },
  { key: "wetFloorSigns", label: "Wet Floor Signs" },
  { key: "coshhSheets", label: "COSHH Sheets" },
  { key: "equipmentCondition", label: "Equipment Condition" },
  { key: "incidentReporting", label: "Incident Reporting" },
];

const DEFAULT_GENERAL: GeneralStandards = {
  reception: 0,
  offices: 0,
  toilets: 0,
  kitchen: 0,
  corridors: 0,
  stairs: 0,
  meetingRooms: 0,
  external: 0,
  specialistAreas: 0,
  overallImpression: 0,
};

const DEFAULT_STAFF: StaffPerformance = {
  punctuality: 0,
  uniformCompliance: 0,
  checklistAdherence: 0,
  communication: 0,
  initiative: 0,
};

const DEFAULT_HS: HsCompliance = {
  ppeWorn: 0,
  wetFloorSigns: 0,
  coshhSheets: 0,
  equipmentCondition: 0,
  incidentReporting: 0,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RatingButtonGroup({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "h-9 w-9 rounded-md text-sm font-medium transition-all border",
            value === n
              ? n >= 4
                ? "bg-emerald-600 text-white border-emerald-600"
                : n === 3
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-red-500 text-white border-red-500"
              : "bg-background text-muted-foreground border-input hover:bg-muted"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30 hover:text-amber-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ScorePreview({ score }: { score: number }) {
  let label = "Not Started";
  let colorClass = "text-muted-foreground bg-muted";

  if (score > 0) {
    if (score >= 90) {
      label = "Excellent";
      colorClass = "text-emerald-700 bg-emerald-50 border-emerald-200";
    } else if (score >= 80) {
      label = "Good";
      colorClass = "text-blue-700 bg-blue-50 border-blue-200";
    } else if (score >= 70) {
      label = "Acceptable";
      colorClass = "text-amber-700 bg-amber-50 border-amber-200";
    } else {
      label = "Needs Attention";
      colorClass = "text-red-700 bg-red-50 border-red-200";
    }
  }

  return (
    <div className={cn("rounded-lg border p-4 text-center", colorClass)}>
      <p className="text-3xl font-bold">
        {score > 0 ? `${score.toFixed(1)}%` : "--"}
      </p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AuditForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [contractId, setContractId] = useState("");
  const [generalStandards, setGeneralStandards] = useState<GeneralStandards>({ ...DEFAULT_GENERAL });
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance>({ ...DEFAULT_STAFF });
  const [hsCompliance, setHsCompliance] = useState<HsCompliance>({ ...DEFAULT_HS });
  const [clientSatisfaction, setClientSatisfaction] = useState(0);
  const [clientFeedback, setClientFeedback] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch contracts
  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts?limit=100");
      if (res.ok) {
        const json = await res.json();
        setContracts(
          (json.data ?? []).map((c: ContractOption) => ({
            id: c.id,
            contractName: c.contractName,
          }))
        );
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contracts.",
        variant: "destructive",
      });
    } finally {
      setLoadingContracts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // Calculate live score
  const overallScore = useMemo(() => {
    const allScores = [
      ...Object.values(generalStandards),
      ...Object.values(staffPerformance),
      ...Object.values(hsCompliance),
    ];

    const ratedScores = allScores.filter((v) => v > 0);
    if (ratedScores.length === 0) return 0;

    const avg = ratedScores.reduce((sum, v) => sum + v, 0) / ratedScores.length;
    return Math.round(avg * 20 * 10) / 10; // scale 1-5 to 0-100
  }, [generalStandards, staffPerformance, hsCompliance]);

  // Check if all fields are rated
  const allFieldsRated = useMemo(() => {
    const allScores = [
      ...Object.values(generalStandards),
      ...Object.values(staffPerformance),
      ...Object.values(hsCompliance),
    ];
    return allScores.every((v) => v > 0);
  }, [generalStandards, staffPerformance, hsCompliance]);

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!contractId) {
      toast({
        title: "Validation Error",
        description: "Please select a contract.",
        variant: "destructive",
      });
      return;
    }

    if (!allFieldsRated) {
      toast({
        title: "Validation Error",
        description: "Please rate all areas before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          auditorId: undefined, // Will be set server-side or use first admin
          generalStandards,
          staffPerformance,
          hsCompliance,
          clientSatisfactionScore: clientSatisfaction > 0 ? clientSatisfaction : null,
          clientFeedback: clientFeedback || null,
          notes: notes || null,
          auditDate: new Date().toISOString(),
          photos: [],
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create audit");
      }

      toast({
        title: "Audit Created",
        description: `Audit submitted successfully with a score of ${overallScore.toFixed(1)}%.`,
      });

      router.push("/audits");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit audit.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/audits">
          <Button variant="ghost" size="icon" type="button" className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">New Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the digital audit form for a cleaning contract.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Form sections (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contract Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="contract">Select Contract</Label>
              {loadingContracts ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading contracts...
                </div>
              ) : (
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a contract..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* General Standards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Standards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {GENERAL_STANDARDS_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{label}</Label>
                  <RatingButtonGroup
                    value={generalStandards[key]}
                    onChange={(val) =>
                      setGeneralStandards((prev) => ({ ...prev, [key]: val }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Staff Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staff Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {STAFF_PERFORMANCE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{label}</Label>
                  <RatingButtonGroup
                    value={staffPerformance[key]}
                    onChange={(val) =>
                      setStaffPerformance((prev) => ({ ...prev, [key]: val }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* H&S Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">H&S Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {HS_COMPLIANCE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm font-normal">{label}</Label>
                  <RatingButtonGroup
                    value={hsCompliance[key]}
                    onChange={(val) =>
                      setHsCompliance((prev) => ({ ...prev, [key]: val }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Client Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Client Satisfaction</Label>
                <div className="mt-2">
                  <StarRating
                    value={clientSatisfaction}
                    onChange={setClientSatisfaction}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="clientFeedback" className="text-sm">
                  Feedback
                </Label>
                <Textarea
                  id="clientFeedback"
                  value={clientFeedback}
                  onChange={(e) => setClientFeedback(e.target.value)}
                  placeholder="Enter client feedback..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drag and drop photos here, or click to browse
                </p>
                <Button variant="outline" size="sm" type="button" className="mt-3">
                  Upload Photos
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or observations..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Score Preview (1/3), sticky */}
        <div className="space-y-6">
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Score Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScorePreview score={overallScore} />

                {/* Section breakdown */}
                <div className="space-y-3 pt-2">
                  <SectionScore
                    label="General Standards"
                    scores={Object.values(generalStandards)}
                  />
                  <SectionScore
                    label="Staff Performance"
                    scores={Object.values(staffPerformance)}
                  />
                  <SectionScore
                    label="H&S Compliance"
                    scores={Object.values(hsCompliance)}
                  />
                </div>

                {/* Progress indicator */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {Object.values(generalStandards).filter((v) => v > 0).length +
                      Object.values(staffPerformance).filter((v) => v > 0).length +
                      Object.values(hsCompliance).filter((v) => v > 0).length}{" "}
                    / 20 areas rated
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || !contractId || !allFieldsRated}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Audit"
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Section Score Sub-component
// ---------------------------------------------------------------------------

function SectionScore({
  label,
  scores,
}: {
  label: string;
  scores: number[];
}) {
  const rated = scores.filter((v) => v > 0);
  if (rated.length === 0) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">Not started</span>
      </div>
    );
  }

  const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
  const pct = Math.round(avg * 20 * 10) / 10;

  let colorClass = "text-red-600";
  if (pct >= 90) colorClass = "text-emerald-600";
  else if (pct >= 80) colorClass = "text-blue-600";
  else if (pct >= 70) colorClass = "text-amber-600";

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", colorClass)}>
        {pct.toFixed(1)}%
        <span className="text-xs text-muted-foreground ml-1">
          ({rated.length}/{scores.length})
        </span>
      </span>
    </div>
  );
}
