"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  dealId?: string;
  leadId?: string;
  accountId?: string;
  contractId?: string;
  contactId?: string;
  defaultTitle?: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSuccess,
  dealId,
  leadId,
  accountId,
  contractId,
  contactId,
  defaultTitle = "",
}: CreateTaskDialogProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const currentUser = session?.user as { id?: string; name?: string } | undefined;

  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setIsRecurring(false);
      setRecurrenceRule("");

      // Fetch users for assignee dropdown
      if (users.length === 0) {
        setLoading(true);
        fetch("/api/users")
          .then((res) => res.json())
          .then((json) => {
            const userList = json.data || json;
            setUsers(Array.isArray(userList) ? userList : []);
            if (currentUser?.id) {
              setAssignedTo(currentUser.id);
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else if (currentUser?.id) {
        setAssignedTo(currentUser.id);
      }
    }
  }, [open, defaultTitle, currentUser?.id, users.length]);

  async function handleSubmit() {
    if (!title.trim() || !assignedTo) {
      toast({
        title: "Missing fields",
        description: "Title and assignee are required.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo,
          createdBy: currentUser?.id,
          priority,
          dueDate: dueDate || undefined,
          dealId: dealId || undefined,
          leadId: leadId || undefined,
          accountId: accountId || undefined,
          contractId: contractId || undefined,
          contactId: contactId || undefined,
          isRecurring,
          recurrenceRule: isRecurring ? recurrenceRule || undefined : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      toast({ title: "Task created", description: `"${title}" has been created.` });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Create a new task{dealId ? " linked to this deal" : leadId ? " linked to this lead" : contractId ? " linked to this contract" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assigned To *</Label>
              {loading ? (
                <div className="flex items-center gap-2 mt-1 h-9 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : (
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="task-due-date">Due Date</Label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="task-recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked === true)}
            />
            <Label htmlFor="task-recurring" className="text-sm font-normal">
              Recurring task
            </Label>
          </div>

          {isRecurring && (
            <div>
              <Label>Recurrence</Label>
              <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !assignedTo}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
