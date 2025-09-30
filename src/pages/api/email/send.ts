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

  const safeLink = agentLink.replace(/"/g, "&quot;");
  const buttonHtml = `<div style=\"margin-top:16px;\"><a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"display:inline-block;padding:12px 20px;border-radius:10px;background:#2563eb;color:#ffffff;font-weight:600;text-decoration:none;\">Open Survey</a></div>`;

  if (safeBody.includes(agentLink)) {
    const replaced = safeBody
      .split(agentLink)
      .join(`<a href=\"${safeLink}\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color:#2563eb;font-weight:600;\">${agentLink}</a>`);
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

const recipients = normalizeRecipients(rawRecipients);
  const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";
  const body = typeof rawBody === "string" ? rawBody : "";
  const agentLink = typeof rawAgentLink === "string" ? rawAgentLink.trim() : "";
  const sessionId = isValidUuid(rawSessionId) ? rawSessionId : null;

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

  const uniqueRecipients = Array.from(new Set(recipients));

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  const appendEmailParam = (baseLink: string, email: string) => {
    if (!baseLink) {
      return "";
    }

    try {
      const url = new URL(baseLink);
      url.searchParams.set("email", email);
      return url.toString();
    } catch (error) {
      console.error("Failed to personalize survey link", error);
      return baseLink;
    }
  };

  const providerResponses: Array<Record<string, unknown>> = [];

  try {
    for (const recipient of uniqueRecipients) {
      const personalizedLink = appendEmailParam(agentLink, recipient);
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: recipient,
        subject,
        text: personalizedLink ? `${body}\n\nSurvey link: ${personalizedLink}` : body,
        html: buildEmailHtml(body, personalizedLink)
      });

      providerResponses.push({
        recipient,
        response: info as unknown as Record<string, unknown>
      });
    }
  } catch (error) {
    await db.insert(emailSends).values({
      sessionId,
      recipients: uniqueRecipients,
      subject,
      body,
      status: "failed",
      providerResponse: {
        error: error instanceof Error ? error.message : "Unknown email error",
        partial: providerResponses
      },
      sentAt: new Date()
    });

    return res.status(502).json({ error: "Unable to send email. Please try again." });
  }

  await db.insert(emailSends).values({
    sessionId,
    recipients: uniqueRecipients,
    subject,
    body,
    status: "sent",
    providerResponse: providerResponses,
    sentAt: new Date()
  });

  return res.status(200).json({ status: "sent" });
}
