import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentType } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

import { ContractSummaryPDF } from "@/lib/document-templates/contract-summary";
import type { ContractSummaryData } from "@/lib/document-templates/contract-summary";
import { ClientWelcomePDF } from "@/lib/document-templates/client-welcome";
import type { ClientWelcomeData } from "@/lib/document-templates/client-welcome";
import { ScopeOfWorksPDF } from "@/lib/document-templates/scope-of-works";
import type { ScopeOfWorksData, ScopeArea } from "@/lib/document-templates/scope-of-works";
import { AuditReportPDF } from "@/lib/document-templates/audit-report";
import type { AuditReportData, CategoryScore, ActionItem } from "@/lib/document-templates/audit-report";

const FILES_ROOT =
  process.env.FILES_ROOT || "/var/data/signature-cleans/files";

const VALID_TEMPLATES = [
  "contract-summary",
  "client-welcome",
  "scope-of-works",
  "audit-report",
] as const;

type TemplateName = (typeof VALID_TEMPLATES)[number];

// Map template names to document types in the DB
const TEMPLATE_TO_DOC_TYPE: Record<TemplateName, DocumentType> = {
  "contract-summary": "contract",
  "client-welcome": "client_welcome",
  "scope-of-works": "site_pack",
  "audit-report": "audit_report",
};

// ──────────────────────────────────────────────
// Data fetchers
// ──────────────────────────────────────────────

async function buildContractSummaryData(entityId: string): Promise<{ data: ContractSummaryData; linkIds: Record<string, string> }> {
  const contract = await prisma.contract.findUnique({
    where: { id: entityId },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          contacts: {
            where: { isPrimary: true, deletedAt: null },
            take: 1,
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
      subcontractor: { select: { companyName: true, contactName: true } },
    },
  });

  if (!contract) throw new Error("Contract not found");

  const primary = contract.account?.contacts?.[0];

  return {
    data: {
      contractName: contract.contractName,
      unitId: contract.unitId,
      status: contract.status,
      cellType: contract.cellType,
      accountName: contract.account?.name ?? null,
      weeklyHours: Number(contract.weeklyHours),
      visitsPerWeek: contract.visitsPerWeek,
      hoursPerVisit: Number(contract.hoursPerVisit),
      daysSelected: contract.daysSelected,
      siteType: contract.siteType,
      sellRatePerHour: Number(contract.sellRatePerHour),
      monthlyRevenue: Number(contract.monthlyRevenue),
      annualValue: Number(contract.annualValue),
      grossMarginPercent: Number(contract.grossMarginPercent),
      startDate: contract.startDate?.toISOString() ?? null,
      endDate: contract.endDate?.toISOString() ?? null,
      renewalDate: contract.renewalDate?.toISOString() ?? null,
      noticePeriodDays: contract.noticePeriodDays,
      teamLead: contract.teamLead,
      subcontractorName: contract.subcontractor?.companyName ?? contract.subcontractor?.contactName ?? null,
      latestAuditScore: Number(contract.latestAuditScore),
      healthStatus: contract.healthStatus,
      primaryContactName: primary ? `${primary.firstName ?? ""} ${primary.lastName}`.trim() : null,
      primaryContactEmail: primary?.email ?? null,
      primaryContactPhone: primary?.phone ?? null,
      notes: contract.notes,
      generatedAt: new Date().toISOString(),
    },
    linkIds: {
      contractId: contract.id,
      accountId: contract.accountId ?? "",
    },
  };
}

