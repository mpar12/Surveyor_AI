import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { responses, sessions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

interface ResponseRecord {
  id: string;
  submittedAt: string | null;
  answers: Record<string, unknown> | null;
}

interface ScorecardProps {
  sessionId: string | null;
  status: string | null;
  createdAt: string | null;
  responses: ResponseRecord[];
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

export default function ScorecardPage({ sessionId, status, createdAt, responses, error }: ScorecardProps) {
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
              border: "1px solid #e5e7eb"
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111827" }}>Response summary</h2>
            <p style={{ marginTop: "0.35rem", color: "#4b5563" }}>
              Total responses collected: <strong>{responses.length}</strong>
            </p>
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
              Recent submissions
            </h2>

            {responses.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No responses yet.</p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  borderRadius: "16px",
                  overflow: "hidden",
                  background: "#f9fafb"
                }}
              >
                <thead style={{ background: "#eef2ff", color: "#312e81" }}>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Submitted</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr key={response.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "0.75rem 1rem", color: "#111827" }}>{formatDate(response.submittedAt)}</td>
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          color: "#374151",
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap"
                        }}
                      >
                        {response.answers ? JSON.stringify(response.answers, null, 2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ScorecardProps> = async (context) => {
  const sidParam = context.query.sid;
  const sid = typeof sidParam === "string" ? sidParam : Array.isArray(sidParam) ? sidParam[0] : null;

  if (!sid) {
    return {
      props: {
        sessionId: null,
        status: null,
        createdAt: null,
        responses: [],
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
          responses: [],
          error: "Session not found."
        }
      };
    }

    const sessionRecord = sessionRows[0];

    const responseRows = await db
      .select({ id: responses.id, submittedAt: responses.submittedAt, answers: responses.answers })
      .from(responses)
      .where(eq(responses.sessionId, sid))
      .orderBy(desc(responses.submittedAt));

    const serializedResponses: ResponseRecord[] = responseRows.map((row) => ({
      id: row.id,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      answers: (row.answers as Record<string, unknown> | null) ?? null
    }));

    return {
      props: {
        sessionId: sessionRecord.sessionId,
        status: sessionRecord.status,
        createdAt: sessionRecord.createdAt ? sessionRecord.createdAt.toISOString() : null,
        responses: serializedResponses
      }
    };
  } catch (error) {
    console.error("Failed to load scorecard", error);
    return {
      props: {
        sessionId: sid,
        status: null,
        createdAt: null,
        responses: [],
        error: "Unable to load scorecard right now."
      }
    };
  }
};
