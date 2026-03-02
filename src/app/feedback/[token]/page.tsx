"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Star } from "lucide-react";

interface FeedbackInfo {
  alreadySubmitted: boolean;
  contractName: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

function StarRating({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="focus:outline-none"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                i < value
                  ? "text-amber-400 fill-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        <span className="text-sm text-muted-foreground ml-2 self-center">
          {value > 0 ? `${value}/${max}` : ""}
        </span>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const params = useParams();
  const token = params.token as string;

  const [info, setInfo] = useState<FeedbackInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [overallRating, setOverallRating] = useState(0);
  const [cleaningQuality, setCleaningQuality] = useState(0);
  const [staffBehaviour, setStaffBehaviour] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);
  const [comments, setComments] = useState("");

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/feedback/${token}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      const data = json.data as FeedbackInfo;
      setInfo(data);
      if (data.alreadySubmitted) setSubmitted(true);
      if (data.contactName) setContactName(data.contactName);
      if (data.contactEmail) setContactEmail(data.contactEmail);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overallRating === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallRating,
          cleaningQuality: cleaningQuality || undefined,
          staffBehaviour: staffBehaviour || undefined,
          communication: communication || undefined,
          valueForMoney: valueForMoney || undefined,
          comments: comments.trim() || undefined,
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      // show basic error
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-lg font-semibold">Feedback link not found</p>
            <p className="text-sm text-muted-foreground mt-2">
              This feedback link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold">Thank You!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your feedback has been submitted successfully. We really appreciate you taking the time.
              </p>
            </div>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Signature Cleans
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Branding */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-emerald-700">
            Signature Cleans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Client Feedback Form
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              How are we doing?
            </CardTitle>
            {info?.contractName && (
              <p className="text-sm text-muted-foreground">
                Feedback for: <span className="font-medium">{info.contractName}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fb-name">Your Name</Label>
                  <Input
                    id="fb-name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-email">Your Email</Label>
                  <Input
                    id="fb-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Overall rating (1-10) */}
              <StarRating
                value={overallRating}
                max={10}
                onChange={setOverallRating}
                label="Overall Rating (1-10) *"
              />

              {/* Category ratings (1-5) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StarRating
                  value={cleaningQuality}
                  max={5}
                  onChange={setCleaningQuality}
                  label="Cleaning Quality"
                />
                <StarRating
                  value={staffBehaviour}
                  max={5}
                  onChange={setStaffBehaviour}
                  label="Staff Behaviour"
                />
                <StarRating
                  value={communication}
                  max={5}
                  onChange={setCommunication}
                  label="Communication"
                />
                <StarRating
                  value={valueForMoney}
                  max={5}
                  onChange={setValueForMoney}
                  label="Value for Money"
                />
              </div>

              {/* Comments */}
              <div className="space-y-1.5">
                <Label htmlFor="fb-comments">Comments</Label>
                <Textarea
                  id="fb-comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Any additional feedback or suggestions..."
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || overallRating === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Signature OS
        </p>
      </div>
    </div>
  );
}
