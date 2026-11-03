import assignments from "./barangayClusters.json";
export const clusterNames = [...new Set(Object.values(assignments))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
// The draft CSV explicitly includes Upper Magsaysay under Magsaysay, Upper.
export function assignedCluster(name) {
  return assignments[name === "Upper Magsaysay" ? "Magsaysay, Upper" : name];
}
export function clusterName(name) { return assignedCluster(name) || "Bida Barangays"; }
export function clusterColor(cluster) {
  const index = clusterNames.indexOf(cluster);
  return index < 0 ? "#77818b" : `hsl(${Math.round(index * 137.508) % 360} 62% ${index % 2 ? 39 : 48}%)`;
}
