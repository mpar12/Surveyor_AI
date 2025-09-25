import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

type DescriptionResponse = {
  companyDescription: string;
  productDescription: string;
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

  const { company, product } = req.body ?? {};

  if (typeof company !== "string" || typeof product !== "string") {
    return res.status(400).json({ error: "Both company and product must be provided as strings." });
  }

  if (!company.trim() || !product.trim()) {
    return res
      .status(400)
      .json({ error: "Both company and product must be non-empty values." });
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
            "You are a marketing analyst crafting concise, factual descriptions. Respond only in valid JSON."
        },
        {
          role: "user",
          content: `Company name: ${company}\nProduct name: ${product}\nReturn JSON with two keys: companyDescription and productDescription. Each value must be exactly 50 words, professional tone, concise sentences. Avoid bullet points or numbering.`
        }
      ]
    });

    const messageContent = completion.choices[0]?.message?.content;

    if (!messageContent) {
      throw new Error("No content returned from OpenAI");
    }

    const parsed = JSON.parse(messageContent) as Partial<DescriptionResponse>;

    if (!parsed.companyDescription || !parsed.productDescription) {
      throw new Error("Response is missing required fields");
    }

    return res.status(200).json({
      companyDescription: parsed.companyDescription,
      productDescription: parsed.productDescription
    });
  } catch (error) {
    console.error("Failed to generate descriptions", error);
    return res.status(500).json({ error: "Failed to generate descriptions" });
  }
}
