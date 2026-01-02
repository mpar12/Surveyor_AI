# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SurvAgent (Surveyor) is an AI-powered customer research platform that conducts voice interviews at scale using ElevenLabs Conversational AI and analyzes transcripts using Claude. Users create research briefs, Claude generates interview questions, voice AI conducts interviews, and Claude analyzes the results.

## Commands

```bash
npm run dev      # Start development server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```

### Database (Drizzle ORM with Vercel Postgres)

```bash
npx drizzle-kit generate    # Generate migration from schema changes
npx drizzle-kit push        # Push schema to database
npx drizzle-kit studio      # Open Drizzle Studio GUI
```

## Architecture

### Tech Stack
- Next.js 14 (Pages Router, not App Router)
- TypeScript with path alias `@/*` → `src/*`
- Drizzle ORM with PostgreSQL (Vercel Postgres)
- Tailwind CSS
- Anthropic Claude API for question generation and transcript analysis
- ElevenLabs Conversational AI for voice interviews

### Directory Structure
- `src/pages/` - Next.js pages and API routes
- `src/pages/api/` - Backend API endpoints
- `src/lib/prompts.ts` - **Critical file** containing AI system prompts for question generation and transcript analysis
- `src/db/schema.ts` - Database schema (uses custom PostgreSQL schema named "drizzle")
- `src/db/client.ts` - Database client singleton
- `src/types/` - TypeScript interfaces
- `src/components/` - React components
- `drizzle/` - SQL migration files

### Core Flow
1. **Research Brief** (`brief.tsx`) - User defines research objectives, target audience, company context
2. **Question Generation** (`/api/questions`) - Claude generates interview script from brief using `QUESTION_GENERATION_SYSTEM_PROMPT`
3. **Voice Interview** - ElevenLabs Conversational AI conducts interviews
4. **Webhook** (`/api/webhooks/elevenlabs`) - Receives completed transcripts
5. **Analysis** (`/api/takeaways`) - Claude analyzes transcripts using `TAKEAWAYS_SYSTEM_PROMPT`
6. **Scorecard** (`scorecard.tsx`) - Displays research findings

### Database Tables (in "drizzle" schema)
- `sessions` - Interview sessions with 4-digit PIN codes
- `session_contexts` - Research brief data (company, product, ICP, questions)
- `convai_transcripts` - ElevenLabs conversation transcripts and analysis
- `responses` - Survey response data
- `email_sends` - Email delivery records

### Key Types
- `InterviewScript` - Generated interview structure with sections and questions
- `SurveyContext` - Research brief context data

## Environment Variables

Required in `.env`:
- `POSTGRES_URL` - Vercel Postgres connection string
- `CLAUDE_API_KEY` or `claude_api_key` - Anthropic API key
- ElevenLabs configuration for voice AI

## Prompt Engineering

The AI prompts in `src/lib/prompts.ts` are extensively documented and follow specific patterns:
- Questions must sound conversational, not like surveys
- Analysis output must be JSON with bullet points, not paragraphs
- Both prompts emphasize behavioral questions over hypotheticals
