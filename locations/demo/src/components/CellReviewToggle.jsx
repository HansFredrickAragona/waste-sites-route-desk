export default function CellReviewToggle({ driverName, day, confirmed, onChange }) {
  return (
    <section className={`cell-review-panel${confirmed ? " cell-review-panel--confirmed" : ""}`} aria-label="Schedule cell confirmation">
      <div>
        <p className="eyebrow">Cell review</p>
        <h3>{driverName} · {day}</h3>
        <p>Mark this schedule cell confirmed after its areas and map details have been reviewed.</p>
      </div>
      <button
        type="button"
        className={`cell-review-switch${confirmed ? " cell-review-switch--on" : ""}`}
        role="switch"
        aria-checked={confirmed}
        aria-label={`Mark ${driverName} ${day} as ${confirmed ? "not confirmed" : "confirmed"}`}
        onClick={() => onChange(!confirmed)}
      >
        <span className="cell-review-switch-track" aria-hidden="true"><span /></span>
        <span>{confirmed ? "Confirmed" : "Not confirmed"}</span>
      </button>
    </section>
  );
}
