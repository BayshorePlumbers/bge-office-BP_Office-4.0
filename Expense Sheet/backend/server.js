// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cors from "cors";
import twilioPkg from "twilio";
import { google } from "googleapis";
import { Readable } from "stream";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Load Google credentials either from ENV or files ----------
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

// Allow storing the JSON as env vars in Render (safer than committing files)
const CREDENTIALS_JSON = process.env.CREDENTIALS_JSON;
const TOKEN_JSON = process.env.TOKEN_JSON;

let credsInstalled, tokens;
try {
  if (CREDENTIALS_JSON && TOKEN_JSON) {
    credsInstalled = JSON.parse(CREDENTIALS_JSON).installed;
    tokens = JSON.parse(TOKEN_JSON);
  } else {
    // local dev fallback: read from files
    if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
      console.error("Missing credentials.json or token.json.");
      process.exit(1);
    }
    credsInstalled = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8")).installed;
    tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  }
} catch (e) {
  console.error("Failed to parse Google credentials/token JSON.", e);
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(
  credsInstalled.client_id,
  credsInstalled.client_secret,
  credsInstalled.redirect_uris?.[0]
);
oAuth2Client.setCredentials(tokens);

const drive = google.drive({ version: "v3", auth: oAuth2Client });
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// ---------- Env / Twilio ----------
const {
  PORT = 8080,
  DRIVE_FOLDER_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM,
  // Set to "true" if you need CORS (not needed when frontend is served here)
  ENABLE_CORS = "false",
} = process.env;

console.log("ENV check:", {
  DRIVE_FOLDER_ID: DRIVE_FOLDER_ID ? "(set)" : "(missing)",
  TWILIO_FROM: TWILIO_FROM || "(missing)",
  CREDENTIALS_SOURCE: CREDENTIALS_JSON ? "env" : "file",
  TOKEN_SOURCE: TOKEN_JSON ? "env" : "file",
});

const twilio =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilioPkg(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

// ---------- App ----------
const app = express();
app.use(express.json({ limit: "25mb" }));

if (ENABLE_CORS === "true") app.use(cors()); // not needed when serving UI below

// Serve the frontend from /public
const publicDir = path.join(__dirname, "public");
fs.mkdirSync(publicDir, { recursive: true });
app.use(express.static(publicDir));

// Root → open landing
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "pes.html"));
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------- Helpers ----------
function toBase64Url(str) {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function uploadToDrive(filename, pdfBase64) {
  if (!DRIVE_FOLDER_ID) throw new Error("DRIVE_FOLDER_ID not set in env");

  const safe = filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
  try {
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const media = {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer), // stream body (required by googleapis)
    };
    const fileMetadata = { name: safe, parents: [DRIVE_FOLDER_ID] };

    const createRes = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,name,webViewLink,webContentLink",
    });

    const fileId = createRes.data.id;

    // Anyone-with-link viewer
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const getRes = await drive.files.get({
      fileId,
      fields: "id,name,webViewLink,webContentLink",
    });

    return {
      fileId,
      name: getRes.data.name,
      url: getRes.data.webViewLink || getRes.data.webContentLink,
    };
  } catch (e) {
    const gerr = e?.response?.data || e?.errors || e?.message || e;
    console.error("Drive upload error:", JSON.stringify(gerr, null, 2));
    throw new Error("DRIVE_UPLOAD_FAILED");
  }
}

async function sendSmsLink(phones = [], url) {
  if (!twilio) return;
  await Promise.all(
    phones.map((to) =>
      twilio.messages.create({
        to,
        from: TWILIO_FROM,
        body: `New Bayshore Field Ticket: ${url}`,
      })
    )
  );
}

function buildMimeEmail({ from, to, subject, html, attachmentName, attachmentBase64 }) {
  const boundary = "bayshore-mep-boundary";
  const parts = [];

  parts.push("MIME-Version: 1.0");
  parts.push(`From: ${from}`);
  parts.push(`To: ${to.join(", ")}`);
  parts.push(`Subject: ${subject}`);
  parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"\n`);
  parts.push(`--${boundary}`);
  parts.push("Content-Type: text/html; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: 7bit\n");
  parts.push(html + "\n");

  if (attachmentBase64) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: application/pdf; name="${attachmentName}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-Disposition: attachment; filename="${attachmentName}"\n`);
    const chunk = attachmentBase64.match(/.{1,76}/g)?.join("\n") || attachmentBase64;
    parts.push(chunk + "\n");
  }

  parts.push(`--${boundary}--`);

  const mime = parts.join("\n");
  return toBase64Url(Buffer.from(mime).toString("base64"));
}

async function sendEmailWithAttachment({ emails, subject, bodyHtml, filename, pdfBase64 }) {
  const raw = buildMimeEmail({
    from: "lalit@bayshoreplumbers.com",
    to: emails,
    subject,
    html: bodyHtml,
    attachmentName: filename,
    attachmentBase64: pdfBase64,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

// ---------- Routes ----------
app.post("/api/upload-pdf", async (req, res) => {
  try {
    const { filename, pdfBase64 } = req.body || {};
    if (!filename || !pdfBase64) return res.status(400).json({ error: "Missing filename or pdfBase64" });
    const out = await uploadToDrive(filename, pdfBase64);
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("/api/upload-pdf failed:", e?.message || e);
    res.status(500).json({ error: e?.message || "Failed to upload PDF to Drive" });
  }
});

app.post("/api/send", async (req, res) => {
  try {
    const {
      filename,
      pdfBase64,
      recipients = { phones: [], emails: [] },
      emailSubject = "New Field Materials & Expense Ticket",
      emailBody = "Team, a new field ticket has been submitted. PDF attached and link included.",
    } = req.body || {};

    if (!filename || !pdfBase64) return res.status(400).json({ error: "Missing filename or pdfBase64" });

    const uploaded = await uploadToDrive(filename, pdfBase64);
    await sendSmsLink(recipients.phones || [], uploaded.url);

    const html = `<p>${emailBody}</p><p><a href="${uploaded.url}" target="_blank">Open in Google Drive</a></p>`;
    if ((recipients.emails || []).length) {
      await sendEmailWithAttachment({
        emails: recipients.emails,
        subject: emailSubject,
        bodyHtml: html,
        filename,
        pdfBase64,
      });
    }

    res.json({ ok: true, url: uploaded.url, fileId: uploaded.fileId });
  } catch (e) {
    console.error("/api/send failed:", e?.message || e);
    res.status(500).json({ error: e?.message || "Failed to send PDF" });
  }
});

// ---- Self-test ----
app.get("/self-test", async (_req, res) => {
  try {
    if (!DRIVE_FOLDER_ID) return res.status(500).json({ error: "DRIVE_FOLDER_ID missing" });

    const content = Buffer.from("Bayshore MEP self-test " + new Date().toISOString());
    const createRes = await drive.files.create({
      requestBody: { name: "bayshore-self-test.txt", parents: [DRIVE_FOLDER_ID] },
      media: { mimeType: "text/plain", body: Readable.from(content) },
      fields: "id,name",
    });
    res.json({ ok: true, created: createRes.data });
  } catch (e) {
    const gerr = e?.response?.data || e?.errors || e?.message || e;
    console.error("SELF-TEST error:", JSON.stringify(gerr, null, 2));
    res.status(500).json({ error: gerr });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Bayshore M.E.P. backend running on port ${PORT}`);
});