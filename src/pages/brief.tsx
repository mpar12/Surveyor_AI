import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import styles from "@/styles/Brief.module.css";

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

  const name = useMemo(() => getQueryValue(router.query.name), [router.query.name]);
  const company = useMemo(() => getQueryValue(router.query.company), [router.query.company]);
  const product = useMemo(() => getQueryValue(router.query.product), [router.query.product]);
  const feedbackDesired = useMemo(
    () => getQueryValue(router.query.feedbackDesired),
    [router.query.feedbackDesired]
  );
  const keyQuestions = useMemo(
    () => getQueryValue(router.query.keyQuestions),
    [router.query.keyQuestions]
  );
  const desiredIcp = useMemo(() => getQueryValue(router.query.desiredIcp), [router.query.desiredIcp]);
  const desiredIcpIndustry = useMemo(
    () => getQueryValue(router.query.desiredIcpIndustry),
    [router.query.desiredIcpIndustry]
  );
  const desiredIcpRegion = useMemo(
    () => getQueryValue(router.query.desiredIcpRegion),
    [router.query.desiredIcpRegion]
  );
  const sid = useMemo(() => getQueryValue(router.query.sid), [router.query.sid]);
  const pin = useMemo(() => getQueryValue(router.query.pin), [router.query.pin]);

  const [descriptions, setDescriptions] = useState<DescriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [areQuestionsLoading, setAreQuestionsLoading] = useState(false);

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
          body: JSON.stringify({ company, product, desiredIcp, desiredIcpIndustry, keyQuestions }),
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
  }, [router.isReady, company, product, desiredIcp, desiredIcpIndustry, keyQuestions]);

  const productCopy = descriptions?.productDescription;
  const companyCopy = descriptions?.companyDescription;

  return (
    <div className={styles.container}>
      <Head>
        <title>Research Brief | SurvAgent</title>
        <meta name="description" content="Review AI-generated context for your survey outreach." />
      </Head>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Research Brief Preview</h1>
          <p>
            We have logged your intake details and are drafting the outreach research using ChatGPT.
            Review the generated context below before proceeding to the agent setup.
          </p>
        </div>

        {pin ? (
          <div className={styles.pinNotice}>
            <h3>Your session PIN</h3>
            <p>
              Save this 4-digit PIN now: <strong>{pin}</strong>. You&apos;ll need it to revisit your scorecard via the
              “Returning?” button on the homepage.
            </p>
            <p>
              <em>Note:</em> The PIN grants access only after you deploy the email outreach through the AI agent.
            </p>
          </div>
        ) : null}

        <div className={styles.metaList}>
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
          <div className={styles.metaItem}>
            <span>Feedback Desired</span>
            <p>{feedbackDesired || "—"}</p>
          </div>
          <div className={styles.metaItem}>
            <span>Key Questions</span>
            <p>{keyQuestions || "—"}</p>
          </div>
        </div>

        {isLoading && !error ? (
          <div className={styles.status}>Generating research insights…</div>
        ) : null}

        {error ? <div className={styles.errorMessage}>{error}</div> : null}

        <div className={styles.summaryGrid}>
          <article className={styles.summaryBlock}>
            <h2>Product</h2>
            <p>
              {productCopy
                ? productCopy
                : isLoading
                  ? "ChatGPT is synthesizing the product research."
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
                  ? "ChatGPT is synthesizing the company research."
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
              {desiredIcpIndustry ? ` in the ${desiredIcpIndustry} space.` : "."}
            </p>
          </div>

          {areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>Assembling market positioning questions…</div>
          ) : null}

          {questionsError ? <div className={styles.errorMessage}>{questionsError}</div> : null}

          {questions && questions.length ? (
            <ol className={styles.questionsList}>
              {questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ol>
          ) : !areQuestionsLoading && !questionsError ? (
            <div className={styles.status}>
              Survey questions will appear here once generated.
            </div>
          ) : null}
        </section>

        <div className={styles.status}>
          <Link
            href={{
              pathname: "/population",
              query: {
                name,
                company,
                product,
                feedbackDesired,
                desiredIcp,
                desiredIcpIndustry,
                desiredIcpRegion,
                keyQuestions,
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
