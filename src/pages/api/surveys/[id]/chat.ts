import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db/client";
import { surveys, surveySections, surveyQuestions, surveyChatHistory } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  SURVEY_GENERATION_SYSTEM_PROMPT,
  extractSurveyFromResponse,
  SURVEY_SUGGESTIONS_SYSTEM_PROMPT,
  SURVEY_SUGGESTION_APPLY_SYSTEM_PROMPT,
  extractSuggestionsFromResponse,
} from "@/lib/prompts/surveyGeneration";
import { getDefaultSettingsForType } from "@/types/surveyBuilder";
import type { QuestionType } from "@/types/surveyBuilder";

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || process.env.claude_api_key,
});

const MULTI_VERSION_WARNING =
  "I can only generate one study per survey. If you'd like another version, please create a new study and I can build it there.";

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
  externalTitle?: string;
  description?: string;
  studyGoals?: string[];
  audience?: {
    bringOwnParticipants?: boolean;
  };
  settings?: Record<string, unknown>;
  sections: GeneratedSection[];
}

const isMultiVersionRequest = (value: string) => {
  if (/\b(two|2)\s+(versions|variants|alternatives|options|surveys)\b/i.test(value)) {
    return true;
  }

  const hasVersionA = /\b(version|variant|option)\s*a\b/i.test(value);
  const hasVersionB = /\b(version|variant|option)\s*b\b/i.test(value);
  if (hasVersionA && hasVersionB) return true;

  const hasVersion1 = /\bversion\s*1\b/i.test(value);
  const hasVersion2 = /\bversion\s*2\b/i.test(value);
  if (hasVersion1 && hasVersion2) return true;

  if (/\bA\s*\/\s*B\b/i.test(value) || /\bAB\s*test\b/i.test(value)) return true;

  return false;
};

const SUGGESTION_LIMIT = 3;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { id: surveyId } = req.query;

  if (typeof surveyId !== "string") {
    return res.status(400).json({ error: "invalid_survey_id" });
  }

  const { message, mode } = req.body as { message: string; mode?: "apply_suggestion" };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message_required" });
  }

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof (res as { flushHeaders?: () => void }).flushHeaders === "function") {
      (res as { flushHeaders: () => void }).flushHeaders();
    }

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

    const isApplySuggestion = mode === "apply_suggestion";
    const isMultiVersion = !isApplySuggestion && isMultiVersionRequest(message);

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    const updatedMessages = [...existingMessages, userMessage];

    if (isMultiVersion) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: MULTI_VERSION_WARNING,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];

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

      sendEvent("done", {
        message: assistantMessage,
        surveyGenerated: false,
      });
      res.end();
      return;
    }

    // Prepare messages for Claude
    const claudeMessages = isApplySuggestion
      ? [
          {
            role: "user" as const,
            content: JSON.stringify({
              suggestion: message,
              survey: await buildSurveySnapshot(surveyId),
            }),
          },
        ]
      : updatedMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: isApplySuggestion
        ? SURVEY_SUGGESTION_APPLY_SYSTEM_PROMPT
        : SURVEY_GENERATION_SYSTEM_PROMPT,
      stream: true,
      messages: claudeMessages,
    });

    let assistantContent = "";

    try {
      for await (const event of response) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const text = event.delta.text || "";
          if (!text) continue;
          assistantContent += text;
          sendEvent("delta", { text });
        } else if (event.type === "message_stop") {
          break;
        } else if ("error" in event) {
          const errorEvent = event as { error?: { message?: string } };
          const message = errorEvent.error?.message || "Anthropic streaming error.";
          sendEvent("error", { message });
          res.end();
          return;
        }
      }
    } catch (streamError) {
      console.error("Anthropic streaming failed", streamError);
      sendEvent("error", {
        message:
          streamError instanceof Error ? streamError.message : "Unable to stream survey response."
      });
      res.end();
      return;
    }

    // Check if response contains a survey structure
    const surveyTagMatches = assistantContent.match(/<survey>/gi) ?? [];
    const multipleSurveysDetected = surveyTagMatches.length > 1;
    const { survey: generatedSurvey, cleanContent } = multipleSurveysDetected
      ? { survey: null, cleanContent: MULTI_VERSION_WARNING }
      : extractSurveyFromResponse(assistantContent);

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
    let suggestions: string[] = [];
    if (generatedSurvey && !multipleSurveysDetected) {
      suggestions = await generateSurveySuggestions(generatedSurvey as GeneratedSurvey);
      await applySurveyStructure(surveyId, generatedSurvey as GeneratedSurvey, suggestions);
      surveyUpdated = true;
    }

    sendEvent("done", {
      message: assistantMessage,
      surveyGenerated: surveyUpdated,
      suggestions,
    });
    res.end();
    return;
  } catch (error) {
    console.error("Failed to process chat message", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "internal_error" });
    }
    sendEvent("error", { message: "internal_error" });
    res.end();
    return;
  }
}

