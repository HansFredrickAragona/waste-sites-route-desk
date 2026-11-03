export function normalizeAssignedPuroks(value) {
  const names = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set();
  return names.filter((name) => typeof name === "string").map((name) => name.trim()).filter((name) => {
    const key = name.toLocaleLowerCase("en-US");
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function addAssignedPuroks(current, input, suggestions = []) {
  const known = new Map(normalizeAssignedPuroks(suggestions).map((name) => [name.toLocaleLowerCase("en-US"), name]));
  const name = String(input ?? "").trim();
  return normalizeAssignedPuroks([
    ...normalizeAssignedPuroks(current),
    known.get(name.toLocaleLowerCase("en-US")) ?? name,
  ]);
}
