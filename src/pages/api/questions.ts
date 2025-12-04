import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

type QuestionsResponse = {
  questions: string[];
};

type ErrorResponse = {
  error: string;
};

const CLAUDE_API_KEY = process.env.claude_api_key ?? process.env.CLAUDE_API_KEY;

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuestionsResponse | ErrorResponse>
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
    const trimmedKeyQuestions =
      typeof keyQuestions === "string" && keyQuestions.trim() ? keyQuestions.trim() : "";
    const keyQuestionsSection = trimmedKeyQuestions || "None provided.";

    const completion = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 600,
      temperature: 0.2,
      system:
        "You are a marketing analyst who crafts incisive qualitative questions for AI-driven customer surveys. Make the questions non-AI sounding. Adopt the principles to write questions laid out in the boook: the mom test(by rob fitzpatrick). Respond only in valid JSON.",
      messages: [
        {
          role: "user",
          content: `Requester: ${typeof requester === "string" && requester.trim() ? requester.trim() : "Unknown"}\nPrompt: ${prompt}\nGenerate 10 thoughtful survey questions that would help address this prompt. Questions should dig into motivations, behaviors, and desired outcomes related to the prompt\n- remain concise, free of jargon, and avoid yes/no when possible.\nReturn JSON with an array field named questions containing exactly 10 unique strings.`
        }
      ]
    });

    const textContent = completion.content?.find((block) => block.type === "text");
    const content = textContent && "text" in textContent ? textContent.text : null;

    if (!content) {
      throw new Error("No content returned from Anthropic");
    }

    const parsed = JSON.parse(content) as Partial<QuestionsResponse>;

    if (!Array.isArray(parsed.questions) || parsed.questions.length !== 10) {
      throw new Error("Response must include exactly 10 questions");
    }

    return res.status(200).json({ questions: parsed.questions });
  } catch (error) {
    console.error("Failed to generate survey questions", error);
    return res.status(500).json({ error: "Failed to generate survey questions" });
  }
}
