import Head from "next/head";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ChatInput } from "@/components/ChatInput";

interface FormData {
  name: string;
  prompt: string;
  [key: string]: string;
}

const INITIAL_DATA: FormData = {
  name: "Researcher",
  prompt: ""
};

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const REQUIRED_FIELDS: Array<keyof FormData> = useMemo(
    () => ["prompt"],
    []
  );

  const isFormComplete = useMemo(
    () =>
      REQUIRED_FIELDS.every((field) => {
        const value = form[field];
        return typeof value === "string" && value.trim().length > 0;
      }),
    [form, REQUIRED_FIELDS]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormComplete || isSubmitting) {
      return;
    }

    try {
      setSubmitError(null);
      setIsSubmitting(true);

      const response = await fetch("/api/sessions", { method: "POST" });

      if (!response.ok) {
        throw new Error("Unable to create session. Please try again.");
      }

      const payload: { sessionId?: string; pin?: string } = await response.json();

      if (!payload.sessionId || !payload.pin) {
        throw new Error("Session response was incomplete. Please try again.");
      }

      const sanitizedPrompt = form.prompt.trim();
      const sanitizedName = form.name.trim() || "Researcher";

      const contextPayload: Record<string, unknown> = {
        sessionId: payload.sessionId,
        requester: sanitizedName,
        prompt: sanitizedPrompt,
        surveyQuestions: null
      };

      await fetch("/api/sessions/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contextPayload)
      }).catch((contextError) => {
        console.error("Failed to persist session context", contextError);
      });

      const query: Record<string, string> = {
        name: sanitizedName,
        prompt: sanitizedPrompt,
        sid: payload.sessionId,
        pin: payload.pin
      };

      router.push({
        pathname: "/brief",
        query
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please retry.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-grain px-6 md:px-16 lg:px-24 font-sans text-[#1a1a1a] selection:bg-black/10 relative overflow-hidden">
      <Head>
        <title>SurvAgent Intake</title>
        <meta name="description" content="Kick off your AI-powered survey with SurvAgent." />
      </Head>

      <div className="max-w-7xl mx-auto pt-28 pb-20 relative z-10">
        <section className="flex flex-col gap-6 mb-14 max-w-4xl">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[#1a1a1a]">
            AI interviews to understand your customers at scale (fast)
          </h1>
          <p className="text-xl md:text-2xl text-[#6b6b6b] leading-relaxed max-w-2xl">
            Generate research briefs, scripted surveys, and voice agents in seconds. Launch interviews instantly and
            revisit transcripts, insights, and key takeaways in one place.
          </p>
        </section>

        <form className="max-w-3xl space-y-4" onSubmit={handleSubmit} noValidate>
          {submitError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-red-700 text-sm">
              {submitError}
            </div>
          ) : null}
          <ChatInput
            value={form.prompt}
            onChange={(value) => setForm((previous) => ({ ...previous, prompt: value }))}
            isSubmitting={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
}
