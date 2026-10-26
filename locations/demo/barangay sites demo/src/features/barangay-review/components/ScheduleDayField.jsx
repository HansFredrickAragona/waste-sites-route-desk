import { SCHEDULE_DAYS, scheduleDayCodes } from "../utils/pinFormHelpers.js";

export default function ScheduleDayField({ value, onChange }) {
  const selectedCodes = new Set(scheduleDayCodes(value));

  return (
    <fieldset className="field-label schedule-day-field">
      <legend>Days</legend>
      <div className="schedule-day-options">
        {SCHEDULE_DAYS.map((day) => (
          <label className={`schedule-day-option${selectedCodes.has(day.code) ? " schedule-day-option--selected" : ""}`} key={day.code}>
            <input
              type="checkbox"
              checked={selectedCodes.has(day.code)}
              aria-label={day.label}
              onChange={(event) => {
                const nextCodes = new Set(selectedCodes);
                if (event.target.checked) nextCodes.add(day.code);
                else nextCodes.delete(day.code);
                onChange(SCHEDULE_DAYS.filter(({ code }) => nextCodes.has(code)).map(({ label }) => label).join(", "));
              }}
            />
            <span aria-hidden="true">{day.shortLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
