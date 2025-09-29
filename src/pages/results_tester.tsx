import Head from "next/head";
import type { GetServerSideProps } from "next";
import { db } from "@/db/client";
import { convaiTranscripts } from "@/db/schema";
import { desc } from "drizzle-orm";

interface TranscriptRecord {
  conversationId: string;
  sessionId: string | null;
  pinCode: string | null;
  dynamicVariables: Record<string, unknown>;
  transcript: unknown[];
  completedAt: string | null;
  receivedAt: string | null;
}

interface ResultsTesterProps {
  records: TranscriptRecord[];
}

export const getServerSideProps: GetServerSideProps<ResultsTesterProps> = async () => {
  const rows = await db
    .select({
      conversationId: convaiTranscripts.conversationId,
      sessionId: convaiTranscripts.sessionId,
      pinCode: convaiTranscripts.pinCode,
      dynamicVariables: convaiTranscripts.dynamicVariables,
      transcript: convaiTranscripts.transcript,
      completedAt: convaiTranscripts.completedAt,
      receivedAt: convaiTranscripts.receivedAt
    })
    .from(convaiTranscripts)
    .orderBy(desc(convaiTranscripts.receivedAt))
    .limit(50);

  const records: TranscriptRecord[] = rows.map((row) => ({
    conversationId: row.conversationId,
    sessionId: row.sessionId ?? null,
    pinCode: row.pinCode ?? null,
    dynamicVariables: (row.dynamicVariables as Record<string, unknown>) ?? {},
    transcript: Array.isArray(row.transcript) ? (row.transcript as unknown[]) : [],
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null
  }));

  return {
    props: {
      records
    }
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

export default function ResultsTesterPage({ records }: ResultsTesterProps) {
  return (
    <div style={{ minHeight: "100vh", padding: "3rem 1.5rem", background: "#f3f4f6" }}>
      <Head>
        <title>Results Tester | SurvAgent</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={{ maxWidth: "960px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <header style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>ElevenLabs Transcript Tester</h1>
          <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
            Inspect the latest webhook payloads captured from the ElevenLabs conversational agent.
          </p>
        </header>

        {records.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              border: "1px solid #e5e7eb",
              textAlign: "center",
              color: "#6b7280"
            }}
          >
            No transcripts captured yet. Run a conversation with the agent to populate this table.
          </div>
        ) : null}

        {records.map((record) => (
          <section
            key={record.conversationId}
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
              padding: "1.5rem",
              display: "grid",
              gap: "1.25rem"
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
                  Conversation {record.conversationId}
                </h2>
                <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>
                  Received: {formatDate(record.receivedAt)} · Completed: {formatDate(record.completedAt)}
                </p>
              </div>
              <div style={{ color: "#4b5563", fontSize: "0.95rem", textAlign: "right" }}>
                {record.sessionId ? <div>Session: {record.sessionId}</div> : null}
                {record.pinCode ? <div>PIN: {record.pinCode}</div> : null}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", marginBottom: "0.6rem" }}>
                Dynamic variables
              </h3>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: "12px",
                  padding: "1rem",
                  overflowX: "auto",
                  fontSize: "0.9rem",
                  lineHeight: 1.6
                }}
              >
                {JSON.stringify(record.dynamicVariables, null, 2)}
              </pre>
            </div>

            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", marginBottom: "0.6rem" }}>
                Transcript
              </h3>
              {record.transcript.length === 0 ? (
                <div style={{ color: "#6b7280" }}>Transcript payload was empty.</div>
              ) : (
                <ol style={{ display: "grid", gap: "0.75rem", paddingLeft: "1.25rem" }}>
                  {record.transcript.map((entry, index) => {
                    if (typeof entry !== "object" || entry === null) {
                      return (
                        <li key={index} style={{ color: "#6b7280" }}>
                          Unsupported transcript entry
                        </li>
                      );
                    }

                    const item = entry as Record<string, unknown>;
                    const role = typeof item.role === "string" ? item.role : "unknown";
                    const message = typeof item.message === "string" ? item.message : "";
                    const timeInCall = typeof item.time_in_call_secs === "number" ? item.time_in_call_secs : null;

                    return (
                      <li
                        key={index}
                        style={{
                          background: role === "agent" ? "rgba(59, 130, 246, 0.08)" : "rgba(34, 197, 94, 0.12)",
                          borderRadius: "12px",
                          padding: "0.9rem 1rem",
                          color: "#1f2937"
                        }}
                      >
                        <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{role}</div>
                        <div style={{ marginTop: "0.45rem", lineHeight: 1.5 }}>{message || "—"}</div>
                        {timeInCall !== null ? (
                          <div style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "#6b7280" }}>
                            Time in call: {timeInCall.toFixed(1)}s
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
