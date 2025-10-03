import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/styles/Brief.module.css";
import { SURVEY_QUESTIONS_STORAGE_KEY } from "@/lib/storageKeys";
import { useSessionContext } from "@/contexts/SessionContext";

type DescriptionResponse = {
  companyDescription: string;
  productDescription: string;
};

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

export default function BriefPage() {
  const router = useRouter();
  const { sessionData, isLoading: sessionLoading, error: sessionError } = useSessionContext();

  // Extract data from session context or fallback to URL params for initial load
  const name = useMemo(() => {
    if (sessionData?.requester) return sessionData.requester;
    return getQueryValue(router.query.name);
  }, [sessionData?.requester, router.query.name]);
  
  const company = useMemo(() => {
    if (sessionData?.company) return sessionData.company;
    return getQueryValue(router.query.company);
  }, [sessionData?.company, router.query.company]);
  
  const product = useMemo(() => {
    if (sessionData?.product) return sessionData.product;
    return getQueryValue(router.query.product);
  }, [sessionData?.product, router.query.product]);
  
  const feedbackDesired = useMemo(() => {
    if (sessionData?.feedbackDesired) return sessionData.feedbackDesired;
    return getQueryValue(router.query.feedbackDesired);
  }, [sessionData?.feedbackDesired, router.query.feedbackDesired]);
  
  const keyQuestions = useMemo(() => {
    if (sessionData?.keyQuestions) return sessionData.keyQuestions;
    return getQueryValue(router.query.keyQuestions);
  }, [sessionData?.keyQuestions, router.query.keyQuestions]);
  
  const desiredIcp = useMemo(() => {
    if (sessionData?.desiredIcp) return sessionData.desiredIcp;
    return getQueryValue(router.query.desiredIcp);
  }, [sessionData?.desiredIcp, router.query.desiredIcp]);
  
  const desiredIcpIndustry = useMemo(() => {
    if (sessionData?.desiredIcpIndustry) return sessionData.desiredIcpIndustry;
    return getQueryValue(router.query.desiredIcpIndustry);
  }, [sessionData?.desiredIcpIndustry, router.query.desiredIcpIndustry]);
  
  const desiredIcpRegion = useMemo(() => {
    if (sessionData?.desiredIcpRegion) return sessionData.desiredIcpRegion;
    return getQueryValue(router.query.desiredIcpRegion);
  }, [sessionData?.desiredIcpRegion, router.query.desiredIcpRegion]);
  
  const sid = useMemo(() => getQueryValue(router.query.sid), [router.query.sid]);
  const pin = useMemo(() => getQueryValue(router.query.pin), [router.query.pin]);
  const [descriptions, setDescriptions] = useState<DescriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [areQuestionsLoading, setAreQuestionsLoading] = useState(false);

  // Clean URL after initial load if we have session data
  useEffect(() => {
    if (sessionData && router.isReady && sid && pin) {
      // Check if URL has more than just sid and pin
      const hasExtraParams = Object.keys(router.query).some(key => 
        key !== 'sid' && key !== 'pin' && router.query[key]
      );
      
      if (hasExtraParams) {
        // Replace URL with clean version
        router.replace({
          pathname: router.pathname,
          query: { sid, pin }
        }, undefined, { shallow: true });
      }
    }
  }, [sessionData, router.isReady, sid, pin, router]);

  const encodedSurveyQuestions = useMemo(() => {
    if (!questions || !questions.length) {
      return null;
    }

    try {
      if (typeof window === "undefined") {
        return null;
      }

      const payload = JSON.stringify(questions);
      return window.btoa(unescape(encodeURIComponent(payload)));
    } catch (encodedError) {
      console.error("Failed to encode survey questions", encodedError);
      return null;
    }
  }, [questions]);

  const launchHref = useMemo(() => {
    if (!sid || !pin) return "/assistant";
    
    const params = new URLSearchParams();
    params.set("sid", sid);
    params.set("pin", pin);

    return `/assistant?${params.toString()}`;
  }, [sid, pin]);

  const canLaunchAgent = useMemo(() => Boolean(sid) && Boolean(pin), [sid, pin]);

  const handleLaunchAgent = useCallback(() => {
    if (typeof window === "undefined" || !router.isReady || !canLaunchAgent) {
      return;
    }

    window.open(launchHref, "_blank", "noopener,noreferrer");
  }, [router.isReady, canLaunchAgent, launchHref]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (!company.trim() || !product.trim()) {
      setDescriptions(null);
      setIsLoading(false);
      setError("Company and product inputs are required to generate the research summary.");
      setQuestions(null);
      setAreQuestionsLoading(false);
      setQuestionsError("Company and product inputs are required to generate survey questions.");
      return;
    }

    const controller = new AbortController();

    async function fetchDescriptions() {
      try {
        setIsLoading(true);
        setError(null);
        setDescriptions(null);

        const response = await fetch("/api/descriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ company, product }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to generate descriptions"
          );
        }

        setDescriptions(payload as DescriptionResponse);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch descriptions", fetchError);
        setDescriptions(null);
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to generate descriptions"
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    async function fetchQuestions() {
      try {
        setAreQuestionsLoading(true);
        setQuestionsError(null);
        setQuestions(null);

        const response = await fetch("/api/questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            company,
            product,
            desiredIcp,
            desiredIcpIndustry,
            feedbackDesired,
            keyQuestions
          }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.trim()
              ? payload.error
              : "Failed to generate survey questions"
          );
        }

        const parsed = payload as { questions?: unknown };

        if (!Array.isArray(parsed.questions)) {
          throw new Error("Response is missing survey questions");
        }

        setQuestions(parsed.questions as string[]);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to fetch survey questions", fetchError);
        setQuestions(null);
        setQuestionsError(
          fetchError instanceof Error ? fetchError.message : "Failed to generate survey questions"
        );
      } finally {
        if (!controller.signal.aborted) {
          setAreQuestionsLoading(false);
        }
      }
    }

    fetchDescriptions();
    fetchQuestions();

    return () => controller.abort();
  }, [router.isReady, company, product, desiredIcp, desiredIcpIndustry, feedbackDesired, keyQuestions]);

  useEffect(() => {
    if (!questions || !sid) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(SURVEY_QUESTIONS_STORAGE_KEY, JSON.stringify(questions));
      } catch (error) {
        console.error("Failed to store survey questions", error);
      }
    }

    fetch("/api/sessions/context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: sid,
        requester: name,
        company,
        product,
        feedbackDesired,
        desiredIcp,
        desiredIcpIndustry,
        desiredIcpRegion,
        keyQuestions,
        surveyQuestions: questions
      })
    }).catch((error) => {
      console.error("Failed to update session context with survey questions", error);
    });
  }, [questions, sid, name, company, product, feedbackDesired, desiredIcp, desiredIcpIndustry, desiredIcpRegion, keyQuestions]);

  const productCopy = descriptions?.productDescription;
  const companyCopy = descriptions?.companyDescription;

  const handleQuestionChange = useCallback(
    (index: number, event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setQuestions((previous) => {
        if (!previous) {
          return previous;
        }
        const updated = [...previous];
        updated[index] = nextValue;
        return updated;
      });
    },
    []
  );

  return (
    <div className={styles.container}>
      <Head>
        <title>Research Brief | SurvAgent</title>
        <meta name="description" content="Review AI-generated context for your survey outreach." />
      </Head>

      <h1 className={styles.pageTitle}>Survey Questions</h1>
      <p className={styles.pageSubtitle}>
        Based on your infor, we have generated the following survey questions.
        <br />
        Please edit the questions as desired!
      </p>

      <div className={styles.card}>

        {/* { <div className={styles.metaList}>
          <div className={styles.metaItem}>
            <span>Requester</span>
            <p>{name || "—"}</p>
          </div>
          <div className={styles.metaItem}>
            <span>Desired ICP</span>
            <p>{desiredIcp || "—"}</p>
          </div>
          <div className={styles.metaItem}>
            <span>Desired ICP Industry</span>
            <p>{desiredIcpIndustry || "—"}</p>
          </div>
          <div className={styles.metaItem}>
            <span>Desired ICP Region</span>
            <p>{desiredIcpRegion || "—"}</p>
          </div>
          <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
            <span>Feedback Desired</span>
            <p>{feedbackDesired || "—"}</p>
          </div>
          <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
            <span>Key Questions</span>
            <p>{keyQuestions || "—"}</p>
          </div>
        </div> }
 */}

        {error ? <div className={styles.errorMessage}>{error}</div> : null}

        <div className={styles.summaryGrid}>
          <article className={styles.summaryBlock}>
            <h2>Product</h2>
            <p>
              {productCopy
                ? productCopy
                : isLoading
                  ? "Learning about your product..."
                  : error
                    ? "Product research is unavailable right now."
                    : "Product research will appear here once generated."}
            </p>
          </article>

          <article className={styles.summaryBlock}>
            <h2>Company</h2>
            <p>
              {companyCopy
                ? companyCopy
                : isLoading
                  ? "Learning about your company..."
                  : error
                    ? "Company research is unavailable right now."
                    : "Company research will appear here once generated."}
            </p>
          </article>
        </div>

        <section className={styles.questionsSection}>
          <div className={styles.questionsHeader}>
            <h2>Survey Questions</h2>
            <p>
              Tailored for {desiredIcp || "your ICP"}
              {desiredIcpIndustry ? ` in the ${desiredIcpIndustry} space.` : "."} <br />
            </p>
          </div>

          {areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>Assembling market positioning questions…</div>
          ) : null}

          {questionsError ? <div className={styles.errorMessage}>{questionsError}</div> : null}

          {questions && questions.length ? (
            <ol className={styles.questionsList}>
              {questions.map((question, index) => (
                <li key={index}>
                  <input
                    value={question}
                    onChange={(event) => handleQuestionChange(index, event)}
                    className={styles.questionInput}
                    aria-label={`Survey question ${index + 1}`}
                  />
                </li>
              ))}
            </ol>
          ) : !areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>
              Survey questions will appear here once generated.
            </div>
          ) : null}
        </section>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.launchButton}
            onClick={handleLaunchAgent}
            disabled={!canLaunchAgent}
          >
            Preview AI Agent
          </button>

          <Link
            className={styles.populationLink}
            href={{
              pathname: "/population",
              query: {
                sid,
                pin
              }
            }}
          >
            Determine survey population →
          </Link>
        </div>

      </div>
    </div>
  );
}
