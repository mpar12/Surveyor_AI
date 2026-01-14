// ============================================
// Survey Builder Types (Listen Labs Style)
// ============================================

// Survey Status
export type SurveyStatus = "draft" | "published";
export type SurveyAccessType = "anonymous" | "unique_links" | "verified";

// Question Types
export type QuestionType = "multiple_choice" | "open_ended" | "statement";

// Follow-up Modes
export type FollowUpMode = "none" | "if_short" | "always";

// Input Types
export type InputType = "voice" | "text";

// Answer Types
export type AnswerType = "choice" | "text" | "voice";

// Response Status
export type ResponseStatus = "in_progress" | "completed" | "abandoned";

// ============================================
// Question Settings (stored in JSONB)
// ============================================

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isOther: boolean;
}

export interface MultipleChoiceSettings {
  selectionMode: "single" | "multiple";
  options: MultipleChoiceOption[];
  minSelections?: number;
  maxSelections?: number;
  allowOther: boolean;
  randomizeOrder: boolean;
}

export interface OpenEndedSettings {
  allowVoice: boolean;
  allowText: boolean;
  maxDurationSeconds?: number;
  followUpMode: FollowUpMode;
  followUpGuidelines?: string;
  preferredInput: InputType;
}

export interface StatementSettings {
  continueButtonText: string;
}

export type QuestionSettings =
  | MultipleChoiceSettings
  | OpenEndedSettings
  | StatementSettings;

// ============================================
// Skip Logic
// ============================================

export interface SkipCondition {
  questionId: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains";
  value: string | string[];
}

export interface SkipLogic {
  action: "skip_to" | "end_survey";
  targetQuestionId?: string;
  conditions: SkipCondition[];
  logic: "and" | "or";
}

// ============================================
// Survey Settings (global)
// ============================================

export interface SurveyWelcomeSettings {
  title: string;
  message: string;
  showConsentCheckbox: boolean;
  consentText?: string;
}

export interface SurveySettings {
  welcome: SurveyWelcomeSettings;
  estimatedDurationMinutes?: number;
  showProgressBar: boolean;
  allowSkipQuestions: boolean;
}

// ============================================
// Main Entities
// ============================================

export interface Survey {
  id: string;
  sessionId?: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  version: number;
  accessType: SurveyAccessType;
  settings?: SurveySettings;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface SurveySection {
  id: string;
  surveyId: string;
  title: string;
  description?: string;
  order: number;
  createdAt: Date;
}

export interface SurveyQuestion {
  id: string;
  sectionId: string;
  type: QuestionType;
  text: string;
  description?: string;
  order: number;
  settings?: QuestionSettings;
  skipLogic?: SkipLogic;
  createdAt: Date;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyVersion: number;
  respondentId?: string;
  respondentEmail?: string;
  status: ResponseStatus;
  startedAt: Date;
  completedAt?: Date;
}

export interface SurveyAnswer {
  id: string;
  responseId: string;
  questionId: string;
  answerType: AnswerType;
  choiceIds?: string[];
  textValue?: string;
  voiceUrl?: string;
  transcript?: string;
  createdAt: Date;
}

export interface SurveyFollowup {
  id: string;
  answerId: string;
  questionText: string;
  answerType?: AnswerType;
  textValue?: string;
  voiceUrl?: string;
  transcript?: string;
  createdAt: Date;
}

// ============================================
// Chat Types
// ============================================

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
}

export interface SurveyChatHistory {
  id: string;
  surveyId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  sessionId?: string;
}

export interface UpdateSurveyRequest {
  title?: string;
  description?: string;
  accessType?: SurveyAccessType;
  settings?: SurveySettings;
}

export interface CreateSectionRequest {
  surveyId: string;
  title: string;
  description?: string;
  order?: number;
}

export interface UpdateSectionRequest {
  title?: string;
  description?: string;
  order?: number;
}

export interface CreateQuestionRequest {
  sectionId: string;
  type: QuestionType;
  text: string;
  description?: string;
  order?: number;
  settings?: QuestionSettings;
}

export interface UpdateQuestionRequest {
  type?: QuestionType;
  text?: string;
  description?: string;
  order?: number;
  settings?: QuestionSettings;
  skipLogic?: SkipLogic;
}

export interface ReorderItem {
  id: string;
  order: number;
}

export interface ReorderRequest {
  sections?: ReorderItem[];
  questions?: ReorderItem[];
}

export interface SubmitAnswerRequest {
  questionId: string;
  answerType: AnswerType;
  choiceIds?: string[];
  textValue?: string;
  voiceUrl?: string;
  transcript?: string;
}

// ============================================
// Full Survey with Relations (for builder)
// ============================================

export interface SurveyQuestionWithSection extends SurveyQuestion {
  sectionTitle: string;
}

export interface SurveySectionWithQuestions extends SurveySection {
  questions: SurveyQuestion[];
}

export interface SurveyWithSections extends Survey {
  sections: SurveySectionWithQuestions[];
}

// ============================================
// Type Guards
// ============================================

export function isMultipleChoiceSettings(
  settings: QuestionSettings | undefined
): settings is MultipleChoiceSettings {
  if (!settings) return false;
  return "selectionMode" in settings && "options" in settings;
}

export function isOpenEndedSettings(
  settings: QuestionSettings | undefined
): settings is OpenEndedSettings {
  if (!settings) return false;
  return "followUpMode" in settings && "preferredInput" in settings;
}

export function isStatementSettings(
  settings: QuestionSettings | undefined
): settings is StatementSettings {
  if (!settings) return false;
  return "continueButtonText" in settings;
}

// ============================================
// Default Values
// ============================================

export const defaultMultipleChoiceSettings: MultipleChoiceSettings = {
  selectionMode: "single",
  options: [
    { id: crypto.randomUUID(), text: "Option 1", isOther: false },
    { id: crypto.randomUUID(), text: "Option 2", isOther: false },
  ],
  allowOther: false,
  randomizeOrder: false,
};

export const defaultOpenEndedSettings: OpenEndedSettings = {
  allowVoice: true,
  allowText: true,
  followUpMode: "none",
  preferredInput: "voice",
};

export const defaultStatementSettings: StatementSettings = {
  continueButtonText: "Continue",
};

export const defaultSurveySettings: SurveySettings = {
  welcome: {
    title: "Welcome to this interview",
    message: "Thank you for participating. Please share your honest thoughts.",
    showConsentCheckbox: false,
  },
  showProgressBar: true,
  allowSkipQuestions: true,
};

export function getDefaultSettingsForType(type: QuestionType): QuestionSettings {
  switch (type) {
    case "multiple_choice":
      return { ...defaultMultipleChoiceSettings };
    case "open_ended":
      return { ...defaultOpenEndedSettings };
    case "statement":
      return { ...defaultStatementSettings };
  }
}
