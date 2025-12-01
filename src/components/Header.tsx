import Link from "next/link";

export default function Header() {
  return (
    <header
      style={{
        width: "100%",
        padding: "1rem 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 10,
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }}
    >
      <Link
        href="/return"
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "#0f172a",
          textDecoration: "none",
          padding: "0.6rem 1.2rem",
          borderRadius: "999px",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          transition: "background 0.2s ease, color 0.2s ease",
          background: "rgba(37, 99, 235, 0.08)"
        }}
      >
        Returning? Click here to input PIN and view previous results
      </Link>
    </header>
  );
}
