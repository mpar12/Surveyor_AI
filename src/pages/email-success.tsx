import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EMAIL_PREVIEW_LAST_SEND_KEY } from "@/lib/storageKeys";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LastSend {
  recipients: string[];
  subject: string;
  sentAt: number;
  sessionId: string | null;
  pin: string | null;
}

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

export default function EmailSuccessPage() {
  const router = useRouter();
  const [lastSend, setLastSend] = useState<LastSend | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = sessionStorage.getItem(EMAIL_PREVIEW_LAST_SEND_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as LastSend;
      if (parsed && Array.isArray(parsed.recipients)) {
        setLastSend(parsed);
      }
      sessionStorage.removeItem(EMAIL_PREVIEW_LAST_SEND_KEY);
    } catch (error) {
      console.error("Failed to read last send payload", error);
    }
  }, []);

  const subjectLine = lastSend?.subject ?? "Survey Invitation";
  const recipients = lastSend?.recipients ?? [];
  const sentAtLabel = lastSend?.sentAt ? new Date(lastSend.sentAt).toLocaleString() : "";
  const sessionId = lastSend?.sessionId ?? (typeof router.query.sid === "string" ? router.query.sid : null);
  const pin = lastSend?.pin ?? (typeof router.query.pin === "string" ? router.query.pin : null);

  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Email Sent | Surveyor</title>
        <meta name="description" content="Confirm the survey invitation email was delivered." />
      </Head>

      <Header />

      <main className="relative z-10 pt-24 pb-20 px-6 md:px-12 lg:px-16">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="space-y-8"
          >
            {/* Success Icon */}
            <motion.div variants={fadeInUp} className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckIcon className="w-10 h-10 text-green-500" />
              </div>
            </motion.div>

            {/* Page Header */}
            <motion.div variants={fadeInUp} className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Email Sent
              </h1>
              <p className="text-lg text-[#888]">
                Your survey invitation has been dispatched to the recipients listed below.
              </p>
            </motion.div>

            {/* Email Details Card */}
            {recipients.length > 0 ? (
              <motion.div variants={fadeInUp}>
                <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                  <CardContent className="space-y-6 pt-6">
                    {/* Subject */}
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        Subject
                      </span>
                      <p className="text-white font-medium mt-1">{subjectLine}</p>
                    </div>

                    {/* Recipients */}
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#666]">
                        Recipients ({recipients.length})
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {recipients.map((recipient) => (
                          <span
                            key={recipient}
                            className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-sm text-white"
                          >
                            {recipient}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sent At */}
                    {sentAtLabel && (
                      <p className="text-sm text-[#666]">
                        Sent at {sentAtLabel}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div variants={fadeInUp}>
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
                  <p className="text-red-400">No send details were found for this session.</p>
                </div>
              </motion.div>
            )}

            {/* Action Button */}
            {sessionId && (
              <motion.div variants={fadeInUp} className="flex justify-center pt-4">
                <Button size="lg" asChild>
                  <Link href={{ pathname: "/scorecard", query: { sid: sessionId, pin: pin ?? "" } }}>
                    <ChartIcon className="w-5 h-5" />
                    View Results
                  </Link>
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
