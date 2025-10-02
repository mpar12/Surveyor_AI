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
          color: "#101322",
          textDecoration: "none",
          padding: "0.6rem 1.2rem",
          borderRadius: "999px",
          border: "1px solid rgba(16, 19, 34, 0.6)",
          transition: "background 0.2s ease, color 0.2s ease"
        }}
      >
        Returning? Click here to input PIN and view previous results
      </Link>
    </header>
  );
}
