import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { QUESTION_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";

type ErrorResponse = {
  error: string;
};

const CLAUDE_API_KEY = process.env.claude_api_key ?? process.env.CLAUDE_API_KEY;

const getAnthropicClient = () => {
  if (!CLAUDE_API_KEY) {
    throw new Error("CLAUDE_API_KEY environment variable is not set.");
  }
  return new Anthropic({
    apiKey: CLAUDE_API_KEY
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string | ErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, requester, keyQuestions } = req.body ?? {};

  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: "CLAUDE_API_KEY environment variable is not set." });
  }

  try {
    const anthropic = getAnthropicClient();
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 10000,
      temperature: 0.2,
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Requester: ${
            typeof requester === "string" && requester.trim() ? requester.trim() : "Unknown"
          }\nPrompt: ${prompt}`
        }
      ]
    });

    const textContent = completion.content.find((block) => block.type === "text");
    const content =
      textContent && "text" in textContent ? (textContent as { text: string }).text : null;

    if (!content) {
      console.error("No content returned from Anthropic. Response:", JSON.stringify(completion, null, 2));
      throw new Error("No content returned from Anthropic");
    }

    const paragraph = content.trim();

    if (!paragraph) {
      throw new Error("Anthropic returned an empty paragraph.");
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(paragraph);
  } catch (error) {
    console.error("Failed to generate survey questions", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate survey questions";
    return res.status(500).json({ error: errorMessage });
  }
}
