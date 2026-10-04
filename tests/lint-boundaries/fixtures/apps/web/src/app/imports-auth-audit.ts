// Violation: web must not import the auth server entrypoint.
import audit from "@b2c-template/auth/audit";

export const value = audit;
