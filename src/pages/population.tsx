import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Population.module.css";
import {
  EMAIL_PREVIEW_RECIPIENTS_KEY,
  PEOPLE_SEARCH_STORAGE_KEY,
  SURVEY_QUESTIONS_STORAGE_KEY
} from "@/lib/storageKeys";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export default function PopulationPage() {
  const router = useRouter();
  const [manualSelected, setManualSelected] = useState(false);
  const [scrapeSelected, setScrapeSelected] = useState(false);
  const [emailCsv, setEmailCsv] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasValidEmails, setHasValidEmails] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<string[]>([]);

  const contextSummary = useMemo(() => {
    const name = getQueryValue(router.query.name);
    const company = getQueryValue(router.query.company);
    const product = getQueryValue(router.query.product);
    const feedbackDesired = getQueryValue(router.query.feedbackDesired);
    const keyQuestions = getQueryValue(router.query.keyQuestions);
    const desiredIcp = getQueryValue(router.query.desiredIcp);
    const desiredIcpIndustry = getQueryValue(router.query.desiredIcpIndustry);
    const desiredIcpRegion = getQueryValue(router.query.desiredIcpRegion);
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      name,
      company,
      product,
      feedbackDesired,
      keyQuestions,
      desiredIcp,
      desiredIcpIndustry,
      desiredIcpRegion,
      sid: sidValue,
      pin: pinValue,
      surveyQuestions
    };
  }, [
    router.query.name,
    router.query.company,
    router.query.product,
    router.query.feedbackDesired,
    surveyQuestions,
    router.query.keyQuestions,
    router.query.desiredIcp,
    router.query.desiredIcpIndustry,
    router.query.desiredIcpRegion,
    router.query.sid,
    router.query.pin
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = sessionStorage.getItem(SURVEY_QUESTIONS_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setSurveyQuestions(parsed);
        }
      } catch (error) {
        console.error("Failed to parse stored survey questions", error);
      }
    }
  }, []);

  const handleManualToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setManualSelected(isChecked);

    if (!isChecked) {
      setEmailCsv("");
      setEmailError(null);
      setHasValidEmails(false);
    }
  };

  const handleScrapeToggle = (event: ChangeEvent<HTMLInputElement>) => {
    setScrapeSelected(event.target.checked);

    if (!event.target.checked) {
      setSearchError(null);
      setIsSearching(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PEOPLE_SEARCH_STORAGE_KEY);
      }
    }
  };

  const handleEmailsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setEmailCsv(value);

    if (!value.trim()) {
      setEmailError(null);
      setHasValidEmails(false);
      return;
    }

    const entries = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!entries.length) {
      setEmailError("Provide at least one email address.");
      setHasValidEmails(false);
      return;
    }

    const invalidSample = entries.find((entry) => !EMAIL_REGEX.test(entry));

    if (invalidSample) {
      setEmailError(`"${invalidSample}" is not a valid email address.`);
      setHasValidEmails(false);
      return;
    }

    setEmailError(null);
    setHasValidEmails(true);
  };

  const handlePrepareEmailManual = () => {
    if (!manualSelected) {
      return;
    }

    const entries = emailCsv
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => EMAIL_REGEX.test(entry));

    const unique = Array.from(new Set(entries));

    if (!unique.length) {
      setEmailError("Provide at least one valid email address.");
      setHasValidEmails(false);
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(EMAIL_PREVIEW_RECIPIENTS_KEY, JSON.stringify(unique));
      try {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(surveyQuestions));
      } catch (storageError) {
        console.error("Failed to persist survey questions for email preview", storageError);
      }
    }

    const query: Record<string, string> = {};

    const assign = (key: string, value: string | undefined) => {
      if (value && value.trim()) {
        query[key] = value.trim();
      }
    };

    assign("name", contextSummary.name);
    assign("company", contextSummary.company);
    assign("product", contextSummary.product);
    assign("feedbackDesired", contextSummary.feedbackDesired);
    assign("keyQuestions", contextSummary.keyQuestions);
    assign("desiredIcp", contextSummary.desiredIcp);
    assign("desiredIcpIndustry", contextSummary.desiredIcpIndustry);
    assign("desiredIcpRegion", contextSummary.desiredIcpRegion);
    assign("sid", contextSummary.sid);
    assign("pin", contextSummary.pin);
    if (surveyQuestions.length) {
      try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(surveyQuestions))));
        assign("surveyQuestions", encoded);
      } catch (error) {
        console.error("Failed to encode survey questions", error);
      }
    }
    query.source = "manual";

    router.push({ pathname: "/email-preview", query });
  };

  const handleConductSearch = async () => {
    if (!scrapeSelected) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const title = contextSummary.desiredIcp;
    const location = contextSummary.desiredIcpRegion;
    const industry = contextSummary.desiredIcpIndustry;
    const sid = contextSummary.sid;
    const pin = contextSummary.pin;

    if (!title || !location) {
      setSearchError("Title and region are required to run the search.");
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          location,
          industry
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        const baseMessage =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error
              ? JSON.stringify(payload.error)
              : "Unable to retrieve contacts.";
        const step = typeof payload?.step === "string" ? payload.step : undefined;
        const reason = `${response.status} ${response.statusText}`;
        setSearchError(step ? `${step}: ${baseMessage} (${reason})` : `${baseMessage} (${reason})`);
        return;
      }

      const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      const debug = payload.debug ?? {};

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            PEOPLE_SEARCH_STORAGE_KEY,
            JSON.stringify({
            contacts,
            title,
            location,
            industry,
            generatedAt: Date.now(),
            debug,
            sid,
            pin,
            requester: contextSummary.name,
            company: contextSummary.company,
            product: contextSummary.product,
            feedbackDesired: contextSummary.feedbackDesired,
            keyQuestions: contextSummary.keyQuestions,
            desiredIcp: contextSummary.desiredIcp,
            desiredIcpIndustry: contextSummary.desiredIcpIndustry,
            desiredIcpRegion: contextSummary.desiredIcpRegion,
            surveyQuestions
          })
          );
          sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(surveyQuestions));
        } catch (storageError) {
          console.error("Failed to store search results", storageError);
          setSearchError("Search succeeded, but results could not be saved.");
          return;
        }
      }

      const query: Record<string, string> = {};
      if (sid) {
        query.sid = sid;
      }
      if (pin) {
        query.pin = pin;
      }

      router.push({ pathname: "/people-results", query });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Survey Population | SurvAgent</title>
        <meta
          name="description"
          content="Decide how SurvAgent should source the outreach population for your survey."
        />
      </Head>

      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Determine survey population</h1>
          <p>
            Choose how you would like SurvAgent to assemble the outreach list. You can paste a prepared
            set of email addresses or let the agent search for prospects based on your intake details.
          </p>
        </header>

        <section className={styles.contextPanel}>
          <h2>Survey context</h2>
          <dl>
            <div>
              <dt>Requester</dt>
              <dd>{contextSummary.name || "—"}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{contextSummary.company || "—"}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{contextSummary.product || "—"}</dd>
            </div>
            <div>
              <dt>Desired feedback</dt>
              <dd>{contextSummary.feedbackDesired || "—"}</dd>
            </div>
            <div>
              <dt>Target ICP</dt>
              <dd>{contextSummary.desiredIcp || "—"}</dd>
            </div>
            <div>
              <dt>ICP industry</dt>
              <dd>{contextSummary.desiredIcpIndustry || "—"}</dd>
            </div>
            <div>
              <dt>ICP region</dt>
              <dd>{contextSummary.desiredIcpRegion || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.optionsSection}>
          <h2>Select sourcing method</h2>

          <label className={styles.optionRow}>
            <input
              type="checkbox"
              checked={manualSelected}
              onChange={handleManualToggle}
            />
            <div>
              <span>Paste a comma-separated list of email addresses</span>
              <p>Provide up to 1000 characters; each entry must be a valid email address.</p>
            </div>
          </label>

          {manualSelected ? (
            <div className={styles.manualInput}>
              <textarea
                value={emailCsv}
                onChange={handleEmailsChange}
                maxLength={1000}
                placeholder="alice@example.com, bob@example.org, ..."
                aria-label="Comma separated email addresses"
              />
              <div className={styles.helperRow}>
                <span>{emailCsv.length}/1000</span>
                {emailError ? <span className={styles.error}>{emailError}</span> : null}
              </div>
            </div>
          ) : null}

          <label className={styles.optionRow}>
            <input
              type="checkbox"
              checked={scrapeSelected}
              onChange={handleScrapeToggle}
            />
            <div>
              <span>Let SurvAgent find prospects online</span>
              <p>We will compose a scraping brief based on your intake data in a later iteration.</p>
            </div>
          </label>
        </section>

        <div className={styles.actions}>
          {manualSelected && hasValidEmails ? (
            <button type="button" className={styles.primaryButton} onClick={handlePrepareEmailManual}>
              Prepare Email
            </button>
          ) : null}

          {scrapeSelected ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleConductSearch}
              disabled={isSearching}
            >
              {isSearching ? "Searching…" : "Conduct Search"}
            </button>
          ) : null}
        </div>

        {searchError ? <div className={styles.errorBanner}>{searchError}</div> : null}
      </div>
    </div>
  );
}
