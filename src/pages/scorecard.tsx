import Head from "next/head";

export default function ScorecardPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
        color: "#374151",
        fontFamily: "Inter, system-ui, sans-serif"
      }}
    >
      <Head>
        <title>Scorecard | SurvAgent</title>
        <meta name="description" content="Scorecard placeholder page" />
      </Head>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.75rem" }}>Scorecard</h1>
        <p style={{ fontSize: "1rem" }}>This page is reserved for the upcoming scorecard experience.</p>
      </div>
    </div>
  );
}
