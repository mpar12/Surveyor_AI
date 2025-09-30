import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts, emailSends, sessionContexts, sessions } from "@/db/schema";
import { desc, eq, or } from "drizzle-orm";

interface ScorecardProps {
  sessionId: string | null;
  status: string | null;
  createdAt: string | null;
  context?: {
    requester?: string | null;
    company?: string | null;
    product?: string | null;
    feedbackDesired?: string | null;
    desiredIcp?: string | null;
    desiredIcpIndustry?: string | null;
    desiredIcpRegion?: string | null;
    keyQuestions?: string | null;
  } | null;
  emailsSent: number;
  responders: number;
  callSummaries: Array<{ conversationId: string; summary: string | null; receivedAt: string | null }>;
  error?: string;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

export default function ScorecardPage({
  sessionId,
  status,
  createdAt,
  context,
  emailsSent,
  responders,
  callSummaries,
  error
}: ScorecardProps) {
  return (
    <div style={{ padding: "3rem 1.5rem", maxWidth: "960px", margin: "0 auto" }}>
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta name="description" content="Review responses captured for your SurvAgent session." />
      </Head>

      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>Scorecard</h1>
        {sessionId ? (
          <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
            Session <strong>{sessionId}</strong> · Created {formatDate(createdAt)} · Status: {status || "unknown"}
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            color: "#b91c1c",
            fontWeight: 600
          }}
        >
          {error}
        </div>
      ) : null}

      {!error && status === "closed" ? (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            padding: "1rem 1.25rem",
            color: "#92400e",
            fontWeight: 600,
            marginBottom: "1.5rem"
          }}
        >
          This session has been closed.
        </div>
      ) : null}

      {!error ? (
        <section style={{ display: "grid", gap: "1.5rem" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "1.5rem",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
              border: "1px solid #e5e7eb",
              display: "grid",
              gap: "1rem"
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111827" }}>Survey context</h2>
            <dl style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  Requester
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.requester || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  Desired ICP
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.desiredIcp || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  ICP Industry
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.desiredIcpIndustry || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  ICP Region
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.desiredIcpRegion || "—"}</dd>
              </div>
              <div>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  Feedback desired
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.feedbackDesired || "—"}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
                  Key questions
                </dt>
                <dd style={{ margin: 0, color: "#1f2937", fontWeight: 500 }}>{context?.keyQuestions || "—"}</dd>
              </div>
            </dl>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "1.5rem",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                border: "1px solid #e5e7eb"
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>Surveys sent</h3>
              <p style={{ fontSize: "2rem", fontWeight: 700, color: "#2563eb", margin: "0.25rem 0 0" }}>{emailsSent}</p>
              <p style={{ color: "#6b7280", marginTop: "0.4rem" }}>Unique recipients emailed across this session.</p>
            </div>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "1.5rem",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                border: "1px solid #e5e7eb"
              }}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>Responders</h3>
              <p style={{ fontSize: "2rem", fontWeight: 700, color: "#16a34a", margin: "0.25rem 0 0" }}>{responders}</p>
              <p style={{ color: "#6b7280", marginTop: "0.4rem" }}>Completed conversations with the AI agent.</p>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "1.5rem",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
              border: "1px solid #e5e7eb"
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111827", marginBottom: "1rem" }}>
              Summary of each call
            </h2>
            {callSummaries.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No completed calls yet.</p>
            ) : (
              <ul style={{ display: "grid", gap: "1rem", padding: 0, listStyle: "none" }}>
                {callSummaries.map((summary) => (
                  <li
                    key={summary.conversationId}
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "16px",
                      padding: "1.1rem"
                    }}
                  >
                    <div style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.45rem" }}>
                      {formatDate(summary.receivedAt)}
                    </div>
                    <div style={{ color: "#1f2937", lineHeight: 1.55 }}>
                      {summary.summary || "Summary not available."}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ScorecardProps> = async (context) => {
  const sidParam = context.query.sid;
  const pinParam = context.query.pin;
  const sid = typeof sidParam === "string" ? sidParam : Array.isArray(sidParam) ? sidParam[0] : null;
  const pin = typeof pinParam === "string" ? pinParam : Array.isArray(pinParam) ? pinParam[0] : null;

  if (!sid) {
    return {
      props: {
        sessionId: null,
        status: null,
        createdAt: null,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        error: "Missing session identifier."
      }
    };
  }

  try {
    const sessionRows = await db
      .select({ sessionId: sessions.sessionId, status: sessions.status, createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.sessionId, sid))
      .limit(1);

    if (sessionRows.length === 0) {
      return {
        props: {
          sessionId: sid,
          status: null,
          createdAt: null,
          context: null,
          emailsSent: 0,
          responders: 0,
          callSummaries: [],
          error: "Session not found."
        }
      };
    }

    const sessionRecord = sessionRows[0];

    const contextRows = await db
      .select({
        requester: sessionContexts.requester,
        company: sessionContexts.company,
        product: sessionContexts.product,
        feedbackDesired: sessionContexts.feedbackDesired,
        desiredIcp: sessionContexts.desiredIcp,
        desiredIcpIndustry: sessionContexts.desiredIcpIndustry,
        desiredIcpRegion: sessionContexts.desiredIcpRegion,
        keyQuestions: sessionContexts.keyQuestions
      })
      .from(sessionContexts)
      .where(eq(sessionContexts.sessionId, sid))
      .limit(1);

    const emailRows = await db
      .select({ recipients: emailSends.recipients })
      .from(emailSends)
      .where(eq(emailSends.sessionId, sid));

    const uniqueRecipients = new Set<string>();
    emailRows.forEach((row) => {
      const list = Array.isArray(row.recipients) ? (row.recipients as unknown[]) : [];
      list.forEach((entry) => {
        if (typeof entry === "string") {
          uniqueRecipients.add(entry);
        }
      });
    });

    const transcriptCondition = pin
      ? or(eq(convaiTranscripts.sessionId, sid), eq(convaiTranscripts.pinCode, pin))
      : eq(convaiTranscripts.sessionId, sid);

    const transcriptRows = await db
      .select({
        conversationId: convaiTranscripts.conversationId,
        summary: convaiTranscripts.analysis,
        receivedAt: convaiTranscripts.receivedAt
      })
      .from(convaiTranscripts)
      .where(transcriptCondition)
      .orderBy(desc(convaiTranscripts.receivedAt));

    const summaries = transcriptRows.map((row) => ({
      conversationId: row.conversationId,
      summary:
        row.summary && typeof row.summary === "object"
          ? ((row.summary as Record<string, unknown>).transcript_summary as string | null) ?? null
          : null,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null
    }));

    return {
      props: {
        sessionId: sessionRecord.sessionId,
        status: sessionRecord.status,
        createdAt: sessionRecord.createdAt ? sessionRecord.createdAt.toISOString() : null,
        context: contextRows[0] ?? null,
        emailsSent: uniqueRecipients.size,
        responders: summaries.length,
        callSummaries: summaries
      }
    };
  } catch (error) {
    console.error("Failed to load scorecard", error);
    return {
      props: {
        sessionId: sid,
        status: null,
        createdAt: null,
        context: null,
        emailsSent: 0,
        responders: 0,
        callSummaries: [],
        error: "Unable to load scorecard right now."
      }
    };
  }
};
