import Head from "next/head";
import { useRouter } from "next/router";
import { ChangeEvent, useMemo, useState } from "react";
import styles from "@/styles/Population.module.css";
import { PEOPLE_SEARCH_STORAGE_KEY } from "@/lib/storageKeys";

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

  const contextSummary = useMemo(() => {
    const name = getQueryValue(router.query.name);
    const company = getQueryValue(router.query.company);
    const product = getQueryValue(router.query.product);
    const feedbackDesired = getQueryValue(router.query.feedbackDesired);
    const desiredIcp = getQueryValue(router.query.desiredIcp);
    const desiredIcpIndustry = getQueryValue(router.query.desiredIcpIndustry);
    const desiredIcpRegion = getQueryValue(router.query.desiredIcpRegion);

    return {
      name,
      company,
      product,
      feedbackDesired,
      desiredIcp,
      desiredIcpIndustry,
      desiredIcpRegion
    };
  }, [
    router.query.name,
    router.query.company,
    router.query.product,
    router.query.feedbackDesired,
    router.query.desiredIcp,
    router.query.desiredIcpIndustry,
    router.query.desiredIcpRegion
  ]);

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

  const handleConductSearch = async () => {
    if (!scrapeSelected) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const title = contextSummary.desiredIcp;
    const location = contextSummary.desiredIcpRegion;
    const industry = contextSummary.desiredIcpIndustry;

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
              debug
            })
          );
        } catch (storageError) {
          console.error("Failed to store search results", storageError);
          setSearchError("Search succeeded, but results could not be saved.");
          return;
        }
      }

      router.push("/people-results");
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
            <button type="button" className={styles.primaryButton}>
              Preview Email
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
