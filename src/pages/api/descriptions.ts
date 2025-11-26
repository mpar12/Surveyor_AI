import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type DescriptionResponse = {
  promptSummary: string;
  researchHighlights: string;
};

type ErrorResponse = {
  error: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DescriptionResponse | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, requester } = req.body ?? {};

  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "A prompt must be provided." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY environment variable is not set." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a marketing analyst who distills research prompts into succinct summaries and highlights. Respond only in valid JSON."
        },
        {
          role: "user",
          content: `Requester: ${typeof requester === "string" && requester.trim() ? requester.trim() : "Unknown"}\nPrompt: ${prompt}\n\nReturn JSON with two keys: promptSummary and researchHighlights. promptSummary should be 2 sentences that restate the goal of the prompt. researchHighlights should be 2-3 sentences that surface angles, audiences, or constraints worth exploring. Avoid bullet points.`
        }
      ]
    });

    const messageContent = completion.choices[0]?.message?.content;

    if (!messageContent) {
      throw new Error("No content returned from OpenAI");
    }

    const parsed = JSON.parse(messageContent) as Partial<DescriptionResponse>;

    if (!parsed.promptSummary || !parsed.researchHighlights) {
      throw new Error("Response is missing required fields");
    }

    return res.status(200).json({
      promptSummary: parsed.promptSummary,
      researchHighlights: parsed.researchHighlights
    });
  } catch (error) {
    console.error("Failed to generate descriptions", error);
    return res.status(500).json({ error: "Failed to generate descriptions" });
  }
}
