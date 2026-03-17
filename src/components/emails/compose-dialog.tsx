"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  inReplyTo?: string;
  dealId?: string;
  leadId?: string;
  accountId?: string;
  contactId?: string;
}

export function ComposeDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultTo = "",
  defaultSubject = "",
  inReplyTo,
  dealId,
  leadId,
  accountId,
  contactId,
}: ComposeDialogProps) {
  const { toast } = useToast();

  const [from, setFrom] = useState("nick");
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [fromOptions, setFromOptions] = useState<("nick" | "nelson" | "hello")[]>(["nick"]);

  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setCc("");
      setBcc("");
      setSubject(defaultSubject ? (inReplyTo ? `Re: ${defaultSubject}` : defaultSubject) : "");
      setBody("");
      setFrom("nick");

      // Load from options and templates
      Promise.all([
        fetch("/api/emails/mailboxes").then((res) =>
          res.ok ? res.json() : { mailboxes: ["nick", "hello"] }
        ),
        fetch("/api/email-templates?limit=50").then((res) =>
          res.ok ? res.json() : { data: [] }
        ),
      ])
        .then(([mailboxesData, templatesData]) => {
          setFromOptions(mailboxesData.mailboxes || ["nick", "hello"]);
          setTemplates(templatesData.data || []);
        })
        .catch(() => {
          setFromOptions(["nick", "hello"]);
        });
    }
  }, [open, defaultTo, defaultSubject, inReplyTo]);

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      // Replace merge fields
      let bodyText = template.bodyHtml.replace(/<[^>]*>/g, ""); // Strip HTML
      bodyText = bodyText.replace(/{{contact_name}}/g, "");
      bodyText = bodyText.replace(/{{company_name}}/g, "");
      bodyText = bodyText.replace(/{{calendly_link}}/g, "");
      setSubject(template.subject);
      setBody(bodyText);
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast({
        title: "Missing fields",
        description: "To, subject, and body are required.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          bodyHtml: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${body.replace(/\n/g, "<br>")}</div>`,
          bodyText: body,
          inReplyTo: inReplyTo || undefined,
          dealId: dealId || undefined,
          leadId: leadId || undefined,
          accountId: accountId || undefined,
          contactId: contactId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send");
      }

      toast({ title: "Email sent", description: `Email sent to ${to}` });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Failed to send email.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{inReplyTo ? "Reply" : "Compose Email"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fromOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "nick"
                        ? "Nick"
                        : option === "nelson"
                          ? "Nelson"
                          : "Hello"}
                      @
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Template</Label>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Quick insert..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="email-to">To *</Label>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email-cc">CC</Label>
              <Input
                id="email-cc"
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email-bcc">BCC</Label>
              <Input
                id="email-bcc"
                type="email"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email-body">Body *</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              className="mt-1 min-h-[200px]"
              rows={10}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
          >
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
