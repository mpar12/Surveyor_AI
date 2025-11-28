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
        background: "#042224",
        position: "sticky",
        top: 0,
        zIndex: 10,
        borderBottom: "1px solid rgba(249, 238, 215, 0.3)",
        boxShadow: "0 8px 18px rgba(3, 20, 18, 0.35)"
      }}
    >
      <Link
        href="/return"
        style={{
          fontSize: "0.95rem",
          fontWeight: 600,
          color: "#f9eed7",
          textDecoration: "none",
          padding: "0.6rem 1.2rem",
          borderRadius: "999px",
          border: "1px solid rgba(249, 238, 215, 0.35)",
          transition: "background 0.2s ease, color 0.2s ease",
          background: "rgba(249, 238, 215, 0.08)"
        }}
      >
        Returning? Click here to input PIN and view previous results
      </Link>
    </header>
  );
}
