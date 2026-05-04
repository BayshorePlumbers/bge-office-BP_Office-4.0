// oauth-init.js (local server flow)
import fs from "fs";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/gmail.send"
];

const CREDENTIALS_PATH = "./credentials.json";
const TOKEN_PATH = "./token.json";

async function main() {
  // If token already exists, exit
  if (fs.existsSync(TOKEN_PATH)) {
    console.log("token.json already exists. Delete it if you want to re-auth.");
    return;
  }

  // Launch browser, run a temporary localhost receiver, and authenticate
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH
  });

  // Save tokens (includes refresh_token)
  const tokens = auth.credentials;
  if (!tokens || (!tokens.refresh_token && !tokens.access_token)) {
    throw new Error("No tokens returned from Google auth.");
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("\n✅ Saved tokens to token.json\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
