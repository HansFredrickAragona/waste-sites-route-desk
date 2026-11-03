// Convex hull of recorded coordinates; never an administrative boundary.
export function siteCoverage(points) {
  const sorted = [...new Map(points.map(point => [point.join(","), point])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return [];
  const cross = (a, b, c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  function half(items) {
    const result = [];
    for (const point of items) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  }
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  return hull.length >= 3 ? hull : [];
}
