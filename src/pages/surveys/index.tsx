import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Survey } from "@/types/surveyBuilder";

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

export default function SurveysListPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      const res = await fetch("/api/surveys");
      const data = await res.json();
      setSurveys(data.surveys || []);
    } catch (error) {
      console.error("Failed to fetch surveys", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSurvey = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Survey" }),
      });
      const data = await res.json();
      if (data.survey?.id) {
        window.location.href = `/surveys/${data.survey.id}/edit`;
      }
    } catch (error) {
      console.error("Failed to create survey", error);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>Surveys | Surveyor</title>
        <meta name="description" content="Manage your research surveys" />
      </Head>

      <Header />

      <main className="relative z-10 pt-24 pb-20 px-6 md:px-12 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="space-y-8"
          >
            {/* Page Header */}
            <motion.div variants={fadeInUp} className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                  <span className="text-sm text-[#888] tracking-wide font-medium">SURVEYS</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  Your Surveys
                </h1>
              </div>
              <Button onClick={handleCreateSurvey} disabled={creating}>
                <PlusIcon className="w-4 h-4" />
                {creating ? "Creating..." : "New Survey"}
              </Button>
            </motion.div>

            {/* Survey List */}
            {loading ? (
              <motion.div variants={fadeInUp} className="flex justify-center py-20">
                <div className="text-[#888]">Loading surveys...</div>
              </motion.div>
            ) : surveys.length === 0 ? (
              <motion.div variants={fadeInUp}>
                <Card variant="default" className="bg-[#111] border-[#2a2a2a]">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mx-auto mb-6">
                      <DocumentIcon className="w-8 h-8 text-[#FF6B35]" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-3">
                      No surveys yet
                    </h2>
                    <p className="text-[#888] max-w-md mx-auto mb-6">
                      Create your first survey to start collecting voice responses and insights from your research participants.
                    </p>
                    <Button onClick={handleCreateSurvey} disabled={creating}>
                      <PlusIcon className="w-4 h-4" />
                      Create Your First Survey
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div variants={fadeInUp} className="grid gap-4">
                {surveys.map((survey) => (
                  <SurveyCard key={survey.id} survey={survey} />
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function SurveyCard({ survey }: { survey: Survey }) {
  const formattedDate = new Date(survey.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/surveys/${survey.id}/edit`}>
      <Card variant="default" className="bg-[#111] border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors cursor-pointer">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <DocumentIcon className="w-5 h-5 text-[#666]" />
            </div>
            <div>
              <h3 className="text-white font-medium">{survey.title}</h3>
              <p className="text-sm text-[#666]">
                Created {formattedDate} • v{survey.version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={
                survey.status === "published"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-[#1a1a1a] text-[#888] border-[#333]"
              }
            >
              {survey.status === "published" ? "Published" : "Draft"}
            </Badge>
            <ChevronRightIcon className="w-5 h-5 text-[#666]" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
