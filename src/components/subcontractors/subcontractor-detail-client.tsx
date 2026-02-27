"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, differenceInDays, isBefore, addDays } from "date-fns";
import {
  ArrowLeft,
  Building2,
  FileCheck,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubcontractorDetail {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  hourlyRate: string;
  supervisorRate: string | null;
  regions: string[];
  performanceScore: string;
  totalWeeklyHours: string;
  totalWeeklyHoursCalc: number;
  status: string;
  insuranceExpiry: string | null;
  dbsExpiry: string | null;
  dbsChecked: boolean;
  rightToWorkVerified: boolean;
  subcontractorAgreementSigned: boolean;
  notes: string | null;
  createdAt: string;
  contracts: Array<{
    id: string;
    contractName: string;
    weeklyHours: string;
    healthStatus: string;
    latestAuditScore: string;
    status: string;
    monthlyRevenue?: string;
  }>;
  auditScores: Array<{
    id: string;
    contractId: string;
    auditDate: string;
    overallScore: string;
    contract: { id: string; contractName: string };
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function docStatus(
  expiryDate: string | null
): { label: string; color: string } {
  if (!expiryDate)
    return { label: "Not Set", color: "bg-gray-100 text-gray-700 border-gray-200" };

  const now = new Date();
  const expiry = new Date(expiryDate);
  const thirtyDaysOut = addDays(now, 30);

  if (isBefore(expiry, now)) {
    return { label: "Expired", color: "bg-red-50 text-red-700 border-red-200" };
  }
  if (isBefore(expiry, thirtyDaysOut)) {
    const daysLeft = differenceInDays(expiry, now);
    return {
      label: `Expires in ${daysLeft}d`,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return { label: "Valid", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function healthBadge(status: string) {
  switch (status) {
    case "GREEN":
      return (
        <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
          GREEN
        </Badge>
      );
    case "AMBER":
      return (
        <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">
          AMBER
        </Badge>
      );
    case "RED":
      return (
        <Badge variant="outline" className="text-[11px] bg-red-50 text-red-700 border-red-200">
          RED
        </Badge>
      );
    default:
      return <span className="text-xs text-muted-foreground">--</span>;
  }
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubcontractorDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const subId = params.id as string;

  const [sub, setSub] = useState<SubcontractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editSupervisorRate, setEditSupervisorRate] = useState("");
  const [editRegions, setEditRegions] = useState("");
  const [editInsuranceExpiry, setEditInsuranceExpiry] = useState("");
  const [editDbsExpiry, setEditDbsExpiry] = useState("");
  const [editAgreementSigned, setEditAgreementSigned] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/subcontractors/${subId}`);
      if (!res.ok) throw new Error("Subcontractor not found");
      const json = await res.json();
      setSub(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [subId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  function openEdit() {
    if (!sub) return;
    setEditName(sub.contactName);
    setEditCompany(sub.companyName || "");
    setEditEmail(sub.email || "");
    setEditPhone(sub.phone || "");
    setEditHourlyRate(parseFloat(sub.hourlyRate).toString());
    setEditSupervisorRate(sub.supervisorRate ? parseFloat(sub.supervisorRate).toString() : "");
    setEditRegions(sub.regions.join(", "));
    setEditInsuranceExpiry(
      sub.insuranceExpiry
        ? format(new Date(sub.insuranceExpiry), "yyyy-MM-dd")
        : ""
    );
    setEditDbsExpiry(
      sub.dbsExpiry ? format(new Date(sub.dbsExpiry), "yyyy-MM-dd") : ""
    );
    setEditAgreementSigned(sub.subcontractorAgreementSigned);
    setEditNotes(sub.notes || "");
    setEditOpen(true);
  }

  async function handleEdit() {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/subcontractors/${subId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: editName.trim(),
          companyName: editCompany.trim() || null,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          hourlyRate: parseFloat(editHourlyRate),
          supervisorRate: editSupervisorRate
            ? parseFloat(editSupervisorRate)
            : null,
          regions: editRegions
            ? editRegions.split(",").map((r) => r.trim()).filter(Boolean)
            : [],
          insuranceExpiry: editInsuranceExpiry || null,
          dbsExpiry: editDbsExpiry || null,
          subcontractorAgreementSigned: editAgreementSigned,
          notes: editNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update");
      }

      toast({
        title: "Updated",
        description: "Subcontractor updated successfully.",
      });
      setEditOpen(false);
      fetchDetail();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Update failed.",
        variant: "destructive",
      });
    } finally {
      setEditSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading subcontractor...
        </div>
      </div>
    );
  }

  if (error || !sub) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "Not found"}</p>
        <Button variant="outline" onClick={() => router.push("/subcontractors")}>
          Back to Subcontractors
        </Button>
      </div>
    );
  }

  const insuranceStatus = docStatus(sub.insuranceExpiry);
  const dbsStatus = docStatus(sub.dbsExpiry);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/subcontractors")}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">
              {sub.contactName}
            </h1>
            <Badge variant="outline" className="capitalize">
              {sub.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sub.companyName || "Independent subcontractor"}
          </p>
        </div>
        <Button variant="outline" onClick={openEdit}>
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{sub.contactName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p className="font-medium">{sub.companyName || "--"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium">{sub.email || "--"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </p>
                  <p className="font-medium">{sub.phone || "--"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hourly Rate</p>
                  <p className="font-medium">
                    {"\u00A3"}{parseFloat(sub.hourlyRate).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Supervisor Rate</p>
                  <p className="font-medium">
                    {sub.supervisorRate
                      ? `\u00A3${parseFloat(sub.supervisorRate).toFixed(2)}`
                      : "--"}
                  </p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Regions
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sub.regions.length > 0 ? (
                      sub.regions.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">
                          {r}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No regions set
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Compliance Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Insurance */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Insurance</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.insuranceExpiry
                        ? `Expires: ${format(new Date(sub.insuranceExpiry), "dd MMM yyyy")}`
                        : "No expiry date set"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[11px]", insuranceStatus.color)}>
                    {insuranceStatus.label}
                  </Badge>
                </div>

                {/* DBS */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">DBS Check</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.dbsExpiry
                        ? `Expires: ${format(new Date(sub.dbsExpiry), "dd MMM yyyy")}`
                        : "No expiry date set"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[11px]", dbsStatus.color)}>
                    {dbsStatus.label}
                  </Badge>
                </div>

                {/* Agreement */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Subcontractor Agreement</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.subcontractorAgreementSigned
                        ? "Agreement signed"
                        : "Agreement not signed"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      sub.subcontractorAgreementSigned
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    )}
                  >
                    {sub.subcontractorAgreementSigned ? "Signed" : "Not Signed"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Contracts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Linked Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sub.contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No contracts linked to this subcontractor.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Contract</TableHead>
                      <TableHead className="text-xs text-right">Weekly Hours</TableHead>
                      <TableHead className="text-xs text-center">Health</TableHead>
                      <TableHead className="text-xs text-center">Audit Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sub.contracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">
                          {c.contractName}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {parseFloat(c.weeklyHours).toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-center">
                          {healthBadge(c.healthStatus)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              scoreColor(parseFloat(c.latestAuditScore))
                            )}
                          >
                            {parseFloat(c.latestAuditScore).toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT (1/3) */}
        <div className="space-y-6">
          {/* Performance Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Overall Score</p>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    scoreColor(parseFloat(sub.performanceScore))
                  )}
                >
                  {parseFloat(sub.performanceScore).toFixed(1)}%
                </p>
              </div>

              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  Total Weekly Hours
                </p>
                <p className="text-2xl font-bold">
                  {sub.totalWeeklyHoursCalc.toFixed(1)}h
                </p>
              </div>

              {/* Audit Scores by Site */}
              {sub.auditScores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Recent Audit Scores
                  </p>
                  <div className="space-y-2">
                    {sub.auditScores.slice(0, 8).map((audit) => (
                      <div
                        key={audit.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs">
                            {audit.contract.contractName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(audit.auditDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "font-medium ml-2",
                            scoreColor(parseFloat(audit.overallScore))
                          )}
                        >
                          {parseFloat(audit.overallScore).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Subcontractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Name *</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hourly Rate ({"\u00A3"})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editHourlyRate}
                  onChange={(e) => setEditHourlyRate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Supervisor Rate ({"\u00A3"})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editSupervisorRate}
                  onChange={(e) => setEditSupervisorRate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Regions (comma-separated)</Label>
              <Input
                value={editRegions}
                onChange={(e) => setEditRegions(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Insurance Expiry</Label>
                <Input
                  type="date"
                  value={editInsuranceExpiry}
                  onChange={(e) => setEditInsuranceExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>DBS Expiry</Label>
                <Input
                  type="date"
                  value={editDbsExpiry}
                  onChange={(e) => setEditDbsExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editAgreementSigned"
                checked={editAgreementSigned}
                onChange={(e) => setEditAgreementSigned(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="editAgreementSigned" className="text-sm font-normal">
                Subcontractor Agreement Signed
              </Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
