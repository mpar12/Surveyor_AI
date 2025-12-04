import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";

type QuestionsResponse = {
  paragraph: string;
};

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
    const anthropic = getAnthropicClient();
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      temperature: 0.2,
      system:
        "You are a marketing analyst who crafts incisive qualitative questions for AI-driven customer surveys. Make the questions non-AI sounding. Adopt the principles to write questions laid out in the boook: the mom test(by rob fitzpatrick). Respond only in valid JSON.",
      messages: [
        {
          role: "user",
          content: `Requester: ${
            typeof requester === "string" && requester.trim() ? requester.trim() : "Unknown"
          }\nPrompt: ${prompt}\nWrite a single paragraph (3-4 sentences) that naturally weaves in approximately ten crisp survey questions or probes that would help address this prompt. Do not number or bullet them; the paragraph should read like conversational guidance covering motivations, behaviors, and desired outcomes related to the prompt while remaining concise and free of jargon. Return JSON with a single field named "paragraph" containing the paragraph string.`
        }
      ]
    });

    const textContent = completion.content.find((block) => block.type === "text");
    const content = textContent && "text" in textContent ? (textContent as { text: string }).text : null;

    if (!content) {
      console.error("No content returned from Anthropic. Response:", JSON.stringify(completion, null, 2));
      throw new Error("No content returned from Anthropic");
    }

    let parsed: Partial<QuestionsResponse>;
    try {
      parsed = JSON.parse(content) as Partial<QuestionsResponse>;
    } catch (parseError) {
      console.error("Failed to parse JSON response. Content:", content);
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (typeof parsed.paragraph !== "string" || !parsed.paragraph.trim()) {
      console.error("Response missing paragraph field. Parsed:", JSON.stringify(parsed, null, 2));
      throw new Error("Response must include a paragraph field");
    }

    return res.status(200).json({ paragraph: parsed.paragraph });
  } catch (error) {
    console.error("Failed to generate survey questions", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate survey questions";
    return res.status(500).json({ error: errorMessage });
  }
}
