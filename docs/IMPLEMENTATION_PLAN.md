# Survey Feature Implementation Plan

## Phase 1: Database Schema & Types (Foundation)
**Files to create/modify:**
- `src/db/schema.ts` - Add new tables
- `src/types/surveyBuilder.ts` - TypeScript types for surveys

**Tables:**
- surveys
- survey_sections
- survey_questions
- survey_responses
- survey_answers
- survey_followups
- survey_chat_history

---

## Phase 2: API Endpoints (CRUD)
**Files to create:**
- `src/pages/api/surveys/index.ts` - List/Create surveys
- `src/pages/api/surveys/[id]/index.ts` - Get/Update survey
- `src/pages/api/surveys/[id]/publish.ts` - Publish survey
- `src/pages/api/surveys/[id]/sections.ts` - CRUD sections
- `src/pages/api/surveys/[id]/questions.ts` - CRUD questions
- `src/pages/api/surveys/[id]/reorder.ts` - Reorder items

---

## Phase 3: Survey Builder UI
**Files to create:**
- `src/pages/surveys/index.tsx` - Survey list
- `src/pages/surveys/[id]/edit.tsx` - Survey builder
- `src/components/SurveyBuilder/index.tsx` - Main builder
- `src/components/SurveyBuilder/QuestionBlock.tsx` - Draggable question
- `src/components/SurveyBuilder/SectionBlock.tsx` - Section container
- `src/components/SurveyBuilder/QuestionEditor.tsx` - Question edit panel
- `src/components/SurveyBuilder/PreviewPane.tsx` - Live preview
- `src/components/SurveyBuilder/WelcomeEditor.tsx` - Welcome screen

**Dependencies:** @dnd-kit/core, @dnd-kit/sortable

---

## Phase 4: AI Chat for Survey Creation
**Files to create:**
- `src/pages/surveys/new.tsx` - Create survey with AI
- `src/pages/api/surveys/[id]/chat.ts` - AI chat endpoint
- `src/components/SurveyChat/ChatWindow.tsx` - Chat messages
- `src/components/SurveyChat/ChatInput.tsx` - Message input
- `src/lib/prompts/surveyGeneration.ts` - AI prompts

---

## Phase 5: Survey Taking Experience
**Files to create:**
- `src/pages/surveys/[id]/take.tsx` - Respondent view
- `src/pages/api/surveys/[id]/take.ts` - Public survey data
- `src/pages/api/surveys/[id]/responses/index.ts` - Start response
- `src/pages/api/surveys/[id]/responses/[responseId]/answers.ts` - Submit answer
- `src/components/SurveyTake/QuestionDisplay.tsx` - Render questions
- `src/components/SurveyTake/MultipleChoiceInput.tsx` - MC options
- `src/components/SurveyTake/ProgressBar.tsx` - Progress indicator

---

## Phase 6: Voice Recording & Transcription
**Files to create:**
- `src/components/SurveyTake/VoiceRecorder.tsx` - Recording UI
- `src/components/ui/Waveform.tsx` - Audio visualization
- `src/pages/api/upload-voice.ts` - Upload audio
- `src/pages/api/transcribe.ts` - Whisper transcription
- `src/lib/audioUtils.ts` - Audio helpers

**Dependencies:** Web Audio API, OpenAI Whisper

---

## Phase 7: AI Follow-up Generation
**Files to create:**
- `src/pages/api/surveys/[id]/generate-followup.ts` - Generate follow-up
- `src/components/SurveyTake/FollowupChat.tsx` - Follow-up display
- `src/lib/prompts/followupGeneration.ts` - Follow-up prompts

---

## Implementation Order
1. ✅ Schema + Types (foundation for everything)
2. API endpoints (needed for UI)
3. Builder UI (core feature)
4. AI Chat (enhances creation)
5. Taking experience (respondent flow)
6. Voice recording (key differentiator)
7. Follow-ups (polish)

## Commands to Run
```bash
# After schema changes
npx drizzle-kit generate
npx drizzle-kit push

# Install new dependencies (Phase 3)
npm install @dnd-kit/core @dnd-kit/sortable
```
