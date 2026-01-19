import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SurveyBuilder from "@/components/SurveyBuilder";
import type { SurveyWithSections } from "@/types/surveyBuilder";

export default function SurveyEditorPage() {
  const router = useRouter();
  const { id } = router.query;

  const [survey, setSurvey] = useState<SurveyWithSections | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchSurvey = useCallback(async () => {
    if (!id || typeof id !== "string") return;

    try {
      const res = await fetch(`/api/surveys/${id}`);
      if (!res.ok) {
        router.push("/surveys");
        return;
      }
      const data = await res.json();
      setSurvey(data.survey);
    } catch (error) {
      console.error("Failed to fetch survey", error);
      router.push("/surveys");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  const handleSurveyUpdate = async (updates: Partial<SurveyWithSections>) => {
    if (!survey) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setSurvey((prev) => prev ? { ...prev, ...data.survey } : null);
    } catch (error) {
      console.error("Failed to update survey", error);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!survey) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      setSurvey((prev) => prev ? { ...prev, ...data.survey } : null);
    } catch (error) {
      console.error("Failed to publish survey", error);
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenPreview = () => {
    if (!survey) return;
    window.open(`/surveys/${survey.id}/take?preview=true`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-[#888]">Loading survey...</div>
      </div>
    );
  }

  if (!survey) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-black">
      <Head>
        <title>{survey.title} | Survey Editor</title>
        <meta name="description" content="Edit your survey" />
      </Head>

      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/surveys")}
              className="text-[#888] hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={survey.title}
              onChange={(e) => handleSurveyUpdate({ title: e.target.value })}
              className="bg-transparent text-white font-medium text-lg border-none outline-none focus:ring-0"
              placeholder="Survey title"
            />
            {saving && <span className="text-xs text-[#666]">Saving...</span>}
          </div>

          {/* Center: Tabs */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1">
            <button
              onClick={() => router.push(`/surveys/new?id=${survey.id}`)}
              className="px-4 py-1.5 text-sm text-[#888] hover:text-white transition-colors rounded"
            >
              Create
            </button>
            <button className="px-4 py-1.5 text-sm bg-[#2a2a2a] text-white rounded">
              Edit
            </button>
            <button
              disabled
              className="px-4 py-1.5 text-sm text-[#555] cursor-not-allowed rounded"
            >
              Launch
            </button>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className={
                survey.status === "published"
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-[#1a1a1a] text-[#888] border-[#333]"
              }
            >
              {survey.status === "published" ? `Published v${survey.version}` : "Draft"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-[#333] text-[#a1a1a1] hover:text-white hover:border-[#444]"
              onClick={handleOpenPreview}
            >
              <EyeIcon className="w-4 h-4" />
              Preview
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing..." : "Review & Launch"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-14">
        <SurveyBuilder survey={survey} onUpdate={fetchSurvey} />
      </main>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
