import Head from "next/head";
import Link from "next/link";

export default function ResultsPage() {
  return (
    <>
      <Head>
        <title>Survey Results | SurvAgent</title>
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
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>Results Dashboard</h1>
        <p style={{ maxWidth: "520px", color: "#4b5563" }}>
          Once the agent completes its outreach, this page will summarize key findings, callouts, and
          recommended next steps.
        </p>
        <Link href="/">
          <span style={{ color: "#2563eb" }}>Return to intake</span>
        </Link>
      </main>
    </>
  );
}
