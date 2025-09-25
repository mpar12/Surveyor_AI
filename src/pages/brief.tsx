import Head from "next/head";
import Link from "next/link";

export default function BriefPage() {
  return (
    <>
      <Head>
        <title>Survey Brief | SurvAgent</title>
      </Head>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1.5rem",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Survey Brief Coming Soon</h1>
        <p style={{ maxWidth: "520px", textAlign: "center", color: "#4b5563" }}>
          We will use this page to surface a preview of your ElevenLabs agent run and confirm the
          outreach strategy. Additional steps will follow as we build the full four-page flow.
        </p>
        <Link href="/">
          <span style={{ color: "#2563eb" }}>← Back to intake form</span>
        </Link>
      </main>
    </>
  );
}
