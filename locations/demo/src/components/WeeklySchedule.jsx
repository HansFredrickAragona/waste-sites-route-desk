import { DAYS, getAreasForCell } from "../data/scheduleModel.js";
import { cellReviewKey } from "../data/cellReview.js";
import { isQrtAreaName } from "../data/scheduleCellPresentation.js";
import { ALL_DRIVERS } from "./DriverFilter.jsx";
import ScheduleCell from "./ScheduleCell.jsx";

export default function WeeklySchedule({
  drivers,
  selectedDriverId = ALL_DRIVERS,
  cellStatuses = {},
  version = "v4",
  emptyCalendar = false,
  onSelectCell,
}) {
  const visibleDrivers = drivers
    .map((driver, driverIndex) => ({ driver, driverIndex }))
    .filter(({ driver }) => selectedDriverId === ALL_DRIVERS || driver.id === selectedDriverId);
  const hasQrtAssignments = drivers.some((driver) =>
    DAYS.some((day) => getAreasForCell(driver, day).some((area) =>
      isQrtAreaName(area.areaName || area.sourceAreaName || area.barangay),
    )),
  );

  return (
    <section className="schedule-panel schedule-panel--unboxed" aria-labelledby="schedule-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Weekly overview</p>
          <h2 id="schedule-title">Driver schedule</h2>
          {!emptyCalendar && (
            <p className="section-copy">
              Area names follow the cleaned driver schedule. Select a day to view its map; QRT assignments can reference areas assigned to other drivers.
            </p>
          )}
        </div>
        {!emptyCalendar && (
          <div className="schedule-key">
            <span className="schedule-key-item"><span className="key-dot" /> Assigned areas</span>
            {hasQrtAssignments && <span className="schedule-key-item"><span className="key-dot key-dot--qrt" /> QRT relief team</span>}
          </div>
        )}
      </div>

      {drivers.length === 0 && !emptyCalendar ? (
        <div className="empty-schedule" role="status">
          <span className="empty-icon" aria-hidden="true">↗</span>
          <h3>No driver records to display</h3>
          <p>The selected schedule JSON did not contain any readable driver records.</p>
        </div>
      ) : drivers.length > 0 && visibleDrivers.length === 0 ? (
        <div className="empty-schedule" role="status">
          <span className="empty-icon" aria-hidden="true">⌕</span>
          <h3>No scheduled rows for these filters</h3>
          <p>No driver matches the selected filter.</p>
        </div>
      ) : (
        <div className="table-scroll" role="region" aria-label="Weekly driver schedule" tabIndex={0}>
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="driver-heading" scope="col">Driver</th>
                {DAYS.map((day) => <th key={day} scope="col">{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {emptyCalendar && (
                <tr className="schedule-empty-calendar-row" aria-hidden="true">
                  <th className="driver-cell" scope="row" />
                  {DAYS.map((day) => <td key={day} />)}
                </tr>
              )}
              {visibleDrivers.map(({ driver, driverIndex }) => (
                <tr key={driver.id}>
                  <th className="driver-cell" scope="row">
                    <span className="driver-number">{String(driverIndex + 1).padStart(2, "0")}</span>
                    <span>{driver.name}</span>
                  </th>
                  {DAYS.map((day) => {
                    const areas = getAreasForCell(driver, day);
                    const areaNames = areas.length > 0
                      ? [...new Set(areas.map((area) => area.areaName).filter(Boolean))]
                      : [...new Set((driver.days[day] ?? []).map((entry) => entry.areaName).filter(Boolean))];
                    return (
                      <td key={day}>
                        <ScheduleCell
                          areas={areas}
                          areaNames={areaNames}
                          driverName={driver.name}
                          day={day}
                          confirmed={Boolean(cellStatuses[cellReviewKey(driver.id, day)])}
                          onSelect={() => onSelectCell({ driverId: driver.id, day })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!emptyCalendar && (
        <p className="table-footnote">
          {selectedDriverId !== ALL_DRIVERS
            ? `Showing ${visibleDrivers.length ? "the selected driver" : "no rows"} from ${version.toUpperCase()}.`
            : `Showing all ${drivers.length} driver records from the ${version.toUpperCase()} schedule.`}
        </p>
      )}
    </section>
  );
}
