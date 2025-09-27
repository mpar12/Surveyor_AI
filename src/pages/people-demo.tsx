"use client";

import { FormEvent, useState } from "react";

interface Contact {
  name: string;
  title: string;
  email: string;
  company: string;
  domain: string;
  location: string;
  email_status: string;
}

const INITIAL_FORM = {
  title: "Head of Product",
  location: "California, US",
  industry: ""
};

export default function PeopleDemoPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    setContacts([]);

    try {
      const response = await fetch("/api/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          location: form.location,
          industry: form.industry || undefined
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to retrieve contacts. Please try again.";
        setError(message);
        return;
      }

      setContacts(Array.isArray(payload.contacts) ? payload.contacts : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1.5rem" }}>
        People Search Demo
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "1rem",
          padding: "1.5rem",
          borderRadius: "16px",
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)"
        }}
      >
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600 }}>Job Title *</span>
          <input
            value={form.title}
            onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            required
            placeholder="Product Manager"
            style={{
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              padding: "0.75rem 1rem",
              fontSize: "1rem"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600 }}>Location *</span>
          <input
            value={form.location}
            onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
            required
            placeholder="California, US"
            style={{
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              padding: "0.75rem 1rem",
              fontSize: "1rem"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600 }}>Industry (optional)</span>
          <input
            value={form.industry}
            onChange={(event) => setForm((previous) => ({ ...previous, industry: event.target.value }))}
            placeholder="Fintech"
            style={{
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              padding: "0.75rem 1rem",
              fontSize: "1rem"
            }}
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            marginTop: "0.5rem",
            border: "none",
            borderRadius: "999px",
            padding: "0.9rem 1.75rem",
            fontWeight: 600,
            fontSize: "1rem",
            color: "#ffffff",
            background: "linear-gradient(135deg, #6366f1 0%, #2563eb 100%)",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            transition: "transform 0.2s ease"
          }}
        >
          {isLoading ? "Loading…" : "Fetch people"}
        </button>
      </form>

      {error ? (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#991b1b"
          }}
        >
          {error}
        </div>
      ) : null}

      {contacts.length ? (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
            Verified contacts
          </h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#ffffff",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 18px 35px rgba(15, 23, 42, 0.08)"
            }}
          >
            <thead style={{ background: "#f3f4f6", textAlign: "left" }}>
              <tr>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.95rem", color: "#1f2937" }}>Name</th>
                <th style={{ padding: "0.85rem 1rem", fontSize: "0.95rem", color: "#1f2937" }}>Email</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={`${contact.email}-${contact.name}`} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.95rem", color: "#111827" }}>
                    <div style={{ fontWeight: 600 }}>{contact.name || "Unknown"}</div>
                    <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>{contact.title}</div>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", fontSize: "0.95rem", color: "#2563eb" }}>
                    {contact.email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
