/**
 * Splits a `feature:action` platform permission string (e.g. `"user:ban"`) into the shape
 * better-auth's `admin.hasPermission` expects. Throws on a malformed string, a programmer error.
 */
export function parsePlatformPermission(permission: string): { feature: string; action: string } {
  const parts = permission.split(":");
  const [feature, action] = parts;
  if (parts.length !== 2 || !feature || !action) {
    throw new Error(`Invalid permission "${permission}"`);
  }
  return { feature, action };
}
