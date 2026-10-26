export default function ScheduleTimeRangeField({ value = {}, label, onChange }) {
  function update(field, nextValue) {
    onChange({ [field]: nextValue });
  }

  return (
    <div className="schedule-time-range">
      <span className="schedule-time-heading">Time (optional)</span>
      <div className="schedule-time-range-fields">
        <label className="field-label schedule-time-text-label">
          <span className="visually-hidden">{label} start time</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-label={`${label} start time`}
            placeholder="Start"
            value={value.startTime ?? ""}
            onChange={(event) => update("startTime", event.target.value)}
          />
        </label>
        <label className="field-label schedule-time-period-label">
          <span className="visually-hidden">{label} start AM or PM</span>
          <select aria-label={`${label} start AM or PM`} value={value.startPeriod ?? ""} onChange={(event) => update("startPeriod", event.target.value)}>
            <option value="">AM/PM</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <span className="schedule-time-separator" aria-hidden="true">to</span>
        <label className="field-label schedule-time-text-label">
          <span className="visually-hidden">{label} end time</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            aria-label={`${label} end time`}
            placeholder="End"
            value={value.endTime ?? ""}
            onChange={(event) => update("endTime", event.target.value)}
          />
        </label>
        <label className="field-label schedule-time-period-label">
          <span className="visually-hidden">{label} end AM or PM</span>
          <select aria-label={`${label} end AM or PM`} value={value.endPeriod ?? ""} onChange={(event) => update("endPeriod", event.target.value)}>
            <option value="">AM/PM</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
    </div>
  );
}
