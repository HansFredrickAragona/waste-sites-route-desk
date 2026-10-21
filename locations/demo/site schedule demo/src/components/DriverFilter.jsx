export const ALL_DRIVERS = "__all_drivers__";

export default function DriverFilter({ drivers, value, onChange }) {
  return (
    <div className="filter-control">
      <label htmlFor="driver-filter">Driver</label>
      <select
        id="driver-filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={ALL_DRIVERS}>All drivers</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>{driver.name}</option>
        ))}
      </select>
    </div>
  );
}
