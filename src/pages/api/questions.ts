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

  const { company, product, desiredIcp, desiredIcpIndustry, feedbackDesired, keyQuestions } =
    req.body ?? {};

  if (
    typeof company !== "string" ||
    typeof product !== "string" ||
    typeof desiredIcp !== "string" ||
    typeof desiredIcpIndustry !== "string" ||
    typeof feedbackDesired !== "string" ||
    typeof keyQuestions !== "string"
  ) {
    return res.status(400).json({ error: "Invalid payload. Expect string fields." });
  }

  if (
    !company.trim() ||
    !product.trim() ||
    !desiredIcp.trim() ||
    !desiredIcpIndustry.trim() ||
    !feedbackDesired.trim()
  ) {
    return res.status(400).json({ error: "All fields must be non-empty." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY environment variable is not set." });
  }

  try {
    const trimmedKeyQuestions = keyQuestions.trim();
    const keyQuestionsSection = trimmedKeyQuestions || "None provided.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an marketing analyst who crafts incisive qualitative questions. Respond only in valid JSON."
        },
        {
          role: "user",
          content: `Company: ${company}\nProduct: ${product}\nIdeal customer persona (ICP): ${desiredIcp}\nICP industry: ${desiredIcpIndustry}\nWhat the customer is trying to understand: ${feedbackDesired}\nKey questions from requester: ${keyQuestionsSection}\n\nGenerate 10 thoughtful survey questions that help assess the company's and product's market position from the perspective of this ICP. \nQuestions should:\n - The first 3 questions should collect demographic survey data about the user\n - Help reach the goal of understanding ${feedbackDesired}\n- Phrase questions as simply as possible.\n- If key questions are provided, weave them into the list without duplicating them.\nReturn JSON with an array field named questions containing exactly 10 unique strings.`
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
