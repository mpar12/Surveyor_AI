import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type QueryValue = string | string[] | undefined;

const getQueryValue = (value: QueryValue) => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
};

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function ProlificSetupPage() {
  const router = useRouter();
  const [completionUrl, setCompletionUrl] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const contextSummary = useMemo(() => {
    const sidValue = getQueryValue(router.query.sid);
    const pinValue = getQueryValue(router.query.pin);

    return {
      sid: sidValue,
      pin: pinValue
    };
  }, [
    router.query.sid,
    router.query.pin
  ]);

  const generateProlificLink = () => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();

    // Session identifiers
    if (contextSummary.sid) {
      params.set("sid", contextSummary.sid);
    }
    if (contextSummary.pin) {
      params.set("pin", contextSummary.pin);
    }

    if (completionUrl.trim()) {
      params.set("completionUrl", completionUrl.trim());
    }

    const origin = window.location.origin;
    const baseQuery = params.toString();
    const prolificParams = [
      "PROLIFIC_PID={{%PROLIFIC_PID%}}",
      "STUDY_ID={{%STUDY_ID%}}",
      "SESSION_ID={{%SESSION_ID%}}"
    ];
    const query = [baseQuery, ...prolificParams].filter(Boolean).join("&");
    setGeneratedLink(`${origin}/assistant?${query}`);
  };

  const handleCopyLink = () => {
    if (!generatedLink) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2500);
      return;
    }

    navigator.clipboard
      .writeText(generatedLink)
      .then(() => {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2500);
      })
      .catch(() => {
        setCopyStatus("error");
        setTimeout(() => setCopyStatus("idle"), 2500);
      });
  };

  const isValidUrl = completionUrl.trim().startsWith("https://");

  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Prolific Setup | Surveyor</title>
        <meta
          name="description"
          content="Configure your Prolific study integration with Surveyor."
        />
      </Head>

      <Header />

      <main className="relative z-10 pt-24 pb-20 px-6 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="space-y-8"
          >
            {/* Page Header */}
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                <span className="text-sm text-[#888] tracking-wide font-medium">INTEGRATION</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Prolific Project Setup
              </h1>
              <p className="text-lg text-[#888]">
                Generate a link for your Prolific study that tracks participants and redirects them on completion.
              </p>
            </motion.div>

            {/* Session Info Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <InfoIcon className="w-5 h-5 text-[#FF6B35]" />
                    Session Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        Session ID
                      </span>
                      <p className="text-white font-medium mt-1 font-mono">{contextSummary.sid || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        PIN
                      </span>
                      <p className="text-white font-medium mt-1 font-mono">{contextSummary.pin || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Completion URL Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-[#FF6B35]" />
                    Prolific Completion URL
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-[#888]">
                    Find this in your Prolific study settings. It looks like: https://app.prolific.com/submissions/complete?cc=XXXXXXXX
                  </p>
                  <Input
                    type="url"
                    value={completionUrl}
                    onChange={(e) => setCompletionUrl(e.target.value)}
                    placeholder="https://app.prolific.com/submissions/complete?cc=XXXXXXXX"
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#555]"
                  />
                  <Button
                    onClick={generateProlificLink}
                    disabled={!isValidUrl || !contextSummary.sid || !contextSummary.pin}
                  >
                    Generate Prolific Link
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Generated Link Card */}
            {generatedLink && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <CheckIcon className="w-5 h-5 text-green-500" />
                      Your Prolific Study URL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-[#888]">
                      Copy this link and paste it into your Prolific study&apos;s &quot;Study URL&quot; field.
                    </p>
                    <Textarea
                      value={generatedLink}
                      readOnly
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono text-sm min-h-[100px]"
                    />
                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={handleCopyLink} className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]">
                        <CopyIcon className="w-4 h-4" />
                        Copy Link
                      </Button>
                      <span className="text-sm text-[#666]">
                        {copyStatus === "copied"
                          ? "Copied!"
                          : copyStatus === "error"
                            ? "Unable to copy."
                            : ""}
                      </span>
                    </div>

                    {/* Next Steps */}
                    <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                      <h3 className="text-white font-semibold mb-3">Next Steps</h3>
                      <ol className="space-y-2 text-sm text-[#888]">
                        <li className="flex items-start gap-2">
                          <span className="text-[#FF6B35] font-bold">1.</span>
                          Go to your Prolific study settings
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#FF6B35] font-bold">2.</span>
                          Paste this URL in the &quot;Study URL&quot; field
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#FF6B35] font-bold">3.</span>
                          Make sure &quot;I&apos;ll use URL parameters&quot; is selected
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#FF6B35] font-bold">4.</span>
                          Participants will be automatically redirected to Prolific when they complete the interview
                        </li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icons
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
