import Head from "next/head";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { ChatInput } from "@/components/ChatInput";
import Header from "@/components/Header";

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
    <div className="min-h-screen w-full bg-dark-hero relative overflow-hidden">
      <Head>
        <title>Surveyor - AI Customer Research</title>
        <meta name="description" content="AI-powered customer research at scale." />
      </Head>

      {/* Subtle gradient orb in background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(255,107,53,0.12)_0%,_transparent_70%)] pointer-events-none" />

      <Header />

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 md:px-16 lg:px-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight text-white mb-6">
            AI interviews to understand your customers at scale{" "}
            <span className="text-[#FF6B35]">(fast)</span>
          </h1>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-[#a1a1a1] leading-relaxed max-w-2xl mx-auto mb-12">
            Generate research briefs, scripted surveys, and voice agents in seconds. Launch interviews instantly and
            revisit transcripts, insights, and key takeaways in one place.
          </p>

          {/* Prompt Bar Container */}
          <div className="w-full max-w-2xl mx-auto">
            {/* Animated activity indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#FF6B35] animate-pulse-glow" />
              <span className="text-sm text-[#6b6b6b]">AI ready to conduct research</span>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {submitError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm mb-4">
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
      </main>
    </div>
  );
}
