// Violation: web must not import server-only packages.
import db from "@b2c-template/db/schema";

export const value = db;
