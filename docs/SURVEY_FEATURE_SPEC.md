# Survey Feature Spec - Listen Labs Style

## Overview
Build a new survey feature to replace ElevenLabs voice interviews. This feature includes an AI-powered survey creation flow, a drag-and-drop survey builder, and a respondent-facing survey experience with voice recording and AI-generated follow-up questions.

---

## 1. Architecture Overview

### Tech Stack
- **Frontend**: Next.js (Pages Router), React, Tailwind CSS, Framer Motion
- **Voice Recording**: Web Audio API (hybrid: local recording + streaming display)
- **Transcription**: OpenAI Whisper API (post-recording processing)
- **AI Follow-ups**: Claude API (real-time generation after each response)
- **Database**: Drizzle ORM with PostgreSQL (Vercel Postgres)
- **File Storage**: TBD (for audio recordings - likely Vercel Blob or S3)

---

## 2. Survey Creation ("Create" Section)

### Visual Reference
![AI Chat Create Section](images/Image%201.png)
*AI assistant chat interface with study guide form on the right*

![AI Chat with Interview Questions](images/Image%202.png)
*Chat interface showing generated interview questions preview*

### AI Chat Interface
- **Interaction Model**: Chat persists for refinement - user can continue conversation after initial generation
- **AI Behavior**: Generates full survey structure (sections, questions, settings) from conversation
- **AI Autonomy**: Configurable toggle between:
  - Direct modification: AI edits survey directly
  - Suggest-only: AI proposes changes, user approves

### Flow
1. User describes research goals in chat
2. AI asks clarifying questions about target audience, objectives
3. AI generates complete survey structure
4. User reviews in builder, can return to chat for refinements
5. Chat history persists with survey for context

---

## 3. Survey Builder ("Edit" Section)

### Visual Reference
![Survey Builder Split View](images/Image%203%20actual.png)
*Builder on left with sections/questions, live preview on right showing welcome screen*

![Builder with Multiple Sections](images/Image%204.png)
*Multiple sections (Subscription History, Cancellation Decision, Value & Alternatives) with MC question preview*

### UI Pattern
- **Layout**: Drag-and-drop blocks (similar to Notion/Typeform)
- **Preview**: Debounced real-time (updates after 500ms pause in editing)
- **Split View**: Builder on left, live preview on right
- **Navigation**: Create → Edit → Launch tabs

### Question Types

#### 1. Multiple Choice
![Multiple Choice Editor](images/Image%205.png)
*MC question editor with options, multi-select toggle, "Other" option, and randomize order*

Full flexibility with:
- Single select (radio buttons)
- Multi-select (checkboxes)
- "Other" option with text field
- Min/max selection limits (for multi-select)
- Randomize option order

#### 2. Open-Ended
![Open-Ended Editor](images/Image%206.png)
*Open-ended question with follow-up settings, preferred input type (voice), and follow-up guidelines*

- Voice input (primary, encouraged)
- Text input (fallback, always available)
- Configurable max duration per question (30s, 1min, 2min, 5min, etc.)
- Follow-up question settings:
  - None / If short answer / Always
  - Guidelines for follow-up questions

#### 3. Statement
![Statement Editor](images/Image%207.png)
*Statement question type with customizable continue button text*

- Info-only, no response captured
- User clicks "Continue" to proceed
- Customizable button text
- Use for instructions, context, consent text

### Organization
- Sections for grouping related questions
- Questions as draggable blocks within sections
- Drag handles for reordering
- "+ Add Question" and "+ Add Screening Section" buttons

### Branching Logic
- **Simple skip logic**: Questions can be skipped based on previous answers
- Example: If Q1 = "No", skip Q2 and go to Q3
- No complex conditional branching (keeps builder simple)

### Publishing & Versioning
- **Auto-save drafts**: Changes save automatically
- **Explicit publish**: "Review & Launch" button makes survey live
- **Versioning**: Published surveys can be edited, creating new versions
- **Response tagging**: Each response tagged with survey version
- **Draft preview warning**: "Showing Draft Preview - This is not the version currently shown to respondents"

### Templates
- **System templates**: Pre-built templates (NPS, CSAT, User Research, Product Feedback, etc.)
- Users can start from templates or blank survey
- No user-saved templates in v1

---

## 4. Survey Taking Experience

### Visual Reference - Multiple Choice
![MC Respondent View - Builder Preview](images/Image%209.png)
*Builder view showing MC question editing alongside styled preview*

![MC Respondent View - Full Page](images/Image%2010.png)
*Full respondent experience for multiple choice questions with styled option buttons*

### Visual Reference - Voice Recording
![Voice Recording Preview](images/Image%208.png)
*Voice recording interface with Start Recording button, Skip option, and keyboard toggle*

![Voice Recording Full Page](images/Image%2011.png)
*Full respondent view with voice recording UI, skip question, and text fallback toggle*

### Access Methods (per survey setting)
Survey creator chooses:
1. **Anonymous**: Public link, anyone can respond
2. **Unique links**: Generate unique URL per invitee, tracks who responded
3. **Email/code verification**: Respondent enters identifier before starting

