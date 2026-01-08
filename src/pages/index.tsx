import Head from "next/head";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { ChatInput } from "@/components/ChatInput";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FormData {
  name: string;
  prompt: string;
  [key: string]: string;
}

const INITIAL_DATA: FormData = {
  name: "Researcher",
  prompt: ""
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Feature items
const FEATURES = [
  {
    icon: MicIcon,
    title: "AI Voice Interviews",
    description: "Natural conversations powered by ElevenLabs"
  },
  {
    icon: BrainIcon,
    title: "Claude Analysis",
    description: "Deep insights from your transcripts"
  },
  {
    icon: ZapIcon,
    title: "Launch in Seconds",
    description: "From brief to live interviews instantly"
  },
  {
    icon: ChartIcon,
    title: "Structured Insights",
    description: "Organized findings and key quotes"
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
    <div className="min-h-screen w-full bg-gradient-hero">
      <Head>
        <title>Surveyor | AI-Powered Customer Interviews</title>
        <meta
          name="description"
          content="Conduct AI-powered voice interviews at scale. Generate research briefs, launch interviews instantly, and get structured insights."
        />
      </Head>

      <Header />

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20">
        {/* Hero Section */}
        <motion.section
          className="flex flex-col items-center text-center pt-16 md:pt-24 pb-12 max-w-4xl"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div variants={fadeInUp}>
            <Badge variant="gradient" size="lg" className="mb-6">
              <SparkleIcon className="w-4 h-4 mr-1.5" />
              AI-Powered Research
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-foreground"
          >
            Understand your customers{" "}
            <span className="text-gradient">at scale</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-xl md:text-2xl text-foreground-secondary leading-relaxed max-w-2xl mt-6"
          >
            Generate interview scripts with Claude, conduct voice interviews with AI, and get structured insights—all in minutes.
          </motion.p>

          {/* Input Form */}
          <motion.div variants={fadeInUp} className="w-full max-w-2xl mt-10">
            <form onSubmit={handleSubmit} noValidate>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <Card variant="outline" className="border-error bg-error-subtle">
                    <CardContent className="flex items-center gap-3 p-4">
                      <ErrorIcon className="w-5 h-5 text-error flex-shrink-0" />
                      <p className="text-sm text-error font-medium">{submitError}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
              <ChatInput
                value={form.prompt}
                onChange={(value) => setForm((prev) => ({ ...prev, prompt: value }))}
                isSubmitting={isSubmitting}
                placeholder="What would you like to research today?"
              />
              <p className="text-sm text-foreground-muted mt-3">
                Press Enter to generate your interview script
              </p>
            </form>
          </motion.div>

          {/* Example prompts */}
          <motion.div variants={fadeInUp} className="flex flex-wrap justify-center gap-2 mt-6">
            <span className="text-sm text-foreground-muted">Try:</span>
            {[
              "User onboarding friction points",
              "Feature prioritization research",
              "Churn analysis interviews"
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, prompt: example }))}
                className="text-sm px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary-hover text-foreground-secondary hover:text-foreground transition-colors"
              >
                {example}
              </button>
            ))}
          </motion.div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          className="w-full max-w-5xl py-16"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.div variants={fadeInUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Research made simple
            </h2>
            <p className="text-lg text-foreground-secondary max-w-2xl mx-auto">
              From research question to actionable insights in four steps
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                custom={index}
              >
                <Card
                  variant="interactive"
                  className="h-full text-center p-6"
                >
                  <CardContent className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section
          className="w-full max-w-4xl py-16"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.div variants={fadeInUp} className="text-center mb-12">
            <Badge variant="secondary" size="lg" className="mb-4">
              How it works
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Four steps to insights
            </h2>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2">
            {[
              {
                step: "01",
                title: "Describe your research",
                description: "Tell us what you want to learn. Claude generates a tailored interview script."
              },
              {
                step: "02",
                title: "Review & customize",
                description: "Edit the generated questions, add follow-ups, and refine the script."
              },
              {
                step: "03",
                title: "Launch interviews",
                description: "Share the link with participants. AI conducts natural voice conversations."
              },
              {
                step: "04",
                title: "Get insights",
                description: "Claude analyzes transcripts and surfaces key findings and quotes."
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                variants={fadeInUp}
                className="flex gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-foreground-secondary">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          className="w-full max-w-3xl py-16 pb-24 text-center"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
        >
          <motion.div variants={fadeInUp}>
            <Card variant="gradient" className="p-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Ready to start researching?
              </h2>
              <p className="text-foreground-secondary mb-6 max-w-lg mx-auto">
                Enter your research question above and get your first interview script in seconds.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all"
                >
                  <ArrowUpIcon className="w-5 h-5" />
                  Start Now
                </Link>
                <Link
                  href="/return"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border text-foreground font-semibold hover:bg-secondary transition-all"
                >
                  Return to Session
                </Link>
              </div>
            </Card>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}

// Icons
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2L13.09 8.26L19 7L14.74 10.91L19 15L13.09 13.74L12 20L10.91 13.74L5 15L9.26 10.91L5 7L10.91 8.26L12 2Z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}
