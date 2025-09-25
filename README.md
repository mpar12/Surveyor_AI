# SurvAgent — AI Survey Conductor

A multi-step Next.js experience for orchestrating an AI-assisted survey workflow powered by the ElevenLabs Agent platform. This initial cut wires up the intake step of the four-page flow; subsequent iterations will flesh out the agent integration and follow-on pages.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000 in your browser to view the app.

## Current pages

- `/` – Intake form that captures your name, company, product, desired feedback, and key questions. All fields are required before you can continue.
- `/brief` – Placeholder for the upcoming survey brief confirmation step.
- `/agent` – Placeholder page to host the ElevenLabs Agent configuration.
- `/results` – Placeholder page that will surface survey insights.

## Next steps

- Wire the intake form data into persistent storage (context, API route, or backend) so downstream pages can access it.
- Connect the ElevenLabs Agent on the `/agent` page once credentials and API scaffolding are ready.
- Polish styling tokens and add responsiveness checks across the full flow.
