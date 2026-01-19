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

    setIsSubmitting(true);
    const sanitizedPrompt = form.prompt.trim();

    router.push({
      pathname: "/surveys/new",
      query: { prompt: sanitizedPrompt }
    });
  };

  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      <Head>
        <title>Surveyor - AI Customer Research</title>
        <meta name="description" content="AI-powered customer research at scale." />
      </Head>

      <Header />

      {/* Main Content */}
      <main className="relative z-10 min-h-screen pt-32 pb-20 px-8 md:px-12 lg:px-16">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            {/* Left Column - Content */}
            <div className="max-w-2xl">
              {/* Label */}
              <div className="flex items-center gap-2 mb-8">
                <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                <span className="text-sm text-[#888] tracking-wide font-medium">RESEARCH</span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-white mb-8">
                AI-Powered
                <br />
                Customer Research
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-[#888] leading-relaxed mb-4 font-light">
                The only AI research platform that conducts
                <br className="hidden md:block" />
                interviews everywhere you need them.
              </p>

              {/* Body text */}
              <p className="text-base md:text-lg text-[#666] leading-relaxed mb-10">
                From briefs to insights — delegate complete research tasks like
                customer discovery, market validation, and user interviews to AI
                without changing your tools, models, or workflow.
              </p>

              {/* Terminal-style Input */}
              <div className="w-full max-w-xl">
                <form onSubmit={handleSubmit} noValidate>
                  <ChatInput
                    value={form.prompt}
                    onChange={(value) => setForm((previous) => ({ ...previous, prompt: value }))}
                    isSubmitting={isSubmitting}
                  />
                </form>
              </div>
            </div>

            {/* Right Column - Decorative Elements */}
            <div className="hidden lg:block relative h-[500px]">
              {/* Animated nodes/connections visualization */}
              <div className="absolute inset-0">
                {/* Top node */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-8 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                {/* Center icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-12 h-12 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[#888] animate-pulse">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#333" />
                      <stop offset="50%" stopColor="#444" />
                      <stop offset="100%" stopColor="#333" />
                    </linearGradient>
                  </defs>
                  {/* Horizontal dashed lines */}
                  <line x1="50" y1="100" x2="350" y2="100" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="200" x2="350" y2="200" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="300" x2="350" y2="300" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="50" y1="400" x2="350" y2="400" stroke="#222" strokeWidth="1" strokeDasharray="4 4" />
                </svg>

                {/* Additional nodes */}
                <div className="absolute top-[180px] left-8">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-8 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                <div className="absolute top-[280px] right-8">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                    <div className="w-8 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                <div className="absolute bottom-[80px] left-1/3">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full">
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-2 h-2 rounded-full bg-[#444]" />
                    <div className="w-8 h-2 rounded-full bg-[#333]" />
                  </div>
                </div>

                {/* Code snippet card */}
                <div className="absolute bottom-12 right-0 w-56 bg-[#111] border border-[#222] rounded-lg p-3 font-mono text-xs">
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#ff5f56]" />
                    <div className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2 h-2 rounded-full bg-[#27ca40]" />
                  </div>
                  <div className="text-[#666] text-[10px] leading-relaxed">
                    <span className="text-[#888]">from</span> <span className="text-[#FF6B35]">surveyor</span><br />
                    <span className="text-[#888]">import</span> research<br />
                    <br />
                    <span className="text-[#555]"># AI-powered</span><br />
                    research.<span className="text-[#888]">conduct</span>()
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
