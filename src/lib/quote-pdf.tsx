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

export interface QuotePDFData {
  quoteRef: string;
  companyName: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  siteType: string;
  daysSelected: string[];
  monthlyTotal: number;
  annualTotal: number;
  scopeOfWorks: string;
  // Pilot fields
  applyPilotPricing: boolean;
  pilotMonthlyTotal: number | null;
  pilotSavings: number | null;
  pilotStartDate: string | null;
  pilotEndDate: string | null;
  pilotReviewDate: string | null;
  standardPricingStartDate: string | null;
  // Metadata
  createdAt: string;
}

// ──────────────────────────────────────────────
// BRAND COLOURS
// ──────────────────────────────────────────────

const BRAND_GREEN = "#22c55e";
const DARK_TEXT = "#1a1a1a";
const BODY_TEXT = "#374151";
const LIGHT_BG = "#f9fafb";
const BORDER_COLOR = "#e5e7eb";
const WHITE = "#ffffff";

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
  // Cover page
  coverPage: {
    fontFamily: "Helvetica",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 50,
  },
  coverAccentBar: {
    width: "100%",
    height: 6,
    backgroundColor: BRAND_GREEN,
    marginBottom: 60,
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
    marginBottom: 30,
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
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 9,
    color: "#9ca3af",
  },
  // Section headers
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  subHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    marginTop: 10,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.6,
    color: BODY_TEXT,
    marginBottom: 4,
  },
  // Pricing table
  pricingTable: {
    marginTop: 10,
    marginBottom: 16,
  },
  pricingRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pricingRowHighlight: {
    flexDirection: "row",
    backgroundColor: BRAND_GREEN,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 4,
  },
  pricingLabel: {
    flex: 1,
    fontSize: 11,
    color: BODY_TEXT,
  },
  pricingValue: {
    width: 140,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
    textAlign: "right",
  },
  pricingLabelHighlight: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
  },
  pricingValueHighlight: {
    width: 140,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    textAlign: "right",
  },
  // Pilot box
  pilotBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: BRAND_GREEN,
    borderRadius: 4,
    padding: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  pilotTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BRAND_GREEN,
    marginBottom: 8,
  },
  pilotRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  pilotLabel: {
    width: 180,
    fontSize: 10,
    color: BODY_TEXT,
  },
  pilotValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK_TEXT,
  },
  // Scope section
  scopeText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
    marginBottom: 3,
  },
  // Terms section
  termItem: {
    fontSize: 9,
    lineHeight: 1.5,
    color: BODY_TEXT,
    marginBottom: 6,
    paddingLeft: 12,
  },
  // Declaration
  declarationBox: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
    padding: 16,
    marginTop: 16,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: DARK_TEXT,
    width: 200,
    marginTop: 30,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 16,
  },
  // Page footer
  pageFooter: {
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

function formatCurrency(amount: number): string {
  return `\u00a3${amount.toLocaleString("en-GB")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSiteType(siteType: string): string {
  const map: Record<string, string> = {
    OfficeCommercial: "Office / Commercial",
    WelfareConstruction: "Welfare / Construction",
    HospitalityVenue: "Hospitality / Venue",
    EducationInstitutional: "Education / Institutional",
    SpecialistIndustrial: "Specialist / Industrial",
    DentalMedical: "Dental / Medical",
  };
  return map[siteType] || siteType;
}

// ──────────────────────────────────────────────
// PAGE FOOTER COMPONENT
// ──────────────────────────────────────────────

function PageFooter({ quoteRef }: { quoteRef: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>Signature Cleans Ltd | Exeter, Devon</Text>
      <Text>Ref: {quoteRef}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────
// COVER PAGE
// ──────────────────────────────────────────────

function CoverPage({ data }: { data: QuotePDFData }) {
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverAccentBar} />
      <Text style={styles.coverTitle}>Signature Cleans</Text>
      <Text style={styles.coverSubtitle}>Professional Cleaning Quotation</Text>

      <View style={styles.coverDetailBlock}>
        <Text style={styles.coverLabel}>Prepared For</Text>
        <Text style={styles.coverValue}>{data.companyName}</Text>

        <Text style={styles.coverLabel}>Contact</Text>
        <Text style={styles.coverValue}>{data.contactName}</Text>

        <Text style={styles.coverLabel}>Site Address</Text>
        <Text style={styles.coverValue}>{data.address}</Text>

        <Text style={styles.coverLabel}>Site Type</Text>
        <Text style={styles.coverValue}>{formatSiteType(data.siteType)}</Text>

        <Text style={styles.coverLabel}>Quote Reference</Text>
        <Text style={styles.coverValue}>{data.quoteRef}</Text>

        <Text style={styles.coverLabel}>Date</Text>
        <Text style={{ ...styles.coverValue, marginBottom: 0 }}>
          {formatDate(data.createdAt)}
        </Text>
      </View>

      <Text style={styles.coverFooter}>
        Signature Cleans Ltd | Exeter, Devon | info@signature-cleans.co.uk
      </Text>
    </Page>
  );
}

// ──────────────────────────────────────────────
// SCOPE OF WORKS PAGE(S)
// ──────────────────────────────────────────────

function ScopeOfWorksSection({ data }: { data: QuotePDFData }) {
  const lines = data.scopeOfWorks.split("\n");

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeader}>Scope of Works</Text>
      <Text style={{ ...styles.bodyText, marginBottom: 8 }}>
        The following specification details the cleaning services to be provided at{" "}
        {data.address} for {data.companyName}. Service days: {data.daysSelected.join(", ")}.
      </Text>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <Text key={idx} style={{ marginBottom: 4 }}>{" "}</Text>;

        const isMainHeader = /^(SCOPE OF WORKS|[0-9]+\.\s+[A-Z]{3,})/.test(trimmed);
        const isSubHeader = /^[0-9]+\.[0-9]+\s/.test(trimmed);

        if (isMainHeader) {
          return (
            <Text key={idx} style={styles.subHeader}>
              {trimmed}
            </Text>
          );
        }
        if (isSubHeader) {
          return (
            <Text key={idx} style={{ ...styles.subHeader, fontSize: 10 }}>
              {trimmed}
            </Text>
          );
        }
        return (
          <Text key={idx} style={styles.scopeText}>
            {trimmed}
          </Text>
        );
      })}
      <PageFooter quoteRef={data.quoteRef} />
    </Page>
  );
}

// ──────────────────────────────────────────────
// PRICING PAGE
// ──────────────────────────────────────────────

function PricingSection({ data }: { data: QuotePDFData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeader}>Pricing</Text>
      <Text style={styles.bodyText}>
        Based on the scope of works outlined, we are pleased to present the following pricing
        for the regular cleaning of your premises at {data.address}.
      </Text>

      <View style={styles.pricingTable}>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Service Days</Text>
          <Text style={styles.pricingValue}>{data.daysSelected.join(", ")}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Site Type</Text>
          <Text style={styles.pricingValue}>{formatSiteType(data.siteType)}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>Annual Contract Value</Text>
          <Text style={styles.pricingValue}>{formatCurrency(data.annualTotal)}</Text>
        </View>
        <View style={styles.pricingRowHighlight}>
          <Text style={styles.pricingLabelHighlight}>Monthly Investment</Text>
          <Text style={styles.pricingValueHighlight}>
            {formatCurrency(data.monthlyTotal)} per month
          </Text>
        </View>
      </View>

      {data.applyPilotPricing && data.pilotMonthlyTotal != null && (
        <View style={styles.pilotBox}>
          <Text style={styles.pilotTitle}>Introductory Pilot Pricing</Text>
          <Text style={{ ...styles.bodyText, marginBottom: 8 }}>
            To demonstrate our commitment to delivering outstanding service, we are pleased
            to offer a 30-day introductory pilot period at a discounted rate.
          </Text>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Pilot Monthly Rate:</Text>
            <Text style={styles.pilotValue}>{formatCurrency(data.pilotMonthlyTotal)} per month</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Standard Monthly Rate:</Text>
            <Text style={styles.pilotValue}>{formatCurrency(data.monthlyTotal)} per month</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Your Saving During Pilot:</Text>
            <Text style={styles.pilotValue}>{formatCurrency(data.pilotSavings || 0)} per month</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Pilot Start Date:</Text>
            <Text style={styles.pilotValue}>{formatDate(data.pilotStartDate)}</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Pilot End Date:</Text>
            <Text style={styles.pilotValue}>{formatDate(data.pilotEndDate)}</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Review Meeting:</Text>
            <Text style={styles.pilotValue}>{formatDate(data.pilotReviewDate)}</Text>
          </View>
          <View style={styles.pilotRow}>
            <Text style={styles.pilotLabel}>Standard Pricing From:</Text>
            <Text style={styles.pilotValue}>{formatDate(data.standardPricingStartDate)}</Text>
          </View>
        </View>
      )}

      <Text style={{ ...styles.bodyText, marginTop: 8 }}>
        All prices are exclusive of VAT. Payment terms: monthly in advance by bank transfer
        or direct debit. A minimum notice period of 30 days applies.
      </Text>

      <PageFooter quoteRef={data.quoteRef} />
    </Page>
  );
}

// ──────────────────────────────────────────────
// TERMS & CONDITIONS PAGE
// ──────────────────────────────────────────────

function TermsSection({ data }: { data: QuotePDFData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeader}>Terms &amp; Conditions</Text>

      <Text style={styles.subHeader}>1. Service Agreement</Text>
      <Text style={styles.termItem}>
        1.1 This quotation is valid for 30 days from the date of issue. After this period,
        Signature Cleans reserves the right to re-quote.
      </Text>
      <Text style={styles.termItem}>
        1.2 The service will commence on the agreed start date and continue on a rolling
        monthly basis unless a fixed term is agreed in writing.
      </Text>
      <Text style={styles.termItem}>
        1.3 Either party may terminate the agreement by providing 30 days&apos; written notice.
      </Text>

      <Text style={styles.subHeader}>2. Payment Terms</Text>
      <Text style={styles.termItem}>
        2.1 Invoices are raised monthly in advance and are payable within 14 days of the
        invoice date by bank transfer or direct debit.
      </Text>
      <Text style={styles.termItem}>
        2.2 Signature Cleans reserves the right to charge interest on overdue invoices at a
        rate of 4% above the Bank of England base rate, in accordance with the Late Payment
        of Commercial Debts (Interest) Act 1998.
      </Text>

      <Text style={styles.subHeader}>3. Service Standards</Text>
      <Text style={styles.termItem}>
        3.1 All cleaning will be carried out in accordance with the scope of works detailed
        in this quotation.
      </Text>
      <Text style={styles.termItem}>
        3.2 Signature Cleans will conduct regular quality audits to ensure consistent service
        delivery. Audit reports will be shared with the client upon request.
      </Text>
      <Text style={styles.termItem}>
        3.3 Any complaints or service issues must be reported within 24 hours. Signature Cleans
        will respond within 4 working hours and resolve within 24 hours.
      </Text>

      <Text style={styles.subHeader}>4. Access &amp; Security</Text>
      <Text style={styles.termItem}>
        4.1 The client will provide reasonable access to all areas requiring cleaning at the
        agreed times.
      </Text>
      <Text style={styles.termItem}>
        4.2 Signature Cleans will hold keys/access fobs securely and maintain a key register.
        All operatives are DBS-checked and trained in site security procedures.
      </Text>

      <Text style={styles.subHeader}>5. Insurance &amp; Compliance</Text>
      <Text style={styles.termItem}>
        5.1 Signature Cleans holds Public Liability insurance to the value of \u00a35,000,000
        and Employers&apos; Liability insurance to the value of \u00a310,000,000.
      </Text>
      <Text style={styles.termItem}>
        5.2 All operatives are trained in COSHH regulations and hold relevant certifications
        for the site type.
      </Text>

      <Text style={styles.subHeader}>6. Price Reviews</Text>
      <Text style={styles.termItem}>
        6.1 Prices are fixed for the initial 12-month period. Thereafter, Signature Cleans
        may apply an annual increase aligned with the Consumer Price Index (CPI) or National
        Living Wage changes, whichever is greater, with 60 days&apos; written notice.
      </Text>

      <Text style={styles.subHeader}>7. Consumables</Text>
      <Text style={styles.termItem}>
        7.1 Unless otherwise agreed, the supply of consumables (toilet rolls, paper towels,
        hand soap, bin liners) remains the responsibility of the client. Cleaning chemicals
        and equipment are provided by Signature Cleans.
      </Text>

      <PageFooter quoteRef={data.quoteRef} />
    </Page>
  );
}

// ──────────────────────────────────────────────
// DECLARATION OF ACCEPTANCE PAGE
// ──────────────────────────────────────────────

function DeclarationSection({ data }: { data: QuotePDFData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionHeader}>Declaration of Acceptance</Text>

      <Text style={styles.bodyText}>
        I confirm that I have read and understood the scope of works, pricing, and terms
        and conditions set out in this quotation (Ref: {data.quoteRef}). I accept the
        quotation and authorise Signature Cleans to commence services as described.
      </Text>

      <View style={styles.declarationBox}>
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.coverLabel}>Company</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
              {data.companyName}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.coverLabel}>Quote Reference</Text>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK_TEXT }}>
              {data.quoteRef}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.coverLabel}>Monthly Investment</Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND_GREEN }}>
              {formatCurrency(data.applyPilotPricing && data.pilotMonthlyTotal
                ? data.pilotMonthlyTotal
                : data.monthlyTotal)} per month
            </Text>
            {data.applyPilotPricing && data.pilotMonthlyTotal && (
              <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>
                (Pilot rate for 30 days, then {formatCurrency(data.monthlyTotal)}/month)
              </Text>
            )}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, marginRight: 20 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorised Signature</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Print Name</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, marginRight: 20 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Position / Job Title</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Date</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={{ ...styles.bodyText, marginTop: 20, fontSize: 9 }}>
        Please sign and return this page to confirm your acceptance. You may return a scanned
        copy via email to nick@signature-cleans.co.uk or post to Signature Cleans Ltd, Exeter,
        Devon.
      </Text>

      <Text style={{ ...styles.bodyText, marginTop: 12, fontSize: 9, color: "#9ca3af" }}>
        Signature Cleans Ltd is a registered company in England and Wales. This quotation
        constitutes an offer to provide services and does not form a binding contract until
        accepted by both parties.
      </Text>

      <PageFooter quoteRef={data.quoteRef} />
    </Page>
  );
}

// ──────────────────────────────────────────────
// MAIN PDF DOCUMENT
// ──────────────────────────────────────────────

export function QuotePDF({ data }: { data: QuotePDFData }) {
  return (
    <Document
      title={`Signature Cleans Quote - ${data.quoteRef}`}
      author="Signature Cleans Ltd"
      subject={`Cleaning Quotation for ${data.companyName}`}
    >
      <CoverPage data={data} />
      <ScopeOfWorksSection data={data} />
      <PricingSection data={data} />
      <TermsSection data={data} />
      <DeclarationSection data={data} />
    </Document>
  );
}
