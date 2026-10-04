import { describe, expect, test } from "bun:test";

import { FEATURES_PATH, NO_FEATURES, fetchFeatureFlags, readFeatureFlags } from "./feature-flags";

const ALL_ON = {
  mistakes: true,
  repertoire: true,
  blindfold: true,
  progress: true,
  emailSignUp: true,
};

describe("readFeatureFlags", () => {
  test("accepts a complete flags object", () => {
    expect(readFeatureFlags(ALL_ON)).toEqual(ALL_ON);
  });

  test("rejects bodies that are not an object of booleans", () => {
    expect(readFeatureFlags(null)).toBeNull();
    expect(readFeatureFlags("mistakes")).toBeNull();
    expect(readFeatureFlags({ ...ALL_ON, blindfold: "yes" })).toBeNull();
  });

  test("rejects a body with a missing flag", () => {
    const { progress: _progress, ...rest } = ALL_ON;
    expect(readFeatureFlags(rest)).toBeNull();
  });
});

describe("NO_FEATURES", () => {
  test("hides every pillar and the email sign-up until the server answers", () => {
    expect(Object.values(NO_FEATURES).every((flag) => flag === false)).toBe(true);
  });
});

describe("fetchFeatureFlags", () => {
  test("requests the public features endpoint and returns the flags", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (input: URL | RequestInfo) => {
      urls.push(String(input));
      return Response.json(ALL_ON);
    }) as unknown as typeof fetch;
    expect(await fetchFeatureFlags("http://api.test", fetchImpl)).toEqual(ALL_ON);
    expect(urls).toEqual([`http://api.test${FEATURES_PATH}`]);
  });

  test("rejects on a non-2xx answer so the query retries instead of caching 'none'", async () => {
    const fetchImpl = (async () =>
      new Response("nope", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchFeatureFlags("http://api.test", fetchImpl)).rejects.toThrow("503");
  });

  test("rejects on a malformed body", async () => {
    const fetchImpl = (async () => Response.json({ mistakes: true })) as unknown as typeof fetch;
    await expect(fetchFeatureFlags("http://api.test", fetchImpl)).rejects.toThrow("malformed");
  });
});
