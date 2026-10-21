import { ALL_BARANGAYS } from "../data/scheduleModel.js";

export default function BarangayFilter({ barangays, value, onChange, scope = "calendar" }) {
  const isCellScope = scope === "cell";
  return (
    <div className="filter-control">
      <label htmlFor="barangay-filter">{isCellScope ? "Barangay in this day" : "Barangay"}</label>
      <select
        id="barangay-filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={ALL_BARANGAYS}>{isCellScope ? "All in this day" : "All barangays"}</option>
        {barangays.map((barangay) => (
          <option key={barangay} value={barangay}>
            {barangay}
          </option>
        ))}
      </select>
    </div>
  );
}
