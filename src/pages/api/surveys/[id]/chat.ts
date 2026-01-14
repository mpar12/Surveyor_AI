import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions, surveyChatHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SURVEY_GENERATION_SYSTEM_PROMPT,
  extractSurveyFromResponse,
} from "@/lib/prompts/surveyGeneration";
import { getDefaultSettingsForType } from "@/types/surveyBuilder";
import type { QuestionType } from "@/types/surveyBuilder";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.claude_api_key,
});

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface GeneratedQuestion {
  type: QuestionType;
  text: string;
  settings?: Record<string, unknown>;
}

interface GeneratedSection {
  title: string;
  questions: GeneratedQuestion[];
}

interface GeneratedSurvey {
  title: string;
  description?: string;
  settings?: Record<string, unknown>;
  sections: GeneratedSection[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id: surveyId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  const { message } = req.body as { message: string };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message_required" });
  }

  try {
    // Verify survey exists
    const [survey] = await db
      .select()
      .from(surveys)
      .where(eq(surveys.id, surveyId))
      .limit(1);

    if (!survey) {
      return res.status(404).json({ error: "survey_not_found" });
    }

    // Get or create chat history
    let [chatHistory] = await db
      .select()
      .from(surveyChatHistory)
      .where(eq(surveyChatHistory.surveyId, surveyId))
      .limit(1);

    const existingMessages: ChatMessage[] = chatHistory?.messages as ChatMessage[] || [];

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    const updatedMessages = [...existingMessages, userMessage];

    // Prepare messages for Claude
    const claudeMessages = updatedMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SURVEY_GENERATION_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    const assistantContent =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Check if response contains a survey structure
    const { survey: generatedSurvey, cleanContent } = extractSurveyFromResponse(assistantContent);

    // Add assistant message
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: cleanContent || assistantContent,
      timestamp: new Date(),
    };

    const finalMessages = [...updatedMessages, assistantMessage];

    // Save chat history
    if (chatHistory) {
      await db
        .update(surveyChatHistory)
        .set({
          messages: finalMessages,
          updatedAt: new Date(),
        })
        .where(eq(surveyChatHistory.id, chatHistory.id));
    } else {
      await db.insert(surveyChatHistory).values({
        surveyId,
        messages: finalMessages,
      });
    }

    // If survey was generated, apply it
    let surveyUpdated = false;
    if (generatedSurvey) {
      await applySurveyStructure(surveyId, generatedSurvey as GeneratedSurvey);
      surveyUpdated = true;
    }

    return res.status(200).json({
      message: assistantMessage,
      surveyGenerated: surveyUpdated,
    });
  } catch (error) {
    console.error("Failed to process chat message", error);
    return res.status(500).json({ error: "internal_error" });
  }
}

async function applySurveyStructure(surveyId: string, generated: GeneratedSurvey) {
  // Update survey title and settings
  await db
    .update(surveys)
    .set({
      title: generated.title,
      description: generated.description || null,
      settings: generated.settings || null,
      updatedAt: new Date(),
    })
    .where(eq(surveys.id, surveyId));

  // Delete existing sections and questions
  const existingSections = await db
    .select({ id: surveySections.id })
    .from(surveySections)
    .where(eq(surveySections.surveyId, surveyId));

  for (const section of existingSections) {
    await db.delete(surveyQuestions).where(eq(surveyQuestions.sectionId, section.id));
  }

  await db.delete(surveySections).where(eq(surveySections.surveyId, surveyId));

  // Create new sections and questions
  for (let sectionIndex = 0; sectionIndex < generated.sections.length; sectionIndex++) {
    const sectionData = generated.sections[sectionIndex];

    const [newSection] = await db
      .insert(surveySections)
      .values({
        surveyId,
        title: sectionData.title,
        order: sectionIndex,
      })
      .returning();

    for (let qIndex = 0; qIndex < sectionData.questions.length; qIndex++) {
      const questionData = sectionData.questions[qIndex];
      const questionType = questionData.type as QuestionType;

      // Merge generated settings with defaults
      const defaultSettings = getDefaultSettingsForType(questionType);
      const mergedSettings = {
        ...defaultSettings,
        ...questionData.settings,
        // Handle options for multiple choice
        ...(questionType === "multiple_choice" && questionData.settings?.options
          ? {
              options: (questionData.settings.options as Array<{ text: string }>).map(
                (opt, i) => ({
                  id: crypto.randomUUID(),
                  text: opt.text,
                  isOther: false,
                })
              ),
            }
          : {}),
      };

      await db.insert(surveyQuestions).values({
        sectionId: newSection.id,
        type: questionType,
        text: questionData.text,
        order: qIndex,
        settings: mergedSettings,
      });
    }
  }
}