### Input Modes
- **Primary**: Voice recording (encouraged)
- **Fallback**: Text input (always available for accessibility - keyboard icon toggle)
- Input mode follows "voice with text fallback" pattern
- AI generates follow-ups for BOTH voice and text responses (same treatment)

### Voice Recording UX
- **Visual feedback**: Live waveform visualization + elapsed time counter
- **Time limits**: Configurable per question by survey creator
- **Re-recording**: Unlimited re-records before submitting (only final saved)
- **Flow**: Record → Preview playback → Keep or Re-record → Submit
- **Skip option**: "Skip question" link available
- **Text fallback**: Keyboard icon to switch to text input

### AI Follow-up Questions
- **Timing**: Real-time generation (after each response, before next main question)
- **Presentation**: Conversational chat style (appears as natural follow-up message)
- **Flow**: Inline after each response
- **Context sent to Claude**: Current response + original question + survey context/goals
- **Triggered for**: Both voice and text responses
- **Configurable**: Per question - None / If short answer / Always

### Progress & Recovery
- **Progress bar**: Blue progress indicator at top of survey
- **Session-based only**: Progress maintained during browser session
- **No persistent recovery**: If browser closed, progress is lost
- **Estimated time**: Shows estimated completion time (e.g., "14-18 min")

### Navigation
- Previous/Next arrows at bottom of survey
- "runs on listen labs" branding

---

## 5. Database Schema (New Tables)

### surveys
```sql
id: uuid (PK)
session_id: uuid (FK to sessions)
title: text
description: text
status: enum (draft, published)
version: integer
access_type: enum (anonymous, unique_links, verified)
settings: jsonb (global survey settings)
created_at: timestamp
updated_at: timestamp
published_at: timestamp
```

### survey_sections
```sql
id: uuid (PK)
survey_id: uuid (FK)
title: text
description: text
order: integer
created_at: timestamp
```

### survey_questions
```sql
id: uuid (PK)
section_id: uuid (FK)
type: enum (multiple_choice, open_ended, statement)
text: text
description: text (optional helper text)
order: integer
settings: jsonb (type-specific settings)
skip_logic: jsonb (conditions for skipping)
created_at: timestamp
```

### survey_question_settings JSONB structure:
```typescript
// Multiple choice
{
  selection_mode: 'single' | 'multiple',
  options: Array<{ id: string, text: string, is_other: boolean }>,
  min_selections?: number,
  max_selections?: number,
  allow_other: boolean,
  randomize_order: boolean
}

// Open-ended
{
  allow_voice: boolean,
  allow_text: boolean,
  max_duration_seconds?: number,
  follow_up_mode: 'none' | 'if_short' | 'always',
  follow_up_guidelines?: string,
  preferred_input: 'voice' | 'text'
}

// Statement
{
  continue_button_text: string  // default: "Continue"
}
```

### survey_responses
```sql
id: uuid (PK)
survey_id: uuid (FK)
survey_version: integer
respondent_id: text (nullable, for unique links)
respondent_email: text (nullable, for verified)
started_at: timestamp
completed_at: timestamp
status: enum (in_progress, completed, abandoned)
```

### survey_answers
```sql
id: uuid (PK)
response_id: uuid (FK)
question_id: uuid (FK)
answer_type: enum (choice, text, voice)
choice_ids: text[] (for MC)
text_value: text (for text responses)
voice_url: text (for voice recordings)
transcript: text (whisper transcription)
created_at: timestamp
```

### survey_followups
```sql
id: uuid (PK)
answer_id: uuid (FK)
question_text: text (AI-generated follow-up)
answer_type: enum (text, voice)
text_value: text
voice_url: text
transcript: text
created_at: timestamp
```

### survey_chat_history
```sql
id: uuid (PK)
survey_id: uuid (FK)
messages: jsonb (array of chat messages)
created_at: timestamp
updated_at: timestamp
```

---

## 6. API Endpoints

### Survey Management
- `POST /api/surveys` - Create new survey
- `GET /api/surveys/[id]` - Get survey details
- `PUT /api/surveys/[id]` - Update survey
- `POST /api/surveys/[id]/publish` - Publish survey (creates new version)
- `GET /api/surveys/[id]/versions` - List survey versions

### Survey Builder
- `POST /api/surveys/[id]/sections` - Add section
- `PUT /api/surveys/[id]/sections/[sectionId]` - Update section
- `DELETE /api/surveys/[id]/sections/[sectionId]` - Delete section
- `POST /api/surveys/[id]/questions` - Add question
- `PUT /api/surveys/[id]/questions/[questionId]` - Update question
- `DELETE /api/surveys/[id]/questions/[questionId]` - Delete question
- `PUT /api/surveys/[id]/reorder` - Reorder sections/questions

### AI Generation
- `POST /api/surveys/[id]/chat` - Send message to AI, get response + survey updates
- `POST /api/surveys/[id]/generate-followup` - Generate follow-up for a response

### Survey Taking
- `GET /api/surveys/[id]/take` - Get survey for respondent (public)
- `POST /api/surveys/[id]/responses` - Start new response session
- `POST /api/surveys/[id]/responses/[responseId]/answers` - Submit answer
- `POST /api/surveys/[id]/responses/[responseId]/complete` - Mark complete