async function applySurveyStructure(
  surveyId: string,
  generated: GeneratedSurvey,
  suggestions?: string[]
) {
  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const normalizeStringArray = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) return null;
    const filtered = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return filtered.length ? filtered : null;
  };

  const normalizeAudience = (value: unknown): { bringOwnParticipants?: boolean } | null => {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    if (typeof raw.bringOwnParticipants === "boolean") {
      return { bringOwnParticipants: raw.bringOwnParticipants };
    }
    return null;
  };

  const rawSettings =
    generated.settings && typeof generated.settings === "object"
      ? (generated.settings as Record<string, unknown>)
      : {};
  const fallbackExternalTitle = normalizeString(generated.title);
  const externalTitle =
    normalizeString(generated.externalTitle ?? rawSettings.externalTitle) ?? fallbackExternalTitle;
  const studyGoals = normalizeStringArray(generated.studyGoals ?? rawSettings.studyGoals);
  const audience =
    normalizeAudience(generated.audience ?? rawSettings.audience) ?? { bringOwnParticipants: false };
  const mergedSettings: Record<string, unknown> = { ...rawSettings };

  if (externalTitle) mergedSettings.externalTitle = externalTitle;
  if (studyGoals) mergedSettings.studyGoals = studyGoals;
  if (audience) mergedSettings.audience = audience;
  if (suggestions && suggestions.length > 0) {
    mergedSettings.suggestions = suggestions.slice(0, SUGGESTION_LIMIT);
  }

  const settingsValue = Object.keys(mergedSettings).length ? mergedSettings : null;

  // Update survey title and settings
  await db
    .update(surveys)
    .set({
      title: generated.title,
      description: generated.description || null,
      settings: settingsValue,
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

async function buildSurveySnapshot(surveyId: string): Promise<GeneratedSurvey> {
  const [survey] = await db
    .select()
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1);

  if (!survey) {
    throw new Error("survey_not_found");
  }

  const settingsRaw = (survey.settings ?? {}) as Record<string, unknown>;
  const { suggestions: _suggestions, ...settings } = settingsRaw;

  const externalTitle =
    typeof settingsRaw.externalTitle === "string" ? settingsRaw.externalTitle : undefined;
  const studyGoals = Array.isArray(settingsRaw.studyGoals)
    ? settingsRaw.studyGoals.filter((item) => typeof item === "string")
    : undefined;
  const audience =
    settingsRaw.audience && typeof settingsRaw.audience === "object"
      ? (settingsRaw.audience as { bringOwnParticipants?: boolean })
      : undefined;

  const sections = await db
    .select()
    .from(surveySections)
    .where(eq(surveySections.surveyId, surveyId))
    .orderBy(asc(surveySections.order));

  const sectionsWithQuestions: GeneratedSection[] = await Promise.all(
    sections.map(async (section) => {
      const questions = await db
        .select()
        .from(surveyQuestions)
        .where(eq(surveyQuestions.sectionId, section.id))
        .orderBy(asc(surveyQuestions.order));

      return {
        title: section.title,
        questions: questions.map((question) => ({
          type: question.type as QuestionType,
          text: question.text,
          settings: question.settings as Record<string, unknown> | undefined,
        })),
      };
    })
  );

  return {
    title: survey.title,
    externalTitle,
    description: survey.description ?? undefined,
    studyGoals,
    audience,
    settings,
    sections: sectionsWithQuestions,
  };
}

async function generateSurveySuggestions(generated: GeneratedSurvey): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: SURVEY_SUGGESTIONS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(generated),
        },
      ],
    });

    const assistantContent =
      response.content[0].type === "text" ? response.content[0].text : "";
    const suggestions = extractSuggestionsFromResponse(assistantContent);
    return suggestions.slice(0, SUGGESTION_LIMIT);
  } catch (error) {
    console.error("Failed to generate survey suggestions", error);
    return [];
  }
}
