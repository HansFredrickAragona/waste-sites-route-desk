export function cellReviewKey(driverId, day) {
  return JSON.stringify([driverId, day]);
}

export function normalizeCellStatuses(statuses) {
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) return {};

  return Object.fromEntries(
    Object.entries(statuses).filter(([key, value]) => key.length > 0 && typeof value === "boolean"),
  );
}
