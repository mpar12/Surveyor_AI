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
        background: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(6px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        borderBottom: "1px solid #e5e7eb"
      }}
    >
      <Link
        href="/return"
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "#2563eb",
          textDecoration: "none",
          padding: "0.6rem 1.2rem",
          borderRadius: "999px",
          border: "1px solid rgba(37, 99, 235, 0.35)",
          transition: "background 0.2s ease, color 0.2s ease"
        }}
      >
        Returning? Click here to input PIN and view previous results
      </Link>
    </header>
  );
}
