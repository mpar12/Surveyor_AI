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
        padding: "clamp(2rem, 5vw, 4rem)",
        background:
          "radial-gradient(circle at 20% 10%, rgba(255, 111, 145, 0.18) 0%, rgba(5, 7, 13, 0) 45%), " +
          "radial-gradient(circle at 80% 0%, rgba(127, 83, 243, 0.2) 0%, rgba(5, 7, 13, 0) 45%)",
        color: "var(--color-text-primary)"
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
          background: "var(--gradient-surface)",
          borderRadius: "22px",
          boxShadow: "var(--shadow-card)",
          padding: "2.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          border: "1px solid var(--color-border)"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Access your scorecard
          </h1>
          <p style={{ color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
            Enter the 4-digit PIN you received when you created your SurvAgent session.
          </p>
        </div>

        {showError ? (
          <div
            style={{
              background: "var(--color-error-surface)",
              border: "1px solid var(--color-error-border)",
              color: "var(--color-error)",
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
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <label style={{ color: "var(--color-text-secondary)", fontWeight: 600 }} htmlFor="pin">
              Please enter your 4-digit PIN
            </label>
            <input
              id="pin"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              required
              placeholder="0000"
              style={{
                width: "100%",
                borderRadius: "16px",
                border: "1px solid rgba(132, 144, 190, 0.24)",
                padding: "0.9rem 1rem",
                textAlign: "center",
                letterSpacing: "0.35rem",
                fontSize: "1.5rem",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                background: "rgba(24, 30, 50, 0.92)"
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "0.95rem 1.5rem",
              fontWeight: 600,
              fontSize: "1rem",
              color: "var(--color-text-primary)",
              background: "var(--gradient-accent)",
              cursor: "pointer",
              boxShadow: "0 24px 48px rgba(255, 111, 145, 0.28)",
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
