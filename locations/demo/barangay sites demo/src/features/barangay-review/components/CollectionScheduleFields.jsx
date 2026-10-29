import ScheduleDayField from "./ScheduleDayField.jsx";
import ScheduleTimeRangeField from "./ScheduleTimeRangeField.jsx";
import {
  addScheduleDay,
  removeScheduleDay,
  scheduleDayEntries,
  updateScheduleEntry,
} from "../utils/pinFormHelpers.js";

export default function CollectionScheduleFields({ schedule, onChange }) {
  function renderDays(kind, label) {
    const entries = scheduleDayEntries(schedule, kind);

    return (
      <>
        <div className="site-schedule-day-list">
          {entries.map((entry, index) => (
            <div className="site-schedule-day-row" key={`${kind}-${index}`}>
              <ScheduleDayField
                label={`${label} row ${index + 1}`}
                value={entry.day}
                onChange={(day) => onChange(updateScheduleEntry(schedule, kind, index, { day }))}
              />
              <ScheduleTimeRangeField
                label={`${label} row ${index + 1}`}
                value={entry}
                onChange={(fields) => onChange(updateScheduleEntry(schedule, kind, index, fields))}
              />
              {entries.length > 1 && (
                <button
                  className="schedule-remove-button schedule-remove-day-button"
                  type="button"
                  onClick={() => onChange(removeScheduleDay(schedule, kind, index))}
                  aria-label={`Remove ${label.toLowerCase()} day ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="small-action schedule-add-button schedule-add-day-button"
          type="button"
          aria-label={`Add ${label.toLowerCase()} day`}
          onClick={() => onChange(addScheduleDay(schedule, kind))}
        >
          ＋ Add day
        </button>
      </>
    );
  }

  return (
    <div className="site-schedule-pair">
      <fieldset className="site-schedule-group">
        <legend>Drop-off</legend>
        {renderDays("drop-off", "Drop-off")}
      </fieldset>
      <fieldset className="site-schedule-group">
        <legend>Pick-up</legend>
        {renderDays("pick-up", "Pick-up")}
      </fieldset>
    </div>
  );
}
