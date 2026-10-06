import { describe, expect, test } from "bun:test";

import {
  authLinkSearch,
  pickAuthSearch,
  postSignInPath,
  signInRedirect,
  socialSignInTargets,
} from "./auth-search";

describe("pickAuthSearch", () => {
  test("keeps only known non-empty string params", () => {
    expect(pickAuthSearch({ redirect: "/account/profile", foo: "x", token: 3 })).toEqual({
      redirect: "/account/profile",
    });
  });

  test("drops empty, non-string and legacy invitation values", () => {
    expect(pickAuthSearch({ redirect: "", invitationId: "inv_1" })).toEqual({});
    expect(pickAuthSearch({ redirect: 4 })).toEqual({});
    expect(pickAuthSearch(undefined)).toEqual({});
  });
});

describe("signInRedirect (/login and guard redirects)", () => {
  test("targets /sign-in and preserves redirect", () => {
    expect(signInRedirect({ redirect: "/today" })).toEqual({
      to: "/sign-in",
      search: { redirect: "/today" },
    });
  });

  test("works without search params", () => {
    expect(signInRedirect()).toEqual({ to: "/sign-in", search: {} });
  });
});

describe("authLinkSearch (sign-in <-> sign-up links)", () => {
  test("carries the params over", () => {
    expect(authLinkSearch({ redirect: "/today" })).toEqual({ redirect: "/today" });
  });
});

describe("postSignInPath", () => {
  test("always lands on Today", () => {
    expect(postSignInPath()).toBe("/today");
  });
});

describe("socialSignInTargets", () => {
  test("success lands on Today and errors return to the originating page", () => {
    expect(socialSignInTargets({ origin: "http://app", errorPath: "/sign-in" })).toEqual({
      callbackURL: "http://app/today",
      errorCallbackURL: "http://app/sign-in",
    });
  });
});
