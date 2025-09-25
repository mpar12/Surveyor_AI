import Head from "next/head";
import Link from "next/link";

export default function AgentPage() {
  return (
    <>
      <Head>
        <title>Agent Setup | SurvAgent</title>
      </Head>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif"
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>ElevenLabs Agent Integration</h1>
        <p style={{ maxWidth: "520px", color: "#4b5563" }}>
          This page will invite you to configure the ElevenLabs AI Agent with your intake details.
          We will wire up the real integration in a follow-up iteration.
        </p>
        <Link href="/">
          <span style={{ color: "#2563eb" }}>Return to intake</span>
        </Link>
      </main>
    </>
  );
}
