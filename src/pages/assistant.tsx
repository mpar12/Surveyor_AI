import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";

export default function AssistantPage() {
  const router = useRouter();

  const getQueryValue = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) {
      return value[0] ?? "";
    }
    return value ?? "";
  };

  const dynamicVariables = useMemo(() => {
    const name = getQueryValue(router.query.name);
    const company = getQueryValue(router.query.company);
    const product = getQueryValue(router.query.product);
    const feedbackDesired = getQueryValue(router.query.feedbackDesired);
    const keyQuestions = getQueryValue(router.query.keyQuestions);
    const sessionId = getQueryValue(router.query.sid);
    const pin = getQueryValue(router.query.pin);

    const variables: Record<string, string> = {};

    if (name) {
      variables.user_name = name;
    }
    if (company) {
      variables.company_name = company;
    }
    if (product) {
      variables.product_name = product;
    }
    if (feedbackDesired) {
      variables.key_feedback_desired = feedbackDesired;
    }
    if (sessionId) {
      variables.session_id = sessionId;
    }
    if (pin) {
      variables.PIN = pin;
    }
    if (keyQuestions) {
      variables["{{List of questions}}"] = keyQuestions;
    }

    return variables;
  }, [
    router.query.name,
    router.query.company,
    router.query.product,
    router.query.feedbackDesired,
    router.query.keyQuestions,
    router.query.sid,
    router.query.pin
  ]);

  useEffect(() => {
    const widget = document.querySelector("elevenlabs-convai");

    if (!widget) {
      return;
    }

    const handleCallStart = () => {
      console.log("Call started: session created after mic consent");
    };

    const handleCallEnd = () => {
      console.log("Call ended or mic denied, no active session");
    };

    widget.addEventListener("elevenlabs-convai:call", handleCallStart);
    widget.addEventListener("elevenlabs-convai:call-end", handleCallEnd);

    return () => {
      widget.removeEventListener("elevenlabs-convai:call", handleCallStart);
      widget.removeEventListener("elevenlabs-convai:call-end", handleCallEnd);
    };
  }, []);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  return (
    <>
      <Head>
        <title>Assistant | SurvAgent</title>
        <meta
          name="description"
          content="Interact with the SurvAgent ElevenLabs assistant via a focused audio-first experience."
        />
      </Head>

      <div className="fullscreen-center">
        {agentId ? (
          <>
            <elevenlabs-convai
              agent-id={agentId}
              variant="expanded"
              action-text=""
              start-call-text="Start"
              end-call-text="End"
              listening-text="Listening…"
              speaking-text="Speaking…"
              dynamic-variables={JSON.stringify(dynamicVariables)}
            />
            <Script
              src="https://unpkg.com/@elevenlabs/convai-widget-embed"
              strategy="afterInteractive"
              async
            />
          </>
        ) : (
          <div style={{ color: "#f9fafb", textAlign: "center", maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Configuration required</h1>
            <p>
              Set the `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` environment variable to enable the ElevenLabs
              assistant.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
