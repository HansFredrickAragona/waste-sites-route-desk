import { hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
import { clusterName, clusterColor } from "./clusterColors.js";

// Groups the loaded barangays by their draft proximity cluster and totals the
// site records in each. Cluster assignments stay draft/proximity groups; these
// numbers describe the records in the active JSON only.
export function buildClusterSummaries(barangays) {
  const groups = new Map();
  for (const barangay of barangays) {
    const name = clusterName(barangay.name);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(barangay);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      color: clusterColor(name),
      barangays: [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      barangayCount: items.length,
      siteCount: items.reduce((sum, item) => sum + item.pins.length, 0),
      mappedCount: items.reduce((sum, item) => sum + item.pins.filter(hasMapCoordinates).length, 0),
      confirmedCount: items.filter((item) => item.confirmed).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
