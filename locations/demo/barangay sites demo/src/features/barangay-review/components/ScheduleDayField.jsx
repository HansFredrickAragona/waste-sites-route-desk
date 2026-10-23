import { SCHEDULE_DAYS, scheduleDayCode } from "../utils/pinFormHelpers.js";

export default function ScheduleDayField({ value, onChange }) {
  const selectedCode = scheduleDayCode(value);
  const selectedDay = SCHEDULE_DAYS.find(({ code }) => code === selectedCode);

  return (
    <label className="field-label schedule-day-field">
      Day
      <span className="schedule-day-control">
        <select value={selectedCode} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select day</option>
          {SCHEDULE_DAYS.map((day) => <option key={day.code} value={day.code}>{day.label}</option>)}
        </select>
        <span className="schedule-day-selected" aria-hidden="true">{selectedDay?.shortLabel ?? "Select day"}</span>
      </span>
    </label>
  );
}
