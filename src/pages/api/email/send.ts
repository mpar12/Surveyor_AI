import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { db } from "@/db/client";
import { emailSends } from "@/db/schema";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function normalizeRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => EMAIL_REGEX.test(entry));
}

const buildEmailHtml = (body: string, agentLink: string) => {
  const safeBody = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = safeBody.split("\n").join("<br />");

  if (!agentLink) {
    return `<div>${lines}</div>`;
  }

  const buttonHtml = `<div style=\"margin-top:16px;\"><a href=\"${agentLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;\">Open Survey</a></div>`;

  if (safeBody.includes(agentLink)) {
    const replaced = safeBody
      .split(agentLink)
      .join(
        `<a href=\"${agentLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:#2563eb;font-weight:600;\">${agentLink}</a>`
      );
    return `<div>${replaced.replace(/\n/g, "<br />")}${buttonHtml}</div>`;
  }

  return `<div>${lines}${buttonHtml}</div>`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const bodyPayload = typeof req.body === "object" && req.body !== null ? req.body : {};
  const rawSessionId = (bodyPayload as Record<string, unknown>).sessionId;
  const rawRecipients = (bodyPayload as Record<string, unknown>).recipients;
  const rawSubject = (bodyPayload as Record<string, unknown>).subject;
  const rawBody = (bodyPayload as Record<string, unknown>).body;
  const rawAgentLink = (bodyPayload as Record<string, unknown>).agentLink;
  const rawHtmlBody = (bodyPayload as Record<string, unknown>).htmlBody;

  const recipients = normalizeRecipients(rawRecipients);
  const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";
  const body = typeof rawBody === "string" ? rawBody : "";
  const agentLink = typeof rawAgentLink === "string" ? rawAgentLink.trim() : "";
  const sessionId = isValidUuid(rawSessionId) ? rawSessionId : null;
  const htmlBody = typeof rawHtmlBody === "string" ? rawHtmlBody : null;

  if (!recipients.length) {
    return res.status(400).json({ error: "At least one valid recipient is required." });
  }

  if (!subject) {
    return res.status(400).json({ error: "Email subject is required." });
  }

  if (!body.trim()) {
    return res.status(400).json({ error: "Email body cannot be empty." });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM_EMAIL ?? user;
  const fromName = process.env.SMTP_FROM_NAME ?? "SurvAgent";

  if (!host || !port || !user || !pass || !fromEmail) {
    return res.status(500).json({ error: "Email service is not configured." });
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  let status: "sent" | "failed" = "sent";
  let providerResponse: Record<string, unknown> | null = null;

  try {
    const info = await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: fromEmail,
      bcc: recipients,
      subject,
      text: agentLink ? `${body}\n\nSurvey link: ${agentLink}` : body,
      html: htmlBody ?? buildEmailHtml(body, agentLink)
    });

    providerResponse = info as unknown as Record<string, unknown>;
  } catch (error) {
    status = "failed";
    providerResponse = {
      error: error instanceof Error ? error.message : "Unknown email error"
    };

    await db.insert(emailSends).values({
      sessionId,
      recipients,
      subject,
      body,
      status,
      providerResponse,
      sentAt: new Date()
    });

    return res.status(502).json({ error: "Unable to send email. Please try again." });
  }

  await db.insert(emailSends).values({
    sessionId,
    recipients,
    subject,
    body,
    status,
    providerResponse,
    sentAt: new Date()
  });

  return res.status(200).json({ status: "sent" });
}
