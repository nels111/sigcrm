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

export interface ScopeOfWorksData {
  companyName: string;
  contractName: string;
  address: string | null;
  siteType: string;
  daysSelected: string[];
  weeklyHours: number;
  visitsPerWeek: number;
  hoursPerVisit: number;
  // Scope text (from quote if available)
  scopeOfWorks: string | null;
  // Areas (parsed or raw)
  areas: ScopeArea[];
  generatedAt: string;
}

export interface ScopeArea {
  name: string;
  frequency: string;
  tasks: string[];
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
    width: 160,
    fontSize: 10,
    color: BODY_TEXT,
  },
  value: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
  },
  areaCard: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
    marginBottom: 14,
    overflow: "hidden",
  },
  areaHeader: {
    backgroundColor: BRAND_GREEN,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  areaName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  areaFrequency: {
    fontSize: 9,
    color: "#dcfce7",
  },
  taskItem: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  scopeText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
    marginBottom: 3,
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

function fmtSiteType(s: string): string {
  const map: Record<string, string> = {
    OfficeCommercial: "Office / Commercial",
    WelfareConstruction: "Welfare / Construction",
    HospitalityVenue: "Hospitality / Venue",
    EducationInstitutional: "Education / Institutional",
    SpecialistIndustrial: "Specialist / Industrial",
    DentalMedical: "Dental / Medical",
  };
  return map[s] || s.replace(/([A-Z])/g, " $1").trim();
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ScopeOfWorksPDF({ data }: { data: ScopeOfWorksData }) {
  return (
    <Document
      title={`Scope of Works - ${data.contractName}`}
      author="Signature Cleans Ltd"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentBar} />

        <Text style={styles.title}>Scope of Works</Text>
        <Text style={styles.subtitle}>{data.contractName} — {data.companyName}</Text>

        {/* Site Details */}
        <Text style={styles.sectionHeader}>Site Details</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{data.companyName}</Text>
        </View>
        <View style={styles.rowAlt}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{data.address || "N/A"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Site Type</Text>
          <Text style={styles.value}>{fmtSiteType(data.siteType)}</Text>
        </View>
        <View style={styles.rowAlt}>
          <Text style={styles.label}>Service Days</Text>
          <Text style={styles.value}>{data.daysSelected.join(", ")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Visits Per Week</Text>
          <Text style={styles.value}>{data.visitsPerWeek}</Text>
        </View>
        <View style={styles.rowAlt}>
          <Text style={styles.label}>Hours Per Visit</Text>
          <Text style={styles.value}>{data.hoursPerVisit}h</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total Weekly Hours</Text>
          <Text style={styles.value}>{data.weeklyHours}h</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Scope of Works</Text>
          <Text>{data.contractName}</Text>
        </View>
      </Page>

      {/* Areas & Tasks */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeader}>Areas &amp; Tasks</Text>

        {data.areas.length > 0 ? (
          data.areas.map((area, idx) => (
            <View key={idx} style={styles.areaCard} wrap={false}>
              <View style={styles.areaHeader}>
                <Text style={styles.areaName}>{area.name}</Text>
                <Text style={styles.areaFrequency}>{area.frequency}</Text>
              </View>
              {area.tasks.map((task, ti) => (
                <Text key={ti} style={styles.taskItem}>
                  {"\u2022"} {task}
                </Text>
              ))}
            </View>
          ))
        ) : data.scopeOfWorks ? (
          <>
            <Text style={styles.bodyText}>
              The following specification details the cleaning services to be provided:
            </Text>
            {data.scopeOfWorks.split("\n").map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <Text key={idx} style={{ marginBottom: 4 }}>{" "}</Text>;
              return <Text key={idx} style={styles.scopeText}>{trimmed}</Text>;
            })}
          </>
        ) : (
          <Text style={styles.bodyText}>
            Scope of works details not yet specified. Please contact your Account Manager
            for a detailed breakdown of cleaning tasks.
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Scope of Works</Text>
          <Text>{data.contractName}</Text>
        </View>
      </Page>
    </Document>
  );
}
