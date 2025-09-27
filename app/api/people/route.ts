import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 10;

const APOLLO_BASE = process.env.APOLLO_BASE ?? "https://api.apollo.io/api/v1";
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

interface SearchBody {
  title?: string;
  location?: string;
  industry?: string;
  limit?: number;
}

type ApolloSearchResponse = {
  people?: Array<{ id?: string; person_id?: string }>;
  matches?: Array<{ id?: string; person_id?: string }>;
};

type ApolloBulkResponse = {
  people?: Array<any>;
  matched_people?: Array<any>;
};

const toJsonSafely = async (res: Response) => {
  try {
    return await res.json();
  } catch (error) {
    return { error: "Failed to parse response" };
  }
};

const buildError = (status: number, step: string, error: unknown) =>
  NextResponse.json(
    {
      step,
      error:
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Request failed"
    },
    { status }
  );

const STATUS_FIELDS = [
  "email_status",
  "status"
];

const isVerifiedStatus = (value: unknown) =>
  typeof value === "string" && value.toLowerCase() === "verified";

const candidateHasVerifiedEmail = (candidate: any): boolean => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const directStatuses = STATUS_FIELDS.map((field) => candidate?.[field]);

  const nestedStatuses = [
    candidate?.person?.email_status,
    candidate?.person?.status,
    candidate?.email?.email_status,
    candidate?.email?.status
  ];

  const emailCollections = [candidate?.emails, candidate?.person?.emails].filter(Array.isArray) as Array<
    Array<any>
  >;

  const collectionStatuses = emailCollections.flat().map((item) => {
    if (!item || typeof item !== "object") {
      return undefined;
    }

    return STATUS_FIELDS.map((field) => item?.[field]);
  });

  return [
    ...directStatuses,
    ...nestedStatuses,
    ...collectionStatuses.flat()
  ].some(isVerifiedStatus);
};

const pickVerifiedCandidates = (payload: ApolloSearchResponse, limit: number) => {
  const collection = payload.people ?? payload.matches ?? [];

  const verifiedCandidates = collection.filter(candidateHasVerifiedEmail);

  if (!verifiedCandidates.length) {
    return [];
  }

  return verifiedCandidates.slice(0, limit);
};

const extractContacts = (payload: ApolloBulkResponse, limit: number) => {
  const entries = payload.people ?? payload.matched_people ?? [];

  const contacts = entries
    .map((entry) => {
      const person = entry.person ?? entry;
      const organization = person.organization ?? entry.organization ?? {};

      const emails: Array<any> = [
        ...(entry.emails ?? []),
        ...(person.emails ?? []),
        ...(Array.isArray(person.email_statuses) ? person.email_statuses : [])
      ];

      if (entry.email && entry.email_status) {
        emails.unshift({
          email: entry.email,
          email_status: entry.email_status
        });
      }

      const verifiedEmail = emails.find((item) => {
        const status = (item?.email_status ?? item?.status ?? "").toLowerCase();
        return status === "verified";
      });

      if (!verifiedEmail?.email) {
        return null;
      }

      const name = person.name ?? [person.first_name, person.last_name].filter(Boolean).join(" ");
      const title = person.title ?? person.headline;
      const company = organization.name ?? person.organization_name;
      const domain = organization.website_url ?? organization.domain ?? entry.organization_domain;
      const location = person.location ?? entry.location;
      const emailStatus = verifiedEmail.email_status ?? verifiedEmail.status ?? entry.email_status;

      return {
        name: name ?? "",
        title: title ?? "",
        email: verifiedEmail.email,
        company: company ?? "",
        domain: domain ?? "",
        location: location ?? "",
        email_status: emailStatus ?? ""
      };
    })
    .filter((value): value is {
      name: string;
      title: string;
      email: string;
      company: string;
      domain: string;
      location: string;
      email_status: string;
    } => Boolean(value));

  return contacts.slice(0, limit);
};

export async function POST(req: Request) {
  if (!APOLLO_API_KEY) {
    return buildError(500, "internal", "Apollo API key is not configured");
  }

  let body: SearchBody;

  try {
    body = await req.json();
  } catch (error) {
    return buildError(400, "validate", "Invalid JSON body");
  }

  const { title, location, industry } = body ?? {};
  let { limit } = body ?? {};

  if (!title || !location) {
    return buildError(400, "validate", "Both title and location are required");
  }

  limit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), DEFAULT_LIMIT);

  const searchPayload: Record<string, unknown> = {
    per_page: 25,
    person_titles: [title],
    person_locations: [location]
  };

  if (industry) {
    searchPayload.industries = [industry];
    searchPayload.q_organization_keywords = [industry];
  }

  let searchData: ApolloSearchResponse;

  try {
    const searchRes = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": APOLLO_API_KEY
      },
      body: JSON.stringify(searchPayload)
    });

    if (!searchRes.ok) {
      const errorPayload = await toJsonSafely(searchRes);
      return buildError(searchRes.status, "search", errorPayload);
    }

    searchData = await searchRes.json();
  } catch (error) {
    return buildError(502, "search", error);
  }

  const verifiedCandidates = pickVerifiedCandidates(searchData, limit);

  if (!verifiedCandidates.length) {
    return NextResponse.json({
      contacts: [],
      debug: {
        search: searchData,
        enrichment: null,
        selectedPersonIds: [],
        bulkDetails: []
      }
    });
  }

  const selectedIds = verifiedCandidates
    .map((candidate) => candidate?.id ?? candidate?.person_id)
    .filter((value): value is string => Boolean(value));

  const details = verifiedCandidates.map((candidate) => {
    const person = candidate?.person ?? candidate ?? {};

    const detail: Record<string, unknown> = {
      first_name: person.first_name,
      last_name: person.last_name,
      linkedin_url:
        person.linkedin_url ?? person.linked_in_url ?? person.linkedin ?? person.linkedin_profile_url ?? null
    };

    Object.keys(detail).forEach((key) => {
      if (detail[key] == null || detail[key] === "") {
        delete detail[key];
      }
    });

    return detail;
  });

  let bulkData: ApolloBulkResponse;

  try {
    const bulkRes = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": APOLLO_API_KEY
      },
      body: JSON.stringify({
        details,
        reveal_personal_emails: false,
        reveal_work_emails: true
      })
    });

    if (!bulkRes.ok) {
      const errorPayload = await toJsonSafely(bulkRes);
      return buildError(bulkRes.status, "enrich", errorPayload);
    }

    bulkData = await bulkRes.json();
  } catch (error) {
    return buildError(502, "enrich", error);
  }

  const contacts = extractContacts(bulkData, limit);

  return NextResponse.json({
    contacts,
    debug: {
      search: searchData,
      enrichment: bulkData,
      selectedPersonIds: selectedIds,
      bulkDetails: details
    }
  });
}
