## TODO: Improvements needed --> CGPT questions suck

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


### Generate company and product descriptions

`POST /api/descriptions`

Request body:

```json
{
  "company": "Apple",
  "product": "iPhone 17"
}
```

Response body:

```json
{
  "companyDescription": "...exactly 50 words...",
  "productDescription": "...exactly 50 words..."
}
```

The route uses OpenAI's ChatGPT API (model `gpt-4o-mini`) to craft two separate 50-word descriptions.

### Generate tailored survey questions

`POST /api/questions`

Request body:

```json
{
  "company": "Apple",
  "product": "iPhone 17",
  "desiredIcp": "Product Manager",
  "desiredIcpIndustry": "Technology",
  "keyQuestions": "How do you evaluate emerging devices?"
}
```

Response body:

```json
{
  "questions": [
    "...10 tailored market-positioning survey prompts, including the submitter's key questions..."
  ]
}
```

This call instructs ChatGPT to deliver exactly ten questions that blend the supplied key questions with additional prompts aimed at the specified ICP and industry.

### Fetch verified contacts

`POST /api/people`

Request body:

```json
{
  "title": "Head of Product",
  "location": "California, US",
  "industry": "B2B SaaS"
}
```

Response body:

```json
{
  "contacts": [
    {
      "name": "Jane Doe",
      "title": "VP Product",
      "email": "jane.doe@company.com",
      "company": "Acme Co",
      "domain": "acme.com",
      "location": "San Francisco, CA",
      "email_status": "verified"
    }
  ]
}
```

Behind the scenes the API calls Apollo's Mixed People Search and Bulk Match endpoints and filters for verified emails (up to ten results).

## Current pages

- `/` – Intake form that captures your name, company, product, desired feedback, desired ICP, desired ICP industry, desired ICP region, and key questions. All fields are required before you can continue.
- `/brief` – Generates AI-backed product/company summaries plus a tailored question set prior to outreach.
- `/population` – Lets you choose between uploading a comma-separated email list (with validation) or requesting an automated prospect search.
- `/agent` – Placeholder page to host the ElevenLabs Agent configuration.
- `/assistant` – Fullscreen, audio-only ElevenLabs agent experience gated on explicit microphone consent.
- `/people-demo` – Simple client page to exercise the `/api/people` endpoint and review verified contacts.
- `/people-results` – Displays the most recent contact list generated from the population workflow.
- `/results` – Placeholder page that will surface survey insights.

## Next steps

- Wire the intake form data into persistent storage (context, API route, or backend) so downstream pages can access it.
- Connect the ElevenLabs Agent on the `/agent` page once credentials and API scaffolding are ready.
- Polish styling tokens and add responsiveness checks across the full flow.