async function buildClientWelcomeData(entityId: string): Promise<{ data: ClientWelcomeData; linkIds: Record<string, string> }> {
  const contract = await prisma.contract.findUnique({
    where: { id: entityId },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          contacts: {
            where: { isPrimary: true, deletedAt: null },
            take: 1,
            select: { firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
    },
  });

  if (!contract) throw new Error("Contract not found");

  const primary = contract.account?.contacts?.[0];

  return {
    data: {
      companyName: contract.account?.name ?? contract.contractName,
      contractName: contract.contractName,
      contactName: primary ? `${primary.firstName ?? ""} ${primary.lastName}`.trim() : "Valued Client",
      contactEmail: primary?.email ?? null,
      contactPhone: primary?.phone ?? null,
      startDate: contract.startDate?.toISOString() ?? null,
      daysSelected: contract.daysSelected,
      weeklyHours: Number(contract.weeklyHours),
      siteType: contract.siteType,
      monthlyRevenue: Number(contract.monthlyRevenue),
      teamLead: contract.teamLead,
      accountManager: "Nick",
      accountManagerEmail: process.env.NICK_EMAIL || "nick@signature-cleans.co.uk",
      operationsManager: "Nelson",
      operationsManagerEmail: process.env.NELSON_EMAIL || "nelson@signature-cleans.co.uk",
      generatedAt: new Date().toISOString(),
    },
    linkIds: {
      contractId: contract.id,
      accountId: contract.accountId ?? "",
    },
  };
}

async function buildScopeOfWorksData(entityId: string): Promise<{ data: ScopeOfWorksData; linkIds: Record<string, string> }> {
  const contract = await prisma.contract.findUnique({
    where: { id: entityId },
    include: {
      account: { select: { id: true, name: true, address: true } },
      quote: { select: { scopeOfWorks: true } },
    },
  });

  if (!contract) throw new Error("Contract not found");

  // Try to parse scope of works into areas
  const scopeText = contract.quote?.scopeOfWorks ?? null;
  const areas: ScopeArea[] = [];

  // Simple parser: detect area headers (lines like "1. AREA NAME" or "AREA:")
  if (scopeText) {
    const lines = scopeText.split("\n");
    let currentArea: ScopeArea | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect main headers (e.g., "1. KITCHEN", "RECEPTION AREA")
      const headerMatch = trimmed.match(/^(?:\d+\.\s+)?([A-Z][A-Z\s/&]+)$/);
      if (headerMatch && trimmed.length < 50) {
        if (currentArea && currentArea.tasks.length > 0) {
          areas.push(currentArea);
        }
        currentArea = {
          name: headerMatch[1].trim(),
          frequency: "Each visit",
          tasks: [],
        };
        continue;
      }

      // Add as a task to current area
      if (currentArea) {
        const cleaned = trimmed.replace(/^[-•*]\s*/, "").replace(/^\d+\.\d+\s*/, "");
        if (cleaned.length > 3) {
          currentArea.tasks.push(cleaned);
        }
      }
    }

    if (currentArea && currentArea.tasks.length > 0) {
      areas.push(currentArea);
    }
  }

  return {
    data: {
      companyName: contract.account?.name ?? contract.contractName,
      contractName: contract.contractName,
      address: contract.account?.address ?? null,
      siteType: contract.siteType,
      daysSelected: contract.daysSelected,
      weeklyHours: Number(contract.weeklyHours),
      visitsPerWeek: contract.visitsPerWeek,
      hoursPerVisit: Number(contract.hoursPerVisit),
      scopeOfWorks: scopeText,
      areas,
      generatedAt: new Date().toISOString(),
    },
    linkIds: {
      contractId: contract.id,
      accountId: contract.accountId ?? "",
    },
  };
}

