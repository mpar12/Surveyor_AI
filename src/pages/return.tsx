import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
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

export default function ReturnPage() {
  const router = useRouter();
  const showError = router.query.e === "1";
  const [pin, setPin] = useState(["", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && pin.every((d) => d)) {
      handleSubmit();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pastedData.length === 4) {
      const newPin = pastedData.split("");
      setPin(newPin);
      inputRefs.current[3]?.focus();
    }
  };

  const handleSubmit = async () => {
    const fullPin = pin.join("");
    if (fullPin.length !== 4) return;

    setIsSubmitting(true);

    // Create form data and submit
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/return";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "pin";
    input.value = fullPin;

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  const isComplete = pin.every((d) => d);

  return (
    <div className="min-h-screen w-full bg-gradient-hero">
      <Head>
        <title>Return to Session | Surveyor</title>
        <meta name="description" content="Access your session scorecard using a PIN." />
      </Head>

      <Header />

      <main className="flex flex-col items-center w-full px-6 md:px-12 lg:px-20 pt-16 md:pt-24">
        <motion.div
          className="w-full max-w-md"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center mb-8">
            <Badge variant="secondary" size="lg" className="mb-4">
              <LockIcon className="w-4 h-4 mr-1.5" />
              Secure Access
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Welcome back
            </h1>
            <p className="text-foreground-secondary">
              Enter your 4-digit PIN to access your research session
            </p>
          </motion.div>

          {/* Error Banner */}
          {showError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Card variant="outline" className="border-error bg-error-subtle">
                <CardContent className="flex items-center gap-3 p-4">
                  <ErrorIcon className="w-5 h-5 text-error flex-shrink-0" />
                  <p className="text-sm text-error font-medium">
                    Invalid PIN. Please check and try again.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* PIN Entry Card */}
          <motion.div variants={fadeInUp}>
            <Card variant="elevated" className="p-8">
              <CardContent className="space-y-8">
                {/* PIN Input Grid */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground text-center">
                    Enter PIN
                  </label>
                  <div className="flex justify-center gap-3">
                    {pin.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        className="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 border-border bg-surface text-foreground transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/20 focus:outline-none hover:border-border-strong"
                        aria-label={`PIN digit ${index + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-foreground-muted text-center">
                    Tip: You can paste your full PIN
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!isComplete || isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Accessing..." : "View Results"}
                </Button>

                {/* Security Note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-background-subtle">
                  <ShieldIcon className="w-5 h-5 text-foreground-muted flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground-muted">
                    Only teammates with the correct PIN can access this session. Your research data is kept private.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Back Link */}
          <motion.div variants={fadeInUp} className="text-center mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Start a new research session
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}

// Icons
function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
