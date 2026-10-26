const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutesAfterMidnight = index * 15;
  const hour24 = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")}`;
});

const EMPTY_RANGE = {
  start: { time: "", period: "" },
  end: { time: "", period: "" },
};

function parseTimeRange(value) {
  const times = [...String(value ?? "").matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A\.M\.?|P\.M\.?)?\b/gi)]
    .slice(0, 2)
    .map(([, rawHour, rawMinute = "00", rawPeriod = ""]) => {
      let hour = Number(rawHour);
      const minute = Number(rawMinute);
      let period = rawPeriod.toUpperCase().replaceAll(".", "").replace(/\s/g, "");

      if (hour < 0 || hour > 23 || minute > 59) return null;
      if (!period && hour === 0) {
        hour = 12;
        period = "AM";
      } else if (!period && hour > 12) {
        hour -= 12;
        period = "PM";
      }

      return {
        time: `${hour}:${String(minute).padStart(2, "0")}`,
        period,
      };
    })
    .filter(Boolean);

  if (!times.length) return EMPTY_RANGE;
  if (times.length > 1) {
    times[0].period ||= times[1].period;
    times[1].period ||= times[0].period;
  }

  return {
    start: times[0],
    end: times[1] ?? EMPTY_RANGE.end,
  };
}

function formatTimeRange(range) {
  const formatTime = ({ time, period }) => time ? `${time}${period ? ` ${period}` : ""}` : "";
  const start = formatTime(range.start);
  const end = formatTime(range.end);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function optionsIncludingCurrent(value) {
  return value && !TIME_OPTIONS.includes(value) ? [value, ...TIME_OPTIONS] : TIME_OPTIONS;
}

export default function ScheduleTimeRangeField({ value, label, onChange }) {
  const range = parseTimeRange(value);

  function update(endpoint, field, nextValue) {
    const nextRange = {
      start: { ...range.start },
      end: { ...range.end },
    };
    nextRange[endpoint][field] = nextValue;

    if (endpoint === "start" && field === "time" && !nextValue) {
      nextRange.start.period = "";
      nextRange.end = { ...EMPTY_RANGE.end };
    }

    onChange(formatTimeRange(nextRange));
  }

  return (
    <div className="schedule-time-range">
      <span className="schedule-time-heading">Time (optional)</span>
      <div className="schedule-time-range-fields">
        {[
          { key: "start", title: "Start" },
          { key: "end", title: "End" },
        ].map(({ key, title }) => (
          <div className="schedule-time-endpoint" key={key}>
            <span>{title}</span>
            <div className="schedule-time-pickers">
              <label className="field-label schedule-time-picker-label">
                <span className="visually-hidden">{label} {title.toLowerCase()} time</span>
                <select
                  aria-label={`${label} ${title.toLowerCase()} time`}
                  value={range[key].time}
                  disabled={key === "end" && !range.start.time}
                  onChange={(event) => update(key, "time", event.target.value)}
                >
                  <option value="">Choose time</option>
                  {optionsIncludingCurrent(range[key].time).map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </label>
              <label className="field-label schedule-time-picker-label">
                <span className="visually-hidden">{label} {title.toLowerCase()} AM or PM</span>
                <select
                  aria-label={`${label} ${title.toLowerCase()} AM or PM`}
                  value={range[key].period}
                  disabled={!range[key].time}
                  onChange={(event) => update(key, "period", event.target.value)}
                >
                  <option value="">AM/PM</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
