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

export interface AuditReportData {
  contractName: string;
  unitId: string | null;
  accountName: string | null;
  auditorName: string;
  auditDate: string;
  overallScore: number;
  previousScore: number;
  // Category scores (JSON arrays of { name, score })
  generalStandards: CategoryScore[];
  staffPerformance: CategoryScore[];
  hsCompliance: CategoryScore[];
  // Client feedback
  clientSatisfactionScore: number | null;
  clientFeedback: string | null;
  // Action items (JSON array)
  actionItems: ActionItem[];
  requiresFollowUp: boolean;
  followUpDate: string | null;
  notes: string | null;
  generatedAt: string;
}

export interface CategoryScore {
  name: string;
  score: number; // 1-5
}

export interface ActionItem {
  description: string;
  priority?: string;
  dueDate?: string;
}

// ──────────────────────────────────────────────
// BRAND COLOURS
// ──────────────────────────────────────────────

const BRAND_GREEN = "#22c55e";
const DARK_TEXT = "#1a1a1a";
const BODY_TEXT = "#374151";
const LIGHT_BG = "#f9fafb";
const BORDER_COLOR = "#e5e7eb";

const TRAFFIC_GREEN = "#22c55e";
const TRAFFIC_AMBER = "#f59e0b";
const TRAFFIC_RED = "#ef4444";

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
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: BODY_TEXT,
    marginBottom: 6,
  },
  // Score overview
  scoreOverviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  scoreCard: {
    width: "30%",
    borderRadius: 4,
    padding: 14,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  scoreLabel: {
    fontSize: 9,
    color: "#ffffff",
    opacity: 0.9,
  },
  // Category table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: DARK_TEXT,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
    marginBottom: 1,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableCellName: {
    flex: 1,
    fontSize: 10,
    color: BODY_TEXT,
  },
  tableCellScore: {
    width: 40,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  tableCellLight: {
    width: 24,
    textAlign: "center",
  },
  trafficDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Action items
  actionRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  actionDescription: {
    flex: 1,
    fontSize: 9,
    color: BODY_TEXT,
    lineHeight: 1.4,
  },
  actionPriority: {
    width: 60,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingVertical: 2,
    borderRadius: 3,
  },
  // Notes
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

function fmtDate(d: string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function trafficColor(score: number): string {
  if (score >= 4) return TRAFFIC_GREEN;
  if (score >= 3) return TRAFFIC_AMBER;
  return TRAFFIC_RED;
}

function overallTrafficColor(score: number): string {
  if (score >= 80) return TRAFFIC_GREEN;
  if (score >= 60) return TRAFFIC_AMBER;
  return TRAFFIC_RED;
}

function categoryAverage(items: CategoryScore[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.score, 0);
  return parseFloat((total / items.length).toFixed(1));
}

function ScoreTable({ title, items }: { title: string; items: CategoryScore[] }) {
  const avg = categoryAverage(items);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT, marginBottom: 6 }}>
        {title} (Avg: {avg}/5)
      </Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Criterion</Text>
        <Text style={[styles.tableHeaderText, { width: 40, textAlign: "center" }]}>Score</Text>
        <Text style={[styles.tableHeaderText, { width: 24, textAlign: "center" }]}> </Text>
      </View>
      {items.map((item, idx) => (
        <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
          <Text style={styles.tableCellName}>{item.name}</Text>
          <Text style={[styles.tableCellScore, { color: trafficColor(item.score) }]}>
            {item.score}/5
          </Text>
          <View style={styles.tableCellLight}>
            <View style={[styles.trafficDot, { backgroundColor: trafficColor(item.score) }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function AuditReportPDF({ data }: { data: AuditReportData }) {
  const scoreDelta = data.overallScore - data.previousScore;
  const deltaLabel = scoreDelta > 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1);

  return (
    <Document
      title={`Audit Report - ${data.contractName}`}
      author="Signature Cleans Ltd"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />

        <Text style={styles.title}>Audit Report</Text>
        <Text style={styles.subtitle}>
          {data.contractName}{data.unitId ? ` (${data.unitId})` : ""}
        </Text>

        {/* Meta row */}
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
              Account
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
              {data.accountName || "N/A"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
              Auditor
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
              {data.auditorName}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
              Audit Date
            </Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
              {fmtDate(data.auditDate)}
            </Text>
          </View>
        </View>

        {/* Score overview cards */}
        <View style={styles.scoreOverviewRow}>
          <View style={[styles.scoreCard, { backgroundColor: overallTrafficColor(data.overallScore) }]}>
            <Text style={styles.scoreValue}>{data.overallScore}%</Text>
            <Text style={styles.scoreLabel}>Overall Score</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: "#6b7280" }]}>
            <Text style={styles.scoreValue}>{data.previousScore}%</Text>
            <Text style={styles.scoreLabel}>Previous Score</Text>
          </View>
          <View style={[styles.scoreCard, { backgroundColor: scoreDelta >= 0 ? TRAFFIC_GREEN : TRAFFIC_RED }]}>
            <Text style={styles.scoreValue}>{deltaLabel}</Text>
            <Text style={styles.scoreLabel}>Change</Text>
          </View>
        </View>

        {/* Category scores */}
        <Text style={styles.sectionHeader}>Detailed Scores</Text>

        <ScoreTable title="General Standards" items={data.generalStandards} />
        <ScoreTable title="Staff Performance" items={data.staffPerformance} />
        <ScoreTable title="Health & Safety Compliance" items={data.hsCompliance} />

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Audit Report</Text>
          <Text>{data.contractName} — {fmtDate(data.auditDate)}</Text>
        </View>
      </Page>

      {/* Page 2: Actions & Feedback */}
      <Page size="A4" style={styles.page}>
        {/* Client Feedback */}
        {(data.clientSatisfactionScore != null || data.clientFeedback) && (
          <>
            <Text style={styles.sectionHeader}>Client Feedback</Text>
            {data.clientSatisfactionScore != null && (
              <Text style={styles.bodyText}>
                Client Satisfaction Score: <Text style={{ fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>{data.clientSatisfactionScore}/10</Text>
              </Text>
            )}
            {data.clientFeedback && (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{data.clientFeedback}</Text>
              </View>
            )}
          </>
        )}

        {/* Action Items */}
        <Text style={styles.sectionHeader}>Action Items</Text>
        {data.actionItems.length > 0 ? (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Action</Text>
              <Text style={[styles.tableHeaderText, { width: 60, textAlign: "center" }]}>Priority</Text>
            </View>
            {data.actionItems.map((action, idx) => (
              <View key={idx} style={styles.actionRow}>
                <Text style={styles.actionDescription}>{action.description}</Text>
                {action.priority && (
                  <Text style={[
                    styles.actionPriority,
                    {
                      backgroundColor: action.priority === "high" ? "#fef2f2" : action.priority === "medium" ? "#fffbeb" : "#f0fdf4",
                      color: action.priority === "high" ? TRAFFIC_RED : action.priority === "medium" ? TRAFFIC_AMBER : TRAFFIC_GREEN,
                    },
                  ]}>
                    {action.priority.toUpperCase()}
                  </Text>
                )}
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.bodyText}>No action items raised during this audit.</Text>
        )}

        {/* Follow-up */}
        {data.requiresFollowUp && (
          <>
            <Text style={{ ...styles.sectionHeader, marginTop: 20 }}>Follow-Up Required</Text>
            <Text style={styles.bodyText}>
              A follow-up audit has been scheduled for {fmtDate(data.followUpDate)}.
            </Text>
          </>
        )}

        {/* Notes */}
        {data.notes && (
          <>
            <Text style={styles.sectionHeader}>Auditor Notes</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Audit Report</Text>
          <Text>{data.contractName} — {fmtDate(data.auditDate)}</Text>
        </View>
      </Page>
    </Document>
  );
}
