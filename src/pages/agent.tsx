import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function AgentPage() {
  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Agent Setup | Surveyor</title>
        <meta
          name="description"
          content="Configure the ElevenLabs agent using the details collected on your intake."
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
              <Badge variant="secondary" className="bg-[#1a1a1a] text-[#888] border-[#333]">
                <ClockIcon className="w-3 h-3 mr-1" />
                Coming Soon
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                ElevenLabs Agent Integration
              </h1>
              <p className="text-lg text-[#888]">
                We&apos;ll soon guide you through connecting your intake context, dynamic variables, and
                voice preferences to an ElevenLabs agent so Surveyor can run live interviews.
              </p>
            </motion.div>

            {/* Coming Soon Card */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-6">
                    <MicIcon className="w-8 h-8 text-[#FF6B35]" />
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-3">
                    What to Expect
                  </h2>
                  <p className="text-[#888] max-w-md mx-auto mb-6">
                    This setup flow will provision an agent, map the variables you captured on the intake
                    form, and collect any additional prompts or guardrails required by your research team.
                    Once ready, you&apos;ll be able to launch the agent directly from your research brief.
                  </p>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <div className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-sm text-[#666]">
                      Voice Selection
                    </div>
                    <div className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-sm text-[#666]">
                      Dynamic Variables
                    </div>
                    <div className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-sm text-[#666]">
                      Custom Prompts
                    </div>
                    <div className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-sm text-[#666]">
                      Guardrails
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Back Link */}
            <motion.div variants={fadeInUp} className="flex justify-center pt-4">
              <Button variant="outline" asChild className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]">
                <Link href="/">
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back to Home
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// Icons
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
