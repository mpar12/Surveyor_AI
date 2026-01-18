import type { NextApiHandler } from "next";
import { testApiHandler } from "next-test-api-route-handler";

type ApiCallOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string>;
};

export async function callApi<T>(
  handler: NextApiHandler,
  options: ApiCallOptions
): Promise<{ status: number; json: T | null }> {
  let result: { status: number; json: T | null } = { status: 0, json: null };
  const queryString = options.query ? `/?${new URLSearchParams(options.query).toString()}` : "/";

  await testApiHandler({
    pagesHandler: handler,
    url: queryString,
    test: async ({ fetch }) => {
      const res = await fetch({
        method: options.method,
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const text = await res.text();
      let json: T | null = null;
      if (text) {
        try {
          json = JSON.parse(text) as T;
        } catch (error) {
          json = null;
        }
      }

      result = { status: res.status, json };
    },
  });

  return result;
}
