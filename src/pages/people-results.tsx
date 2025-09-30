import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  PEOPLE_SEARCH_STORAGE_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";

interface Contact {
  name: string;
  title: string;
  email: string;
  company: string;
  domain: string;
  location: string;
  email_status: string;
}

interface StoredPeopleSearch {
  contacts: Contact[];
  title: string;
  location: string;
  industry?: string;
  generatedAt?: number;
  sid?: string;
  pin?: string;
  requester?: string;
  company?: string;
  product?: string;
  feedbackDesired?: string;
  desiredIcp?: string;
  desiredIcpIndustry?: string;
  desiredIcpRegion?: string;
  debug?: {
    search?: unknown;
    enrichment?: unknown;
    bulkDetails?: unknown;
  };
  surveyQuestions?: string[];
}

type State =
  | { status: "loading" }
  | { status: "ready"; data: StoredPeopleSearch }
  | { status: "empty" }
  | { status: "error"; message: string };

const formatTimestamp = (value?: number) => {
  if (!value) {
    return "";
  }

  try {
    const date = new Date(value);
    return date.toLocaleString();
  } catch (error) {
    return "";
  }
};

export default function PeopleResultsPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const sidFromQuery = (() => {
    const raw = router.query.sid;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0];
    return undefined;
  })();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = sessionStorage.getItem(PEOPLE_SEARCH_STORAGE_KEY);

      if (!raw) {
        setState({ status: "empty" });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<StoredPeopleSearch>;

      if (!parsed || !Array.isArray(parsed.contacts)) {
        setState({ status: "error", message: "Saved results were malformed." });
        return;
      }

      setState({
        status: "ready",
        data: {
          contacts: parsed.contacts,
          title: parsed.title ?? "",
          location: parsed.location ?? "",
          industry: parsed.industry,
          generatedAt: parsed.generatedAt,
          sid: typeof parsed.sid === "string" ? parsed.sid : undefined,
          pin: typeof parsed.pin === "string" ? parsed.pin : undefined,
          requester: typeof parsed.requester === "string" ? parsed.requester : undefined,
          company: typeof parsed.company === "string" ? parsed.company : undefined,
          product: typeof parsed.product === "string" ? parsed.product : undefined,
          feedbackDesired:
            typeof parsed.feedbackDesired === "string" ? parsed.feedbackDesired : undefined,
          desiredIcp: typeof parsed.desiredIcp === "string" ? parsed.desiredIcp : undefined,
          desiredIcpIndustry:
            typeof parsed.desiredIcpIndustry === "string" ? parsed.desiredIcpIndustry : undefined,
          desiredIcpRegion:
            typeof parsed.desiredIcpRegion === "string" ? parsed.desiredIcpRegion : undefined,
          debug: parsed.debug,
          surveyQuestions: Array.isArray(parsed.surveyQuestions)
            ? (parsed.surveyQuestions as string[])
            : undefined
        }
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to read stored results."
      });
    }
  }, []);

  const handleBack = () => {
    router.push("/population");
  };

  const handlePrepareEmail = () => {
    if (state.status !== "ready") {
      return;
    }

    const recipients = Array.from(
      new Set(state.data.contacts.map((contact) => contact.email).filter((email) => Boolean(email)))
    );

    if (!recipients.length) {
      setPrepareError("No verified email addresses available to email.");
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(EMAIL_PREVIEW_RECIPIENTS_KEY, JSON.stringify(recipients));
      try {
        sessionStorage.setItem(
          PEOPLE_SEARCH_STORAGE_KEY,
          JSON.stringify({
            ...state.data,
            contacts: state.data.contacts
          })
        );
        if (Array.isArray(state.data.surveyQuestions)) {
          sessionStorage.setItem(
            SURVEY_QUESTIONS_STORAGE_KEY,
            JSON.stringify(state.data.surveyQuestions)
          );
        }
      } catch (storageError) {
        console.error("Failed to persist recipients or survey questions", storageError);
      }
    }

    const query: Record<string, string> = { source: "search" };

    const assign = (key: string, value?: string) => {
      if (value && value.trim()) {
        query[key] = value.trim();
      }
    };

    assign("name", state.data.requester);
    assign("company", state.data.company);
    assign("product", state.data.product);
    assign("feedbackDesired", state.data.feedbackDesired);
    assign("desiredIcp", state.data.desiredIcp);
    assign("desiredIcpIndustry", state.data.desiredIcpIndustry);
    assign("desiredIcpRegion", state.data.desiredIcpRegion);
    assign("sid", state.data.sid ?? sidFromQuery);
    assign("pin", state.data.pin);
    if (Array.isArray(state.data.surveyQuestions) && state.data.surveyQuestions.length) {
      try {
        const payload = JSON.stringify(state.data.surveyQuestions);
        if (typeof window !== "undefined") {
          const encoded = window.btoa(unescape(encodeURIComponent(payload)));
          assign("surveyQuestions", encoded);
        }
      } catch (encodingError) {
        console.error("Failed to encode survey questions for email preview", encodingError);
      }
    }

    setPrepareError(null);
    router.push({ pathname: "/email-preview", query });
  };

  const renderContent = () => {
    if (state.status === "loading") {
      return <p style={{ color: "#6b7280" }}>Loading saved results…</p>;
    }

    if (state.status === "error") {
      return (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "14px",
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#991b1b",
            fontWeight: 600
          }}
        >
          {state.message}
        </div>
      );
    }

    if (state.status === "empty") {
      return (
        <div style={{ color: "#6b7280" }}>
          No stored results found. Please rerun the search from the population page.
        </div>
      );
    }

    const { contacts, title, location, industry, generatedAt, debug } = state.data;

    return (
      <div style={{ display: "grid", gap: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={handlePrepareEmail}
            style={{
              borderRadius: "999px",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 600,
              padding: "0.6rem 1.6rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(37, 99, 235, 0.25)"
            }}
          >
            Prepare Email
          </button>
        </div>

        {prepareError ? (
          <div
            style={{
              padding: "0.9rem 1.1rem",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#b91c1c",
              fontWeight: 600
            }}
          >
            {prepareError}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gap: "0.45rem",
            padding: "1.25rem 1.5rem",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            background: "#f9fafb"
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827" }}>Search summary</h2>
          <div style={{ color: "#374151" }}>
            <strong>Title:</strong> {title || "—"}
          </div>
          <div style={{ color: "#374151" }}>
            <strong>Location:</strong> {location || "—"}
          </div>
          <div style={{ color: "#374151" }}>
            <strong>Industry:</strong> {industry || "—"}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Generated at {formatTimestamp(generatedAt) || "unknown time"}
          </div>
        </section>

        {contacts.length ? (
          <section>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#ffffff",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)"
              }}
            >
              <thead style={{ background: "#f3f4f6", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: "0.9rem 1.1rem", fontSize: "0.95rem", color: "#1f2937" }}>Name</th>
                  <th style={{ padding: "0.9rem 1.1rem", fontSize: "0.95rem", color: "#1f2937" }}>Title</th>
                  <th style={{ padding: "0.9rem 1.1rem", fontSize: "0.95rem", color: "#1f2937" }}>Email</th>
                  <th style={{ padding: "0.9rem 1.1rem", fontSize: "0.95rem", color: "#1f2937" }}>Company</th>
                  <th style={{ padding: "0.9rem 1.1rem", fontSize: "0.95rem", color: "#1f2937" }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={`${contact.email}-${contact.name}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.85rem 1.1rem", color: "#111827" }}>{contact.name || "—"}</td>
                    <td style={{ padding: "0.85rem 1.1rem", color: "#374151" }}>{contact.title || "—"}</td>
                    <td style={{ padding: "0.85rem 1.1rem", color: "#2563eb", fontWeight: 600 }}>
                      {contact.email}
                    </td>
                    <td style={{ padding: "0.85rem 1.1rem", color: "#111827" }}>{contact.company || "—"}</td>
                    <td style={{ padding: "0.85rem 1.1rem", color: "#374151" }}>{contact.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <div style={{ color: "#6b7280" }}>
            The search completed successfully, but no verified contacts were returned.
          </div>
        )}

        {Boolean(debug && (debug.search || debug.enrichment || debug.bulkDetails)) && (
          <section
            style={{
              display: "grid",
              gap: "1rem",
              padding: "1.25rem 1.5rem",
              borderRadius: "16px",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)"
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827" }}>
              Raw API responses
            </h2>
            {debug?.search ? (
              <details open>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Mixed People Search</summary>
                <pre
                  style={{
                    marginTop: "0.75rem",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: "#0f172a",
                    color: "#f8fafc",
                    overflowX: "auto"
                  }}
                >
                  {JSON.stringify(debug.search, null, 2)}
                </pre>
              </details>
            ) : null}
            {debug?.bulkDetails ? (
              <details open>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Bulk Match Payload</summary>
                <pre
                  style={{
                    marginTop: "0.75rem",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: "#0f172a",
                    color: "#f8fafc",
                    overflowX: "auto"
                  }}
                >
                  {JSON.stringify(debug.bulkDetails, null, 2)}
                </pre>
              </details>
            ) : null}
            {debug?.enrichment ? (
              <details open>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Bulk Match Results</summary>
                <pre
                  style={{
                    marginTop: "0.75rem",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: "#0f172a",
                    color: "#f8fafc",
                    overflowX: "auto"
                  }}
                >
                  {JSON.stringify(debug.enrichment, null, 2)}
                </pre>
              </details>
            ) : null}
          </section>
        )}

        {debug?.enrichment ? (
          <section
            style={{
              display: "grid",
              gap: "0.75rem",
              padding: "1.25rem 1.5rem",
              borderRadius: "16px",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)"
            }}
          >
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827" }}>
              Bulk Match contacts
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#ffffff",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)"
              }}
            >
              <thead style={{ background: "#f3f4f6", textAlign: "left" }}>
                <tr>
                  <th style={{ padding: "0.85rem 1rem", color: "#1f2937", fontSize: "0.95rem" }}>Name</th>
                  <th style={{ padding: "0.85rem 1rem", color: "#1f2937", fontSize: "0.95rem" }}>Title</th>
                  <th style={{ padding: "0.85rem 1rem", color: "#1f2937", fontSize: "0.95rem" }}>
                    Organization
                  </th>
                  <th style={{ padding: "0.85rem 1rem", color: "#1f2937", fontSize: "0.95rem" }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const payload = debug.enrichment as any;
                  const entries = Array.isArray(payload?.matches)
                    ? payload.matches
                    : Array.isArray(payload?.people)
                      ? payload.people
                      : Array.isArray(payload?.matched_people)
                        ? payload.matched_people
                        : Array.isArray(payload?.contacts)
                          ? payload.contacts
                          : [];

                  if (!entries.length) {
                    return (
                      <tr>
                        <td colSpan={4} style={{ padding: "0.85rem 1rem", color: "#6b7280" }}>
                          No contacts returned by bulk match.
                        </td>
                      </tr>
                    );
                  }

                  return entries.map((entry: any, index: number) => {
                    const person = entry.person ?? entry ?? {};
                    const organization = person.organization ?? entry.organization ?? {};
                    const employment = Array.isArray(person.employment_history)
                      ? person.employment_history
                      : Array.isArray(entry.employment_history)
                        ? entry.employment_history
                        : [];

                    const primaryEmployment = employment.find((job: any) => job?.is_primary) ?? employment[0] ?? {};

                    const name = person.name ?? [person.first_name, person.last_name].filter(Boolean).join(" ");
                    const title = person.title ?? person.headline ?? primaryEmployment?.title ?? entry.title;
                    const organizationName =
                      organization.name ?? primaryEmployment?.organization_name ?? entry.organization_name ?? "";

                    const emails = [
                      ...(entry.emails ?? []),
                      ...(person.emails ?? [])
                    ];

                    const email =
                      entry.email ??
                      person.email ??
                      (emails.find((item: any) => item?.email)?.email ?? "");

                    return (
                      <tr key={`${index}-${name}-${email}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.8rem 1rem", color: "#111827" }}>{name || "—"}</td>
                        <td style={{ padding: "0.8rem 1rem", color: "#374151" }}>{title || "—"}</td>
                        <td style={{ padding: "0.8rem 1rem", color: "#111827" }}>{organizationName || "—"}</td>
                        <td style={{ padding: "0.8rem 1rem", color: "#2563eb", fontWeight: 600 }}>{email || "—"}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <Head>
        <title>Search Results | SurvAgent</title>
        <meta name="description" content="Review the verified contacts sourced from Apollo." />
      </Head>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem"
        }}
      >
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#111827" }}>Verified contacts</h1>
          <p style={{ color: "#6b7280", marginTop: "0.35rem" }}>
            These leads were collected from the most recent population search.
          </p>
        </div>
        <button
          type="button"
          onClick={handleBack}
          style={{
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#1f2937",
            borderRadius: "999px",
            padding: "0.55rem 1.4rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          ← Back to population
        </button>
      </div>

      {renderContent()}

      {(() => {
        const storedSid = state.status === "ready" ? state.data.sid : undefined;
        const sessionId = storedSid ?? sidFromQuery;

        if (!sessionId) {
          return null;
        }

        const handleViewScorecard = () => {
          router.push({ pathname: "/scorecard", query: { sid: sessionId } });
        };

        return (
          <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleViewScorecard}
              style={{
                borderRadius: "999px",
                background: "#0ea5e9",
                color: "#ffffff",
                fontWeight: 600,
                padding: "0.65rem 1.8rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(14, 165, 233, 0.25)"
              }}
            >
              View session scorecard
            </button>
          </div>
        );
      })()}

      <div style={{ marginTop: "2.5rem", color: "#6b7280", fontSize: "0.9rem" }}>
        Need a fresh search? <Link href="/population">Run it again from the population page.</Link>
      </div>
    </div>
  );
}
