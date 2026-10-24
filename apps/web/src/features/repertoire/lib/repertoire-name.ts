import { REPERTOIRE_NAME_MAX_LENGTH } from "@b2c-template/api/lib/repertoire-limits";

/** Why the name cannot be saved, or null when it can. */
export function validateRepertoireName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return "Enter a name.";
  }
  if (trimmed.length > REPERTOIRE_NAME_MAX_LENGTH) {
    return `The name must be ${REPERTOIRE_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}
