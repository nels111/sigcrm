"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Upload,
  Loader2,
  X,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Document {
  id: string;
  documentType: string;
  name: string;
  filePath: string;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  dealId: string | null;
  leadId: string | null;
  accountId: string | null;
  contractId: string | null;
  quoteId: string | null;
  createdBy: string | null;
  createdAt: string;
  deal?: { id: string; dealName: string } | null;
  lead?: { id: string; companyName: string } | null;
  account?: { id: string; name: string } | null;
  contract?: { id: string; contractName: string } | null;
  quote?: { id: string; quoteNumber: string } | null;
  creator?: { id: string; name: string } | null;
}

interface LinkedEntity {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Document type labels & badge colours
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "quote_pdf", label: "Quote PDF" },
  { value: "contract", label: "Contract" },
  { value: "site_pack", label: "Site Pack" },
  { value: "area_checklist", label: "Area Checklist" },
  { value: "hs_pack", label: "H&S Pack" },
  { value: "subcontractor_agreement", label: "Sub Agreement" },
  { value: "qbr_report", label: "QBR Report" },
  { value: "weekly_scorecard", label: "Scorecard" },
  { value: "audit_report", label: "Audit Report" },
  { value: "pitch_letter", label: "Pitch Letter" },
  { value: "client_welcome", label: "Welcome Pack" },
  { value: "other", label: "Other" },
];

