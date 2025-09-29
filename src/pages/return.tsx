import Head from "next/head";
import { useRouter } from "next/router";

export default function ReturnPage() {
  const router = useRouter();
  const showError = router.query.e === "1";

  return (
    <div
      style={{
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem"
      }}
    >
      <Head>
        <title>Return to Scorecard | SurvAgent</title>
        <meta name="description" content="Access your session scorecard using a PIN." />
      </Head>
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.12)",
          padding: "2.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827" }}>Access your scorecard</h1>
          <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
            Enter the 4-digit PIN you received when you created your SurvAgent session.
          </p>
        </div>

        {showError ? (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: "12px",
              padding: "0.85rem 1rem",
              textAlign: "center",
              fontWeight: 600
            }}
          >
            Invalid PIN. Try again.
          </div>
        ) : null}

        <form
          method="POST"
          action="/api/return"
          style={{ display: "grid", gap: "1.25rem" }}
        >
          <input
            name="pin"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="one-time-code"
            required
            placeholder="Enter your 4-digit PIN"
            style={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              padding: "0.9rem 1rem",
              textAlign: "center",
              letterSpacing: "0.4rem",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#111827"
            }}
          />

          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.95rem 1.5rem",
              fontWeight: 600,
              fontSize: "1rem",
              color: "#ffffff",
              background: "linear-gradient(135deg, #6366f1 0%, #2563eb 100%)",
              cursor: "pointer",
              boxShadow: "0 18px 40px rgba(99, 102, 241, 0.35)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
          >
            View Results
          </button>
        </form>
      </div>
    </div>
  );
}
