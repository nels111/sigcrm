import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface ContractSummaryData {
  contractName: string;
  unitId: string | null;
  status: string;
  cellType: string;
  accountName: string | null;
  // Schedule
  weeklyHours: number;
  visitsPerWeek: number;
  hoursPerVisit: number;
  daysSelected: string[];
  siteType: string;
  // Financials
  sellRatePerHour: number;
  monthlyRevenue: number;
  annualValue: number;
  grossMarginPercent: number;
  // Dates
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  noticePeriodDays: number;
  // Team
  teamLead: string | null;
  subcontractorName: string | null;
  // Quality
  latestAuditScore: number;
  healthStatus: string;
  // Contact
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  // Notes
  notes: string | null;
  generatedAt: string;
}

// ──────────────────────────────────────────────
// BRAND COLOURS
// ──────────────────────────────────────────────

const BRAND_GREEN = "#22c55e";
const DARK_TEXT = "#1a1a1a";
const BODY_TEXT = "#374151";
const LIGHT_BG = "#f9fafb";
const BORDER_COLOR = "#e5e7eb";

// ──────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BODY_TEXT,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  accentBar: {
    width: "100%",
    height: 6,
    backgroundColor: BRAND_GREEN,
    position: "absolute",
    top: 0,
    left: 0,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginTop: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: BRAND_GREEN,
    fontFamily: "Helvetica-Bold",
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  rowAlt: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  label: {
    width: 180,
    fontSize: 10,
    color: BODY_TEXT,
  },
  value: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
  },
  statusBadge: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  notesBox: {
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `\u00a3${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function statusColor(s: string): string {
  if (s === "active") return BRAND_GREEN;
  if (s === "mobilising") return "#3b82f6";
  if (s === "on_hold") return "#f59e0b";
  if (s === "notice_given" || s === "terminated") return "#ef4444";
  return "#6b7280";
}

function healthLabel(h: string): string {
  if (h === "GREEN") return "Healthy";
  if (h === "AMBER") return "At Risk";
  if (h === "RED") return "Critical";
  return h;
}

function DataRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  return (
    <View style={alt ? styles.rowAlt : styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ContractSummaryPDF({ data }: { data: ContractSummaryData }) {
  return (
    <Document
      title={`Contract Summary - ${data.contractName}`}
      author="Signature Cleans Ltd"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />

        <Text style={styles.title}>Contract Summary</Text>
        <Text style={styles.subtitle}>{data.contractName}</Text>

        {/* Overview */}
        <Text style={styles.sectionHeader}>Overview</Text>
        <DataRow label="Contract Name" value={data.contractName} />
        <DataRow label="Unit ID" value={data.unitId || "N/A"} alt />
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.statusBadge, { backgroundColor: statusColor(data.status) }]}>
            {data.status.replace(/_/g, " ").toUpperCase()}
          </Text>
        </View>
        <DataRow label="Cell Type" value={data.cellType} alt />
        <DataRow label="Account" value={data.accountName || "N/A"} />

        {/* Contact */}
        <Text style={styles.sectionHeader}>Primary Contact</Text>
        <DataRow label="Name" value={data.primaryContactName || "N/A"} />
        <DataRow label="Email" value={data.primaryContactEmail || "N/A"} alt />
        <DataRow label="Phone" value={data.primaryContactPhone || "N/A"} />

        {/* Schedule */}
        <Text style={styles.sectionHeader}>Schedule</Text>
        <DataRow label="Weekly Hours" value={`${data.weeklyHours}h`} />
        <DataRow label="Visits Per Week" value={`${data.visitsPerWeek}`} alt />
        <DataRow label="Hours Per Visit" value={`${data.hoursPerVisit}h`} />
        <DataRow label="Days" value={data.daysSelected.join(", ")} alt />
        <DataRow label="Site Type" value={data.siteType.replace(/([A-Z])/g, " $1").trim()} />

        {/* Financials */}
        <Text style={styles.sectionHeader}>Financials</Text>
        <DataRow label="Sell Rate Per Hour" value={fmtCurrency(data.sellRatePerHour)} />
        <DataRow label="Monthly Revenue" value={fmtCurrency(data.monthlyRevenue)} alt />
        <DataRow label="Annual Value" value={fmtCurrency(data.annualValue)} />
        <DataRow label="Gross Margin" value={`${data.grossMarginPercent}%`} alt />

        {/* Dates */}
        <Text style={styles.sectionHeader}>Key Dates</Text>
        <DataRow label="Start Date" value={fmtDate(data.startDate)} />
        <DataRow label="End Date" value={fmtDate(data.endDate)} alt />
        <DataRow label="Renewal Date" value={fmtDate(data.renewalDate)} />
        <DataRow label="Notice Period" value={`${data.noticePeriodDays} days`} alt />

        {/* Team */}
        <Text style={styles.sectionHeader}>Team & Quality</Text>
        <DataRow label="Team Lead" value={data.teamLead || "N/A"} />
        <DataRow label="Subcontractor" value={data.subcontractorName || "In-house"} alt />
        <DataRow label="Latest Audit Score" value={`${data.latestAuditScore}%`} />
        <DataRow label="Health Status" value={healthLabel(data.healthStatus)} alt />

        {/* Notes */}
        {data.notes && (
          <>
            <Text style={styles.sectionHeader}>Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Contract Summary</Text>
          <Text>Generated {fmtDate(data.generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
