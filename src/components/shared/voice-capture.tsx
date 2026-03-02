"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CaptureType = "lead" | "task" | "note";

const CAPTURE_TYPES: { value: CaptureType; label: string }[] = [
  { value: "note", label: "Quick Note" },
  { value: "task", label: "New Task" },
  { value: "lead", label: "New Lead" },
];

export function VoiceCapture() {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [captureType, setCaptureType] = useState<CaptureType>("note");
  const [submitting, setSubmitting] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) {
        setTranscript(finalTranscript.trim());
        setDialogOpen(true);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript("");
  }, [toast]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  async function handleSubmit() {
    if (!transcript.trim()) return;
    setSubmitting(true);

    try {
      if (captureType === "note") {
        await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityType: "quick_capture",
            subject: "Voice note",
            body: transcript.trim(),
          }),
        });
        toast({ title: "Note saved" });
      } else if (captureType === "task") {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: transcript.trim().slice(0, 200),
            notes: transcript.trim(),
          }),
        });
        toast({ title: "Task created" });
      } else if (captureType === "lead") {
        // Extract company name from first part of transcript
        const text = transcript.trim();
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: text.slice(0, 100),
            notes: text,
            leadSource: "VoiceCapture",
          }),
        });
        toast({ title: "Lead created" });
      }

      setDialogOpen(false);
      setTranscript("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to save. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={listening ? stopListening : startListening}
        className={`fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all ${
          listening
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : "bg-emerald-600 hover:bg-emerald-700"
        }`}
        title={listening ? "Stop recording" : "Start voice capture"}
      >
        {listening ? (
          <MicOff className="h-5 w-5 text-white" />
        ) : (
          <Mic className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Live transcript indicator */}
      {listening && transcript && (
        <div className="fixed bottom-[88px] right-6 z-50 max-w-xs rounded-lg bg-black/80 px-3 py-2 text-white text-xs shadow-lg">
          <p className="line-clamp-2">{transcript}</p>
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Voice Capture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Save as</Label>
              <Select
                value={captureType}
                onValueChange={(v) => setCaptureType(v as CaptureType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transcript</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !transcript.trim()}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