### Voice Handling
- `POST /api/upload-voice` - Upload voice recording, returns URL
- `POST /api/transcribe` - Transcribe audio with Whisper

---

## 7. Key Pages

### /surveys (Survey List)
- List all surveys for user
- Status badges (draft, published)
- Quick actions (edit, view responses, duplicate)

### /surveys/new (Create Survey)
- AI chat interface
- "Generate Survey" action
- Redirect to builder after generation

### /surveys/[id]/edit (Survey Builder)
- Split view: builder left, preview right
- Drag-and-drop question blocks
- Section management
- Settings panel (access type, etc.)
- Chat refinement sidebar (collapsible)
- Create → Edit → Launch navigation tabs

### /surveys/[id]/take (Respondent View)
- Clean, focused survey-taking experience
- Progress indicator (blue bar)
- Voice recording UI with waveform
- Text fallback toggle (keyboard icon)
- Follow-up questions in chat style
- Previous/Next navigation

### /surveys/[id]/responses (Response List - Basic)
- List of responses with status
- Basic completion stats
- Export functionality
- (Full analytics in separate spec)

---

## 8. Component Structure

### New Components Needed
- `SurveyBuilder/` - Main builder interface
  - `QuestionBlock.tsx` - Draggable question component
  - `SectionBlock.tsx` - Section container
  - `QuestionEditor.tsx` - Edit question modal/panel
  - `PreviewPane.tsx` - Live preview
  - `SkipLogicEditor.tsx` - Simple skip logic UI
  - `WelcomeScreenEditor.tsx` - Welcome message configuration
- `SurveyChat/` - AI chat interface
  - `ChatWindow.tsx` - Chat messages with suggestions
  - `ChatInput.tsx` - Message input
  - `SuggestionChips.tsx` - Quick action suggestions
- `SurveyTake/` - Respondent experience
  - `QuestionDisplay.tsx` - Render question by type
  - `VoiceRecorder.tsx` - Waveform + controls
  - `FollowupChat.tsx` - Follow-up conversation
  - `ProgressBar.tsx` - Survey progress (blue bar)
  - `MultipleChoiceInput.tsx` - Styled option buttons
  - `NavigationControls.tsx` - Prev/Next arrows
- `ui/` additions
  - `DragHandle.tsx` - Drag indicator
  - `Waveform.tsx` - Audio visualization

---

## 9. External Integrations

### OpenAI Whisper
- Endpoint: `https://api.openai.com/v1/audio/transcriptions`
- Model: `whisper-1`
- Format: Send audio file after recording completes
- Cost: ~$0.006/minute

### Claude API (Follow-ups)
- Model: `claude-3-5-sonnet` or `claude-3-haiku` for speed
- Prompt template for follow-up generation:
```
You are conducting a research interview. Based on the participant's response, generate a natural follow-up question to dig deeper.

Original question: {question_text}
Survey context: {survey_description}
Participant response: {transcript}
Follow-up guidelines: {follow_up_guidelines}

Generate ONE conversational follow-up question. Be curious and specific to what they said.
```

---

## 10. Migration from ElevenLabs

### What Changes
- Replace ElevenLabs Conversational AI with custom voice recording
- Survey questions defined in builder (not generated from brief)
- Follow-ups generated by Claude (not real-time voice AI)

### What Stays Similar
- Session-based structure
- Research brief as starting point
- Transcript storage and analysis
- PIN-based access for researchers

### Data Migration
- Existing `convai_transcripts` table remains for old data
- New surveys use new schema
- No migration of old interviews to new format

---

## 11. Out of Scope (Separate Specs)

- Response analytics and AI insights
- Advanced conditional branching
- User-saved question templates
- Media uploads (images, files)
- Persistent progress recovery
- Multi-language support

---

## 12. Verification Plan

After implementation:
1. Create a survey via AI chat, verify structure generated
2. Edit survey in builder, verify drag-drop and preview work
3. Publish survey, verify versioning
4. Take survey with voice, verify recording and transcription
5. Verify follow-up questions generate correctly
6. Test text fallback flow
7. Export responses, verify data structure

---

## Summary of Key Decisions

| Decision | Choice |
|----------|--------|
| Voice capture | Hybrid (local + streaming display) |
| Transcription | OpenAI Whisper |
| Follow-up timing | Real-time after each response |
| AI autonomy | Configurable (edit vs suggest) |
| Builder UX | Drag-and-drop blocks |
| Preview | Debounced real-time |
| Branching | Simple skip logic |
| Input modes | Voice primary, text fallback |
| Recording UI | Waveform + timer |
| Time limits | Configurable per question |
| Re-recording | Unlimited |
| Follow-up UX | Conversational chat style |
| Access | Flexible per survey |
| Progress | Session-based only |
| Publishing | Versioning with live editing |
| AI creation | Full structure generation |
| Templates | System templates only |
| MC options | Full flexibility |
| Statements | Info-only |
| Text follow-ups | Same treatment as voice |
| Media | Voice and text only |
| Timeline | Complete feature (1-2 months) |
