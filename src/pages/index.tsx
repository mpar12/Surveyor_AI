import Head from "next/head";
import Link from "next/link";
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

const BENEFITS = [
  {
    icon: MicIcon,
    title: "AI Voice Interviews",
    description: "Natural conversations at scale"
  },
  {
    icon: SparkleIcon,
    title: "Instant Analysis",
    description: "Key insights in minutes"
  },
  {
    icon: ChartIcon,
    title: "Structured Insights",
    description: "Organized findings & quotes"
  }
];

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const REQUIRED_FIELDS: Array<keyof FormData> = useMemo(() => ["prompt"], []);

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
    if (!isFormComplete || isSubmitting) return;

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
        headers: { "Content-Type": "application/json" },
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

      router.push({ pathname: "/brief", query });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong. Please retry.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAFAF9]">
      <Head>
        <title>Surveyor | AI-Powered Customer Interviews</title>
        <meta
          name="description"
          content="Conduct AI-powered voice interviews at scale. Generate research briefs, launch interviews instantly, and get structured insights."
        />
      </Head>

      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-5">
        <Link href="/" className="text-[15px] font-semibold text-[#1a1a1a] tracking-tight">
          Surveyor
        </Link>
        <Link
          href="/return"
          className="text-[13px] text-[#6b6b6b] hover:text-[#1a1a1a] transition-colors"
        >
          Return to session
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex flex-col items-center px-6 md:px-12 lg:px-20 pt-12 md:pt-20 pb-20">
        {/* Hero Card */}
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] border border-[#E8E8E6] p-8 md:p-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3EE] border border-[#FDDCCC] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E86C3A]" />
            <span className="text-[12px] font-medium text-[#C25A2E]">AI-Powered Research</span>
          </div>

          {/* Headline */}
          <h1 className="text-[32px] md:text-[40px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#1a1a1a] mb-4">
            Understand your customers at scale
          </h1>

          {/* Subheadline */}
          <p className="text-[16px] md:text-[17px] leading-[1.6] text-[#6b6b6b] mb-8 max-w-lg">
            Generate interview scripts, conduct AI voice interviews, and get structured insights—all in minutes.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-[14px] mb-4">
                {submitError}
              </div>
            )}
            <ChatInput
              value={form.prompt}
              onChange={(value) => setForm((prev) => ({ ...prev, prompt: value }))}
              isSubmitting={isSubmitting}
            />
            <p className="text-[13px] text-[#9a9a9a] mt-3">
              Press Enter to generate your interview script
            </p>
          </form>
        </div>

        {/* Benefits */}
        <div className="w-full max-w-2xl mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-[#FEF3EE] border border-[#FDDCCC] flex items-center justify-center mb-3">
                  <benefit.icon className="w-5 h-5 text-[#D4613A]" />
                </div>
                <h3 className="text-[14px] font-medium text-[#1a1a1a] mb-1">
                  {benefit.title}
                </h3>
                <p className="text-[13px] text-[#8a8a8a]">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
