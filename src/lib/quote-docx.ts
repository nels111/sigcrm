import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateQuotePDF(quote: any): Promise<Buffer> {
  const isPilot =
    quote.applyPilotPricing === true && quote.pilotMonthlyTotal != null;

  const templatePath = path.join(
    process.cwd(),
    "templates",
    isPilot ? "pilot-quote.docx" : "standard-quote.docx"
  );
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const scopeText = Array.isArray(quote.scopeOfWorks)
    ? quote.scopeOfWorks.join("\n")
    : (quote.scopeOfWorks ?? "");

  const frequency = `${quote.frequencyPerWeek}x per week (${(quote.daysSelected ?? []).join(", ")}), ${quote.hoursPerDay} hours per visit`;

  const dateStr = new Date(quote.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const data = isPilot
    ? {
        Date: dateStr,
        QuoteRef: quote.quoteRef,
        CompanyName: quote.companyName,
        Address: quote.address,
        ContactName: quote.contactName,
        SiteName: quote.companyName,
        Frequency: frequency,
        CleaningSchedule: frequency,
        FullMonthlyTotal: `\u00A3${Number(quote.monthlyTotal).toFixed(2)} per calendar month, excl. VAT`,
        PilotMonthlyTotal: `\u00A3${Number(quote.pilotMonthlyTotal).toFixed(2)} per calendar month, excl. VAT`,
        PilotDiscountPercent: `${Math.round(((Number(quote.monthlyTotal) - Number(quote.pilotMonthlyTotal)) / Number(quote.monthlyTotal)) * 100)}%`,
        ScopeOfWorks: scopeText,
      }
    : {
        Date: dateStr,
        QuoteRef: quote.quoteRef,
        CompanyName: quote.companyName,
        Address: quote.address,
        ContactName: quote.contactName,
        ContactPhone: quote.contactPhone ?? "TBC",
        SiteName: quote.companyName,
        Frequency: frequency,
        MonthlyTotal: `\u00A3${Number(quote.monthlyTotal).toFixed(2)} per calendar month, excl. VAT`,
        ScopeOfWorks: scopeText,
      };

  doc.render(data);

  const tmpDir = os.tmpdir();
  const tmpDocx = path.join(
    tmpDir,
    `quote-${quote.quoteRef}-${Date.now()}.docx`
  );
  const tmpPdf = tmpDocx.replace(".docx", ".pdf");

  const buf = doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(tmpDocx, buf);

  execSync(
    `libreoffice --headless --convert-to pdf --outdir "${tmpDir}" "${tmpDocx}"`,
    { timeout: 30000 }
  );

  const pdfBuffer = fs.readFileSync(tmpPdf);

  fs.unlinkSync(tmpDocx);
  fs.unlinkSync(tmpPdf);

  return pdfBuffer;
}
