import { SCHEDULE_DAYS } from "../utils/pinFormHelpers.js";

export default function ScheduleDayField({ value, onChange, label }) {
  const dayValue = String(value ?? "");
  const knownDay = SCHEDULE_DAYS.some((day) => day.label === dayValue);

  return (
    <label className="field-label schedule-day-picker">
      <span>Day</span>
      <select aria-label={`${label} day`} value={dayValue} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a day</option>
        {!knownDay && dayValue && <option value={dayValue}>{dayValue}</option>}
        {SCHEDULE_DAYS.map((day) => <option key={day.code} value={day.label}>{day.label}</option>)}
      </select>
    </label>
  );
}
