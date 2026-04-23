// @ts-check

const UNIQUE_VIOLATION_CODE = "23505";
const ASSIGNMENT_UNIQUE_INDEX_NAMES = [
  "assignments_group_giver_unique",
  "assignments_group_receiver_unique",
];

/**
 * @param {{ code?: string | null; details?: string | null; message?: string | null }} error
 * @returns {boolean}
 */
export function isAssignmentAlreadyDrawnError(error) {
  if ((error.code || "").trim() === UNIQUE_VIOLATION_CODE) {
    return true;
  }

  const haystack = [error.message, error.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ASSIGNMENT_UNIQUE_INDEX_NAMES.some((indexName) =>
    haystack.includes(indexName.toLowerCase())
  );
}
