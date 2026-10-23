/** Same limit as the server: a name is 1 to 80 characters once trimmed. */
export const MAX_NAME_LENGTH = 80;

/** Why the name cannot be saved, or null when it can. */
export function validateRepertoireName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return "Enter a name.";
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `The name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}
