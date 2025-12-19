export const sanitizeJsonLikeString = (input: string) => {
  let text = input.trim();
  if (!text) {
    return text;
  }

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }

  if (text.startsWith("'''")) {
    text = text.replace(/^'''(?:json)?/i, "").replace(/'''$/, "").trim();
  }

  const lower = text.toLowerCase();
  if (lower.startsWith("json:") || lower.startsWith("json=")) {
    const firstBrace = text.indexOf("{");
    if (firstBrace !== -1) {
      text = text.slice(firstBrace);
    } else {
      text = text.slice(text.indexOf(":") + 1).trim();
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
};
