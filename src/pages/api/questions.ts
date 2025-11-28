import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type QuestionsResponse = {
  questions: string[];
};

type ErrorResponse = {
  error: string;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY environment variable is not set." });
  }

  try {
    const trimmedKeyQuestions =
      typeof keyQuestions === "string" && keyQuestions.trim() ? keyQuestions.trim() : "";
    const keyQuestionsSection = trimmedKeyQuestions || "None provided.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a marketing analyst who crafts incisive qualitative questions. Respond only in valid JSON."
        },
        {
          role: "user",
          content: `Requester: ${typeof requester === "string" && requester.trim() ? requester.trim() : "Unknown"}\nPrompt: ${prompt}\n Generate 10 thoughtful survey questions that would help address this prompt. Questions should dig into motivations, behaviors, and desired outcomes related to the prompt\n- remain concise, free of jargon, and avoid yes/no when possible.\nReturn JSON with an array field named questions containing exactly 10 unique strings.`
        }
      ]
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from OpenAI");
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
