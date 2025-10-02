import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  PEOPLE_SEARCH_STORAGE_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";
import styles from "@/styles/PeopleResults.module.css";

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
      return <p className={styles.statusText}>Loading saved results…</p>;
    }

    if (state.status === "error") {
      return <div className={styles.errorBanner}>{state.message}</div>;
    }

    if (state.status === "empty") {
      return (
        <div className={styles.statusText}>
          No stored results found. Please rerun the search from the population page.
        </div>
      );
    }

    const { contacts, title, location, industry, generatedAt, debug } = state.data;

    const bulkEntries = (() => {
      const payload = debug?.enrichment as any;
      if (!payload) {
        return [] as any[];
      }

      if (Array.isArray(payload?.matches)) return payload.matches;
      if (Array.isArray(payload?.people)) return payload.people;
      if (Array.isArray(payload?.matched_people)) return payload.matched_people;
      if (Array.isArray(payload?.contacts)) return payload.contacts;
      return [] as any[];
    })();

    return (
      <>
        <div className={styles.toolbar}>
          <button type="button" onClick={handlePrepareEmail} className={styles.primaryButton}>
            Prepare Email
          </button>
        </div>

        {prepareError ? <div className={styles.errorBanner}>{prepareError}</div> : null}

        <section className={styles.summaryCard}>
          <h2 className={styles.summaryHeading}>Search summary</h2>
          <div className={styles.summaryMeta}>
            <strong>Title:</strong> {title || "—"}
          </div>
          <div className={styles.summaryMeta}>
            <strong>Location:</strong> {location || "—"}
          </div>
          <div className={styles.summaryMeta}>
            <strong>Industry:</strong> {industry || "—"}
          </div>
          <div className={styles.summaryTimestamp}>
            Generated at {formatTimestamp(generatedAt) || "unknown time"}
          </div>
        </section>

        {contacts.length ? (
          <section className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={`${contact.email}-${contact.name}`}>
                    <td>{contact.name || "—"}</td>
                    <td>{contact.title || "—"}</td>
                    <td className={styles.emailCell}>{contact.email}</td>
                    <td>{contact.company || "—"}</td>
                    <td>{contact.location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {bulkEntries.length < 10 ? (
          <div className={styles.emptyState}>
            The search completed successfully, but no verified contacts were returned.
          </div>
        ) : null}

        {debug?.enrichment ? (
          <section className={styles.bulkSection}>
            <h2 className={styles.summaryHeading}>Bulk Match contacts</h2>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title</th>
                    <th>Organization</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkEntries.length ? (
                    bulkEntries.map((entry: any, index: number) => {
                      const person = entry.person ?? entry ?? {};
                      const organization = person.organization ?? entry.organization ?? {};
                      const companyName =
                        organization.name ?? organization.organization_name ?? entry.organization_name;
                      const email = entry.email ?? person.email ?? entry.work_email ?? "";
                      const fullName =
                        person.name ??
                        person.full_name ??
                        `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
                      const titleValue =
                        person.title ?? person.job_title ?? entry.title ?? entry.job_title ?? "—";

                      return (
                        <tr key={`bulk-${index}`}>
                          <td>{fullName || "—"}</td>
                          <td>{titleValue || "—"}</td>
                          <td>{companyName || "—"}</td>
                          <td className={styles.emailCell}>{email || "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.emptyState}>
                        No contacts returned by bulk match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </>
    );
  };

  const storedSid = state.status === "ready" ? state.data.sid : undefined;
  const sessionId = storedSid ?? sidFromQuery;

  const handleViewScorecard = () => {
    if (!sessionId) {
      return;
    }

    router.push({ pathname: "/scorecard", query: { sid: sessionId } });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>People results | SurvAgent</title>
      </Head>

      <div className={styles.lead}>
        <h1 className={styles.pageTitle}>Sourced contacts</h1>
        <p className={styles.pageSubtitle}>
          Review the verified prospects SurvAgent collected based on your intake criteria. Download the
          list or jump back to sourcing to refine your search.
        </p>
      </div>

      <div className={styles.card}>{renderContent()}</div>

      <div className={styles.actionsRow}>
        <Link href="/population" className={styles.backLink}>
          ← Back to sourcing options
        </Link>
        {sessionId ? (
          <button type="button" onClick={handleViewScorecard} className={styles.secondaryButton}>
            View session scorecard
          </button>
        ) : null}
      </div>
    </div>
  );
}
