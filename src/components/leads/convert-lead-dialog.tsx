"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightCircle,
  Building2,
  CheckCircle2,
  Contact,
  Handshake,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConvertLeadDialogProps {
  lead: {
    id: string;
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    industry: string | null;
    leadStatus: string;
    engagementStage: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ConversionResult {
  account: { id: string; name: string };
  contact: { id: string; firstName: string | null; lastName: string };
  deal: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConvertLeadDialog({ lead, open, onOpenChange, onSuccess }: ConvertLeadDialogProps) {
  const { toast } = useToast();
  const [dealName, setDealName] = useState(`${lead.companyName} - New Deal`);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);

  function handleClose(value: boolean) {
    if (!value) {
      setResult(null);
      setDealName(`${lead.companyName} - New Deal`);
    }
    onOpenChange(value);
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealName: dealName.trim() || undefined }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Conversion failed");
      }

      setResult(json.data);
      toast({ title: "Lead Converted", description: "Account, Contact, and Deal created." });
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to convert lead.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {result ? (
          /* Success state */
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <DialogTitle>Lead Converted Successfully</DialogTitle>
              </div>
              <DialogDescription>
                The following records have been created from this lead.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Account */}
              <Link
                href={`/accounts/${result.account.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Account
                  </p>
                  <p className="text-sm font-medium">{result.account.name}</p>
                </div>
                <ArrowRightCircle className="h-4 w-4 text-muted-foreground" />
              </Link>

              {/* Contact */}
              <Link
                href={`/contacts/${result.contact.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Contact className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Contact
                  </p>
                  <p className="text-sm font-medium">
                    {result.contact.firstName} {result.contact.lastName}
                  </p>
                </div>
                <ArrowRightCircle className="h-4 w-4 text-muted-foreground" />
              </Link>

              {/* Deal */}
              <Link
                href={`/pipeline?deal=${result.deal.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Handshake className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Deal
                  </p>
                  <p className="text-sm font-medium">{result.deal.name}</p>
                </div>
                <ArrowRightCircle className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          /* Confirmation state */
          <>
            <DialogHeader>
              <DialogTitle>Convert Lead to Deal</DialogTitle>
              <DialogDescription>
                This will create an Account, Contact, and Deal from this lead&apos;s information.
              </DialogDescription>
            </DialogHeader>

            {/* Lead summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{lead.companyName}</h3>
                <Badge
                  variant="outline"
                  className="text-[11px]"
                >
                  {lead.leadStatus.replace(/([A-Z])/g, " $1").trim()}
                </Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Contact</p>
                  <p>{lead.contactName}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Email</p>
                  <p>{lead.contactEmail || "--"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p>{lead.contactPhone || "--"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Industry</p>
                  <p>{lead.industry ? lead.industry.replace(/([A-Z])/g, " $1").trim() : "--"}</p>
                </div>
              </div>
              {lead.address && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Address</p>
                    <p>{lead.address}</p>
                  </div>
                </>
              )}
            </div>

            {/* Deal name */}
            <div className="grid gap-1.5 py-1">
              <Label htmlFor="dealName" className="text-sm">
                Deal Name
              </Label>
              <Input
                id="dealName"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="Enter deal name"
              />
              <p className="text-xs text-muted-foreground">
                This will be the name of the new deal in your pipeline.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={converting}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {converting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightCircle className="h-4 w-4" />
                )}
                Convert Lead
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
