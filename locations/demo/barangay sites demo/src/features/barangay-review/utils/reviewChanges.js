export function summarizeReviewChanges(activityLog) {
  const categoryByAction = {
    "Added collection-site pin": "added",
    "Added firing line": "added",
    "Deleted collection-site pin": "removed",
    "Deleted firing line": "removed",
    "Updated collection-site pin": "edited",
    "Updated firing line": "edited",
    "Disconnected firing-line segment": "edited",
    "Updated barangay details": "edited",
    "Confirmed barangay information": "edited",
    "Reopened barangay review": "edited",
    "Updated confirmation contact": "edited",
  };
  const chronological = [...activityLog].reverse();
  const reversibleChanges = [];

  chronological.forEach((entry) => {
    if (entry.action?.startsWith("Undid: ")) {
      const undoneAction = entry.action.slice("Undid: ".length);
      for (let index = reversibleChanges.length - 1; index >= 0; index -= 1) {
        const candidate = reversibleChanges[index];
        if (candidate.action === undoneAction && candidate.itemName === entry.itemName && candidate.barangayId === entry.barangayId) {
          reversibleChanges.splice(index, 1);
          break;
        }
      }
      return;
    }
    if (categoryByAction[entry.action]) reversibleChanges.push(entry);
  });

  const finalChanges = new Map();
  reversibleChanges.forEach((entry) => {
    const operation = categoryByAction[entry.action];
    const itemKey = [entry.barangayId, entry.itemType, entry.itemName].join("|");
    const previous = finalChanges.get(itemKey);
    if (!previous) {
      finalChanges.set(itemKey, { ...entry, category: operation });
      return;
    }
    if (operation === "removed") {
      if (previous.category === "added") finalChanges.delete(itemKey);
      else finalChanges.set(itemKey, { ...entry, category: "removed" });
      return;
    }
    if (operation === "added" && previous.category === "removed") {
      finalChanges.set(itemKey, { ...entry, category: "edited" });
      return;
    }
    const category = previous.category === "added" ? "added" : "edited";
    finalChanges.set(itemKey, { ...entry, category });
  });

  return ["added", "removed", "edited"].reduce((summary, category) => {
    summary[category] = [...finalChanges.values()]
      .filter((entry) => entry.category === category)
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
    return summary;
  }, { added: [], removed: [], edited: [] });
}
