/**
 * Zoho CRM — Exchange a Grant Token for a Refresh Token
 *
 * Usage:
 *   npx tsx scripts/zoho-get-refresh-token.ts <GRANT_TOKEN>
 *
 * Prerequisites:
 *   1. Create a Self Client at https://api-console.zoho.eu/
 *   2. Generate a grant token with scopes: ZohoCRM.modules.ALL, ZohoCRM.users.ALL
 *   3. Copy the grant token and run this script within 60 seconds (tokens expire quickly)
 *   4. Add the resulting refresh token to your .env as ZOHO_REFRESH_TOKEN
 */

import "dotenv/config";

const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.eu";
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

async function main() {
  const grantToken = process.argv[2];

  if (!grantToken) {
    console.error(
      "ERROR: No grant token provided.\n\n" +
        "Usage:\n" +
        "  npx tsx scripts/zoho-get-refresh-token.ts <GRANT_TOKEN>\n\n" +
        "Steps:\n" +
        "  1. Go to https://api-console.zoho.eu/ and create a Self Client\n" +
        "  2. Generate a grant token with scopes:\n" +
        "     ZohoCRM.modules.ALL, ZohoCRM.users.ALL\n" +
        "  3. Run this script within 60 seconds with the grant token"
    );
    process.exit(1);
  }

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    console.error(
      "ERROR: Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET in .env\n\n" +
        "Add these to your .env file:\n" +
        "  ZOHO_CLIENT_ID=your_client_id\n" +
        "  ZOHO_CLIENT_SECRET=your_client_secret"
    );
    process.exit(1);
  }

  console.log("Exchanging grant token for refresh token...");
  console.log(`  Accounts domain: ${ZOHO_ACCOUNTS_DOMAIN}`);
  console.log(`  Client ID: ${ZOHO_CLIENT_ID.substring(0, 8)}...`);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    code: grantToken,
  });

  const url = `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params.toString()}`;

  try {
    const response = await fetch(url, { method: "POST" });
    const data = await response.json();

    if (data.error) {
      console.error(`\nERROR from Zoho: ${data.error}`);
      if (data.error === "invalid_code") {
        console.error(
          "The grant token has expired or was already used. " +
            "Generate a new one and try again within 60 seconds."
        );
      }
      process.exit(1);
    }

    if (!data.refresh_token) {
      console.error("\nERROR: No refresh_token in response.");
      console.error("Full response:", JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("\n--- SUCCESS ---\n");
    console.log(`Refresh Token: ${data.refresh_token}`);
    console.log(`Access Token:  ${data.access_token?.substring(0, 20)}...`);
    console.log(`Expires In:    ${data.expires_in} seconds`);
    console.log(`API Domain:    ${data.api_domain}`);
    console.log("\n--- Add this to your .env file ---\n");
    console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
    console.log("");
  } catch (err) {
    console.error("Failed to exchange grant token:", err);
    process.exit(1);
  }
}

main();