async function buildAuditReportData(entityId: string): Promise<{ data: AuditReportData; linkIds: Record<string, string> }> {
  const audit = await prisma.audit.findUnique({
    where: { id: entityId },
    include: {
      contract: {
        select: {
          id: true,
          contractName: true,
          unitId: true,
          accountId: true,
          previousAuditScore: true,
          account: { select: { name: true } },
        },
      },
      auditor: { select: { name: true } },
    },
  });

  if (!audit) throw new Error("Audit not found");

  // Parse JSON scores safely
  function parseScores(raw: unknown): CategoryScore[] {
    if (!raw) return [];
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return [];
      return arr.map((item: { name?: string; score?: number }) => ({
        name: item.name || "Unknown",
        score: item.score ?? 0,
      }));
    } catch {
      return [];
    }
  }

  function parseActions(raw: unknown): ActionItem[] {
    if (!raw) return [];
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!Array.isArray(arr)) return [];
      return arr.map((item: { description?: string; priority?: string; dueDate?: string }) => ({
        description: item.description || "",
        priority: item.priority,
        dueDate: item.dueDate,
      }));
    } catch {
      return [];
    }
  }

  return {
    data: {
      contractName: audit.contract.contractName,
      unitId: audit.contract.unitId,
      accountName: audit.contract.account?.name ?? null,
      auditorName: audit.auditor.name,
      auditDate: audit.auditDate.toISOString(),
      overallScore: Number(audit.overallScore),
      previousScore: Number(audit.contract.previousAuditScore),
      generalStandards: parseScores(audit.generalStandards),
      staffPerformance: parseScores(audit.staffPerformance),
      hsCompliance: parseScores(audit.hsCompliance),
      clientSatisfactionScore: audit.clientSatisfactionScore,
      clientFeedback: audit.clientFeedback,
      actionItems: parseActions(audit.actionItems),
      requiresFollowUp: audit.requiresFollowUp,
      followUpDate: audit.followUpDate?.toISOString() ?? null,
      notes: audit.notes,
      generatedAt: new Date().toISOString(),
    },
    linkIds: {
      contractId: audit.contract.id,
      accountId: audit.contract.accountId ?? "",
    },
  };
}

// ──────────────────────────────────────────────
// POST /api/documents/generate
// ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateName, entityId } = body as {
      templateName: string;
      entityId: string;
    };

    if (!templateName || !entityId) {
      return NextResponse.json(
        { error: "templateName and entityId are required" },
        { status: 400 }
      );
    }

    if (!VALID_TEMPLATES.includes(templateName as TemplateName)) {
      return NextResponse.json(
        { error: `Invalid template. Valid options: ${VALID_TEMPLATES.join(", ")}` },
        { status: 400 }
      );
    }

    const template = templateName as TemplateName;

    // Build data and render PDF
    let pdfElement: React.ReactElement;
    let linkIds: Record<string, string> = {};
    let docName: string;

    switch (template) {
      case "contract-summary": {
        const { data, linkIds: ids } = await buildContractSummaryData(entityId);
        linkIds = ids;
        docName = `Contract Summary - ${data.contractName}`;
        pdfElement = React.createElement(ContractSummaryPDF, { data });
        break;
      }
      case "client-welcome": {
        const { data, linkIds: ids } = await buildClientWelcomeData(entityId);
        linkIds = ids;
        docName = `Welcome Pack - ${data.companyName}`;
        pdfElement = React.createElement(ClientWelcomePDF, { data });
        break;
      }
      case "scope-of-works": {
        const { data, linkIds: ids } = await buildScopeOfWorksData(entityId);
        linkIds = ids;
        docName = `Scope of Works - ${data.contractName}`;
        pdfElement = React.createElement(ScopeOfWorksPDF, { data });
        break;
      }
      case "audit-report": {
        const { data, linkIds: ids } = await buildAuditReportData(entityId);
        linkIds = ids;
        docName = `Audit Report - ${data.contractName}`;
        pdfElement = React.createElement(AuditReportPDF, { data });
        break;
      }
    }

    // Render PDF buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(pdfElement as unknown as React.ReactElement<any>);

    // Save to disk
    const fileId = uuidv4();
    const safeDocName = docName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${fileId}-${safeDocName}.pdf`;
    const dirPath = join(FILES_ROOT, "documents");
    const filePath = join(dirPath, fileName);

    await mkdir(dirPath, { recursive: true });
    await writeFile(filePath, Buffer.from(pdfBuffer));

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: docName,
        documentType: TEMPLATE_TO_DOC_TYPE[template],
        filePath,
        fileSize: pdfBuffer.length,
        mimeType: "application/pdf",
        templateName: template,
        contractId: linkIds.contractId || undefined,
        accountId: linkIds.accountId || undefined,
      },
    });

    // Set the download URL
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: { fileUrl: `/api/documents/${document.id}/download` },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        downloadUrl: `/api/documents/${updated.id}/download`,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // User-friendly messages for common cases
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    console.error("POST /api/documents/generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate document" },
      { status: 500 }
    );
  }
}
