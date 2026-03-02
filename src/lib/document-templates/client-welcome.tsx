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

export interface ClientWelcomeData {
  companyName: string;
  contractName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  startDate: string | null;
  daysSelected: string[];
  weeklyHours: number;
  // Key contacts
  accountManager: string;
  accountManagerEmail: string;
  operationsManager: string;
  operationsManagerEmail: string;
  // Contract details
  siteType: string;
  monthlyRevenue: number;
  teamLead: string | null;
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
  coverPage: {
    fontFamily: "Helvetica",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
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
  coverTitle: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 8,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 14,
    color: BRAND_GREEN,
    fontFamily: "Helvetica-Bold",
    marginBottom: 40,
    textAlign: "center",
  },
  coverDetailBlock: {
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  coverLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  coverValue: {
    fontSize: 12,
    color: DARK_TEXT,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginTop: 16,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: BODY_TEXT,
    marginBottom: 6,
  },
  contactCard: {
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: BRAND_GREEN,
  },
  contactName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 2,
  },
  contactRole: {
    fontSize: 9,
    color: BRAND_GREEN,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 9,
    color: BODY_TEXT,
    marginBottom: 2,
  },
  stepBox: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_GREEN,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    lineHeight: 28,
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 3,
  },
  stepDescription: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
  },
  escalationBox: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
    padding: 14,
    marginTop: 8,
  },
  escalationRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  escalationLevel: {
    width: 80,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
  },
  escalationAction: {
    flex: 1,
    fontSize: 9,
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
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 9,
    color: "#9ca3af",
  },
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ClientWelcomePDF({ data }: { data: ClientWelcomeData }) {
  return (
    <Document
      title={`Welcome Pack - ${data.companyName}`}
      author="Signature Cleans Ltd"
    >
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.accentBar} />
        <Text style={styles.coverTitle}>Signature Cleans</Text>
        <Text style={styles.coverSubtitle}>Client Welcome Pack</Text>

        <View style={styles.coverDetailBlock}>
          <Text style={styles.coverLabel}>Prepared For</Text>
          <Text style={styles.coverValue}>{data.companyName}</Text>
          <Text style={styles.coverLabel}>Contract</Text>
          <Text style={styles.coverValue}>{data.contractName}</Text>
          <Text style={styles.coverLabel}>Contact</Text>
          <Text style={styles.coverValue}>{data.contactName}</Text>
          <Text style={styles.coverLabel}>Start Date</Text>
          <Text style={{ ...styles.coverValue, marginBottom: 0 }}>
            {fmtDate(data.startDate)}
          </Text>
        </View>

        <Text style={styles.coverFooter}>
          Signature Cleans Ltd | Exeter, Devon | info@signature-cleans.co.uk
        </Text>
      </Page>

      {/* Welcome Letter */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeader}>Welcome to Signature Cleans</Text>
        <Text style={styles.bodyText}>
          Dear {data.contactName},
        </Text>
        <Text style={styles.bodyText}>
          Thank you for choosing Signature Cleans as your cleaning partner. We are delighted to
          welcome {data.companyName} and are committed to delivering an outstanding service from
          day one.
        </Text>
        <Text style={styles.bodyText}>
          This welcome pack contains everything you need to know about working with us, including
          your key contacts, what to expect during your first weeks, and how to raise any queries
          or concerns.
        </Text>
        <Text style={styles.bodyText}>
          Your cleaning service is scheduled to begin on {fmtDate(data.startDate)}, covering {data.daysSelected.join(", ")} each week ({data.weeklyHours} hours per week).
        </Text>

        {/* Key Contacts */}
        <Text style={styles.sectionHeader}>Your Key Contacts</Text>

        <View style={styles.contactCard}>
          <Text style={styles.contactName}>{data.accountManager}</Text>
          <Text style={styles.contactRole}>Account Manager</Text>
          <Text style={styles.contactDetail}>{data.accountManagerEmail}</Text>
          <Text style={styles.contactDetail}>
            Your first point of contact for all service queries, reviews, and feedback.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactName}>{data.operationsManager}</Text>
          <Text style={styles.contactRole}>Operations Manager</Text>
          <Text style={styles.contactDetail}>{data.operationsManagerEmail}</Text>
          <Text style={styles.contactDetail}>
            Oversees day-to-day delivery, staffing, and scheduling.
          </Text>
        </View>

        {data.teamLead && (
          <View style={styles.contactCard}>
            <Text style={styles.contactName}>{data.teamLead}</Text>
            <Text style={styles.contactRole}>On-Site Team Lead</Text>
            <Text style={styles.contactDetail}>
              Your on-site point of contact during cleaning hours.
            </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Welcome Pack</Text>
          <Text>{data.companyName}</Text>
        </View>
      </Page>

      {/* What to Expect */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeader}>What to Expect</Text>
        <Text style={styles.bodyText}>
          Here is what happens during your first 30 days with Signature Cleans:
        </Text>

        <View style={styles.stepBox}>
          <Text style={styles.stepNumber}>1</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Mobilisation (Week 1)</Text>
            <Text style={styles.stepDescription}>
              Our team will visit your site to complete a thorough handover. We will confirm access
              arrangements, set up supplies, and introduce your cleaning team.
            </Text>
          </View>
        </View>

        <View style={styles.stepBox}>
          <Text style={styles.stepNumber}>2</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>First Clean & Check-In (Week 1-2)</Text>
            <Text style={styles.stepDescription}>
              After the first few cleans, your Account Manager will check in to ensure
              everything meets your expectations and address any early feedback.
            </Text>
          </View>
        </View>

        <View style={styles.stepBox}>
          <Text style={styles.stepNumber}>3</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Quality Audit (Week 3-4)</Text>
            <Text style={styles.stepDescription}>
              We will conduct our first quality audit to benchmark standards and share the
              report with you. Audits continue on a regular schedule thereafter.
            </Text>
          </View>
        </View>

        <View style={styles.stepBox}>
          <Text style={styles.stepNumber}>4</Text>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>30-Day Review</Text>
            <Text style={styles.stepDescription}>
              A formal review meeting with your Account Manager to discuss service quality,
              any adjustments needed, and confirm the ongoing schedule.
            </Text>
          </View>
        </View>

        {/* Escalation Path */}
        <Text style={styles.sectionHeader}>Escalation Path</Text>
        <Text style={styles.bodyText}>
          If you ever need to raise a concern, here is how it works:
        </Text>

        <View style={styles.escalationBox}>
          <View style={styles.escalationRow}>
            <Text style={styles.escalationLevel}>Level 1</Text>
            <Text style={styles.escalationAction}>
              Contact your on-site Team Lead directly during service hours.
            </Text>
          </View>
          <View style={styles.escalationRow}>
            <Text style={styles.escalationLevel}>Level 2</Text>
            <Text style={styles.escalationAction}>
              Email or call your Account Manager ({data.accountManager}) for any unresolved issues.
              Response within 4 working hours.
            </Text>
          </View>
          <View style={styles.escalationRow}>
            <Text style={styles.escalationLevel}>Level 3</Text>
            <Text style={styles.escalationAction}>
              Contact Operations ({data.operationsManager}) for urgent or safety-related matters.
              Response within 2 working hours.
            </Text>
          </View>
          <View style={{ ...styles.escalationRow, marginBottom: 0 }}>
            <Text style={styles.escalationLevel}>Emergency</Text>
            <Text style={styles.escalationAction}>
              For out-of-hours emergencies, call 07XXX XXXXXX (24/7 duty line).
            </Text>
          </View>
        </View>

        <Text style={{ ...styles.bodyText, marginTop: 20 }}>
          We look forward to a successful partnership with {data.companyName}. If you have any
          questions at all, please do not hesitate to get in touch.
        </Text>

        <Text style={{ ...styles.bodyText, marginTop: 16, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
          The Signature Cleans Team
        </Text>

        <View style={styles.footer} fixed>
          <Text>Signature Cleans Ltd | Welcome Pack</Text>
          <Text>{data.companyName}</Text>
        </View>
      </Page>
    </Document>
  );
}