function documentTypeLabel(value: string): string {
  return (
    DOCUMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function documentTypeBadgeClass(type: string): string {
  switch (type) {
    case "quote_pdf":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "contract":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "site_pack":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "area_checklist":
      return "bg-teal-100 text-teal-800 border-teal-200";
    case "hs_pack":
      return "bg-red-100 text-red-800 border-red-200";
    case "subcontractor_agreement":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "qbr_report":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "weekly_scorecard":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "audit_report":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "pitch_letter":
      return "bg-pink-100 text-pink-800 border-pink-200";
    case "client_welcome":
      return "bg-lime-100 text-lime-800 border-lime-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.includes("pdf")) return FileText;
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return FileSpreadsheet;
  if (mimeType.startsWith("image/")) return FileImage;
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  )
    return FileText;
  return File;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  try {
    return format(new Date(iso), "dd MMM yyyy");
  } catch {
    return "--";
  }
}

function getLinkedEntityName(doc: Document): string {
  if (doc.account) return doc.account.name;
  if (doc.contract) return doc.contract.contractName;
  if (doc.deal) return doc.deal.dealName;
  if (doc.lead) return doc.lead.companyName;
  if (doc.quote) return doc.quote.quoteNumber;
  return "--";
}

function getLinkedEntityType(doc: Document): string | null {
  if (doc.account) return "Account";
  if (doc.contract) return "Contract";
  if (doc.deal) return "Deal";
  if (doc.lead) return "Lead";
  if (doc.quote) return "Quote";
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentsPageClient() {
  const { toast } = useToast();

  // Data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("other");
  const [uploadAccountId, setUploadAccountId] = useState("");
  const [uploadContractId, setUploadContractId] = useState("");
  const [uploadDealId, setUploadDealId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Generate document dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genTemplate, setGenTemplate] = useState("");
  const [genEntityId, setGenEntityId] = useState("");
  const [genContracts, setGenContracts] = useState<LinkedEntity[]>([]);
  const [genAudits, setGenAudits] = useState<LinkedEntity[]>([]);

  // Linked entity options (for upload form)
  const [accounts, setAccounts] = useState<LinkedEntity[]>([]);
  const [contracts, setContracts] = useState<LinkedEntity[]>([]);
  const [deals, setDeals] = useState<LinkedEntity[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter) params.set("documentType", typeFilter);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      const json = await res.json();
      setDocuments(json.data);
      setTotal(json.total);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch linked entity options when upload dialog opens
  useEffect(() => {
    if (!uploadOpen) return;

    async function fetchOptions() {
      try {
        const [accRes, conRes, dealRes] = await Promise.all([
          fetch("/api/accounts?limit=100"),
          fetch("/api/contracts?limit=100"),
          fetch("/api/deals?limit=100"),
        ]);

        if (accRes.ok) {
          const accJson = await accRes.json();
          const accData = accJson.data || accJson;
          setAccounts(
            Array.isArray(accData)
              ? accData.map((a: { id: string; name: string }) => ({
                  id: a.id,
                  name: a.name,
                }))
              : []
          );
        }

        if (conRes.ok) {
          const conJson = await conRes.json();
          const conData = conJson.data || conJson;
          setContracts(
            Array.isArray(conData)
              ? conData.map(
                  (c: { id: string; contractName: string }) => ({
                    id: c.id,
                    name: c.contractName,
                  })
                )
              : []
          );
        }

        if (dealRes.ok) {
          const dealJson = await dealRes.json();
          const dealData = dealJson.data || dealJson;
          setDeals(
            Array.isArray(dealData)
              ? dealData.map(
                  (d: { id: string; dealName: string }) => ({
                    id: d.id,
                    name: d.dealName,
                  })
                )
              : []
          );
        }
      } catch {
        // Non-critical — selects will just be empty
      }
    }

    fetchOptions();
  }, [uploadOpen]);

  // Fetch entity options when generate dialog opens
  useEffect(() => {
    if (!generateOpen) return;

    async function fetchGenOptions() {
      try {
        const [conRes, auditRes] = await Promise.all([
          fetch("/api/contracts?limit=100"),
          fetch("/api/audits?limit=100"),
        ]);

        if (conRes.ok) {
          const conJson = await conRes.json();
          const conData = conJson.data || conJson;
          setGenContracts(
            Array.isArray(conData)
              ? conData.map(
                  (c: { id: string; contractName: string; unitId?: string }) => ({
                    id: c.id,
                    name: c.unitId ? `${c.contractName} (${c.unitId})` : c.contractName,
                  })
                )
              : []
          );
        }

        if (auditRes.ok) {
          const auditJson = await auditRes.json();
          const auditData = auditJson.data || auditJson;
          setGenAudits(
            Array.isArray(auditData)
              ? auditData.map(
                  (a: { id: string; auditDate: string; contract?: { contractName: string } }) => ({
                    id: a.id,
                    name: `${a.contract?.contractName || "Audit"} — ${new Date(a.auditDate).toLocaleDateString("en-GB")}`,
                  })
                )
              : []
          );
        }
      } catch {
        // Non-critical
      }
    }

    fetchGenOptions();
  }, [generateOpen]);

  // Generate document handler
  async function handleGenerate() {
    if (!genTemplate || !genEntityId) {
      toast({
        title: "Missing fields",
        description: "Please select a template and an entity.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: genTemplate,
          entityId: genEntityId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }

      const json = await res.json();

      toast({
        title: "Document generated",
        description: `${json.data.name} created successfully.`,
      });

      // Reset and close
      setGenTemplate("");
      setGenEntityId("");
      setGenerateOpen(false);
      fetchDocuments();

      // Open download in new tab
      if (json.data.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      }
    } catch (err) {
      toast({
        title: "Generation failed",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  // Entity options based on selected template
  const genEntityOptions =
    genTemplate === "audit-report" ? genAudits : genContracts;

  const genEntityLabel =
    genTemplate === "audit-report" ? "Select Audit" : "Select Contract";

  // Handle file selection
  function handleFileSelect(file: File) {
    setUploadFile(file);
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^/.]+$/, ""));
    }
  }

  // Drag-and-drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  // Upload handler
  async function handleUpload() {
    if (!uploadFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName || uploadFile.name);
      formData.append("documentType", uploadType);
      if (uploadAccountId) formData.append("accountId", uploadAccountId);
      if (uploadContractId) formData.append("contractId", uploadContractId);
      if (uploadDealId) formData.append("dealId", uploadDealId);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      toast({
        title: "Uploaded",
        description: "Document uploaded successfully.",
      });

      // Reset form and close
      resetUploadForm();
      setUploadOpen(false);
      fetchDocuments();
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  function resetUploadForm() {
    setUploadFile(null);
    setUploadName("");
    setUploadType("other");
    setUploadAccountId("");
    setUploadContractId("");
    setUploadDealId("");
    setIsDragging(false);
  }

  // Delete handler
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");

      toast({
        title: "Deleted",
        description: "Document deleted successfully.",
      });

      setDeleteOpen(false);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      fetchDocuments();
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete document.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  // Clear all filters
  const hasActiveFilters = typeFilter || debouncedSearch;

  function clearAllFilters() {
    setSearch("");
    setDebouncedSearch("");
    setTypeFilter("");
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} document{total !== 1 ? "s" : ""} stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setGenerateOpen(true)}
          >
            <Wand2 className="h-4 w-4" />
            Generate
          </Button>
          <Button className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filters bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by document name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter selects */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-9 px-2 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]" />
                <TableHead>
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Name
                  </span>
                </TableHead>
                <TableHead>
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Type
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Linked To
                  </span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Size
                  </span>
                </TableHead>
                <TableHead className="hidden xl:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Uploaded By
                  </span>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Date
                  </span>
                </TableHead>
                <TableHead className="w-[100px]">
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Actions
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading documents...
                    </div>
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-40 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                      <div>
                        {hasActiveFilters
                          ? "No documents match your filters."
                          : "No documents yet. Click \"Upload\" to add one."}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => {
                  const Icon = getFileIcon(doc.mimeType);
                  const isExpanded = expandedId === doc.id;

                  return (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer group"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : doc.id)
                      }
                    >
                      <TableCell className="pr-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px] lg:max-w-[300px]">
                            {doc.name}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium whitespace-nowrap ${documentTypeBadgeClass(doc.documentType)}`}
                        >
                          {documentTypeLabel(doc.documentType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {getLinkedEntityType(doc) ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground/70">
                              {getLinkedEntityType(doc)}
                            </span>
                            <span className="truncate max-w-[150px]">
                              {getLinkedEntityName(doc)}
                            </span>
                          </div>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {doc.creator?.name || "--"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                asChild
                              >
                                <a
                                  href={`/api/documents/${doc.id}/download`}
                                  download
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setDeleteTarget(doc);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Expanded detail rows rendered outside the table */}
        {expandedId && (
          <ExpandedDocumentDetail
            doc={documents.find((d) => d.id === expandedId) || null}
          />
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Choose a file and set its type and optional linking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drag-and-drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
                ${isDragging ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
                ${uploadFile ? "bg-muted/30" : ""}
              `}
            >
              {uploadFile ? (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(uploadFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Drag and drop a file here, or click to browse
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Name</Label>
              <Input
                id="doc-name"
                placeholder="Document name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>

            {/* Document Type */}
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Linking (optional) */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Link to (optional)
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* Account */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Account</Label>
                  <Select
                    value={uploadAccountId}
                    onValueChange={setUploadAccountId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contract */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Contract</Label>
                  <Select
                    value={uploadContractId}
                    onValueChange={setUploadContractId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deal */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Deal</Label>
                  <Select
                    value={uploadDealId}
                    onValueChange={setUploadDealId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {deals.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetUploadForm();
                setUploadOpen(false);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteTarget(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Document Dialog */}
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open);
          if (!open) {
            setGenTemplate("");
            setGenEntityId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Generate Document</DialogTitle>
            <DialogDescription>
              Select a template and entity to generate a PDF document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template selector */}
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={genTemplate}
                onValueChange={(v) => {
                  setGenTemplate(v);
                  setGenEntityId(""); // reset entity when template changes
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract-summary">Contract Summary</SelectItem>
                  <SelectItem value="client-welcome">Client Welcome Pack</SelectItem>
                  <SelectItem value="scope-of-works">Scope of Works</SelectItem>
                  <SelectItem value="audit-report">Audit Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity selector */}
            {genTemplate && (
              <div className="space-y-2">
                <Label>{genEntityLabel}</Label>
                <Select value={genEntityId} onValueChange={setGenEntityId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`${genEntityLabel}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {genEntityOptions.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No {genTemplate === "audit-report" ? "audits" : "contracts"} found
                      </SelectItem>
                    ) : (
                      genEntityOptions.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setGenTemplate("");
                setGenEntityId("");
                setGenerateOpen(false);
              }}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!genTemplate || !genEntityId || generating}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Expanded detail panel (rendered below the table)
// ---------------------------------------------------------------------------

function ExpandedDocumentDetail({ doc }: { doc: Document | null }) {
  if (!doc) return null;

  const Icon = getFileIcon(doc.mimeType);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{doc.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge
              variant="outline"
              className={`text-[11px] font-medium ${documentTypeBadgeClass(doc.documentType)}`}
            >
              {documentTypeLabel(doc.documentType)}
            </Badge>
            {doc.mimeType && (
              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                {doc.mimeType}
              </span>
            )}
            <span>{formatFileSize(doc.fileSize)}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
          <a href={`/api/documents/${doc.id}/download`} download>
            <Download className="h-4 w-4" />
            Download
          </a>
        </Button>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Uploaded By</p>
          <p className="font-medium">{doc.creator?.name || "--"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Date</p>
          <p className="font-medium">{formatDate(doc.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Linked To</p>
          <p className="font-medium">
            {getLinkedEntityType(doc)
              ? `${getLinkedEntityType(doc)}: ${getLinkedEntityName(doc)}`
              : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">File Path</p>
          <p className="font-mono text-xs truncate">{doc.filePath}</p>
        </div>
      </div>
    </div>
  );
}
