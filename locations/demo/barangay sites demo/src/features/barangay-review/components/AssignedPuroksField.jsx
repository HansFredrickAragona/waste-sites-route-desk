import { addAssignedPuroks, normalizeAssignedPuroks } from "../../../shared/utils/purokAssignments.js";

export default function AssignedPuroksField({ barangayPuroks, lineDraft, setLineDraft }) {
  const selected = normalizeAssignedPuroks(lineDraft.puroks);
  const suggestions = normalizeAssignedPuroks(barangayPuroks).filter((name) =>
    !selected.some((assigned) => assigned.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US")));
  const optionsId = `line-purok-options-${lineDraft.id}`;

  function addPendingPuroks() {
    setLineDraft((current) => current ? ({
      ...current,
      puroks: addAssignedPuroks(current.puroks, current.purokInput, barangayPuroks),
      purokInput: "",
    }) : current);
  }

  function removePurok(name) {
    setLineDraft((current) => current ? ({
      ...current,
      puroks: normalizeAssignedPuroks(current.puroks).filter((purok) => purok !== name),
    }) : current);
  }

  return (
    <div className="line-purok-field">
      <label className="field-label" htmlFor={`line-purok-input-${lineDraft.id}`}>Assigned puroks</label>
      <div className="line-purok-entry">
        <input
          id={`line-purok-input-${lineDraft.id}`}
          list={optionsId}
          value={lineDraft.purokInput ?? ""}
          onChange={(event) => setLineDraft((current) => current ? ({ ...current, purokInput: event.target.value }) : current)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (lineDraft.purokInput?.trim()) addPendingPuroks();
          }}
          placeholder="Choose or type a purok"
        />
        <datalist id={optionsId}>{suggestions.map((name) => <option key={name} value={name} />)}</datalist>
        <button type="button" className="quiet-small-button" onClick={addPendingPuroks} disabled={!lineDraft.purokInput?.trim()}>Add purok</button>
      </div>
      {selected.length > 0 ? (
        <ul className="line-purok-list" aria-label="Assigned puroks">
          {selected.map((name) => (
            <li key={name}><span>{name}</span><button type="button" aria-label={`Remove ${name} from firing line`} onClick={() => removePurok(name)}>×</button></li>
          ))}
        </ul>
      ) : <small className="line-purok-empty">No puroks assigned yet. You can leave this blank.</small>}
    </div>
  );
}
