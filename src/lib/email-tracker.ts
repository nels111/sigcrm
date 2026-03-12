import { v4 as uuidv4 } from "uuid";

export function generateTrackingId(): string {
  return uuidv4();
}

export function injectTrackingPixel(html: string, trackingId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || "https://crm.signature-cleans.co.uk";
  const pixel = `<img src="${baseUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none;" alt="" />`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}
