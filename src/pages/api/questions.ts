import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { QUESTION_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import type { InterviewScript } from "@/types/interviewScript";

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
  res: NextApiResponse<InterviewScript | ErrorResponse>
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

    let parsed: InterviewScript;
    try {
      parsed = JSON.parse(content) as InterviewScript;
    } catch (parseError) {
      console.error("Failed to parse interview script JSON", parseError, content);
      throw new Error(`Claude returned invalid JSON for interview script. Raw output: ${content}`);
    }

    if (!parsed || typeof parsed !== "object" || !parsed.sections) {
      throw new Error("Interview script JSON is missing required fields");
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Failed to generate survey questions", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate survey questions";
    return res.status(500).json({ error: errorMessage });
  }
}
