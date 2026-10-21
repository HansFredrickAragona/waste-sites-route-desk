export default function MapEditingTools({
  firingLines,
  undefinedFiringLines = [],
  showAreaSelectionHint = false,
  selectedFeatureId,
  editingFeatureId,
  selectedFeatureNode,
  isAddingFeatureNode,
  featureNodeDraft,
  onSelectFeature,
  onEditFeature,
  onAddNode,
  onFinishAddingNodes,
  onMapUndefinedRoute,
  onDeleteFeature,
}) {
  function handleFeatureDelete(feature) {
    const featureName = feature.name || (feature.feature_type === "bounded_area" ? "bounded area" : "firing line");
    if (window.confirm(`Delete ${featureName}?`)) onDeleteFeature(feature.id);
  }

  return (
    <section className="map-feature-list-panel" aria-labelledby="map-features-title">
      <div className="map-tool-heading">
        <div>
          <p className="eyebrow">Separate from collection pins</p>
          <h3 id="map-features-title">Firing lines and areas</h3>
        </div>
      </div>

      {firingLines.length > 0 && (
        <ul className="firing-feature-list" aria-label="Firing lines and bounded areas">
          {firingLines.map((feature, index) => {
            const isSelected = selectedFeatureId === feature.id;
            const isEditing = editingFeatureId === feature.id;
            const typeLabel = feature.feature_type === "bounded_area" ? "Bounded area" : "Firing line";
            const pointLabel = feature.feature_type === "firing_line" ? "pins" : "points";
            return (
              <li key={feature.id} className={isSelected ? "firing-feature firing-feature--selected" : "firing-feature"}>
                <button type="button" className="firing-feature-select" onClick={() => onSelectFeature(feature.id)}>
                  <span><strong>{feature.name || `${typeLabel} ${index + 1}`}</strong><small>{typeLabel} · {feature.coordinates?.length ?? 0} {pointLabel}</small></span>
                </button>
                <div className="firing-feature-actions">
                  <button type="button" className="quiet-small-button" onClick={() => onEditFeature(isEditing ? null : feature.id)}>
                    {isEditing ? "Done" : feature.feature_type === "firing_line" ? "Edit pins" : "Edit points"}
                  </button>
                  <button type="button" className="danger-text-button" onClick={() => handleFeatureDelete(feature)}>Delete</button>
                </div>
                {isEditing && feature.feature_type === "firing_line" && (
                  <div className="firing-feature-node-tools">
                    <button
                      type="button"
                      className={isAddingFeatureNode ? "tool-button tool-button--active" : "quiet-small-button"}
                      aria-pressed={isAddingFeatureNode}
                      onClick={() => onAddNode(feature.id)}
                    >
                      {isAddingFeatureNode ? "Cancel adding nodes" : "Add nodes"}
                    </button>
                    {isAddingFeatureNode && (
                      <>
                        <p className="tool-instruction" role="status">Click to add nodes extending from node {featureNodeDraft.startIndex + 1}. The preview follows your cursor. Double-click to finish.</p>
                        <button
                          type="button"
                          className="primary-small-button"
                          disabled={featureNodeDraft.points.length === 0}
                          onClick={onFinishAddingNodes}
                        >
                          Finish adding nodes
                        </button>
                      </>
                    )}
                    {selectedFeatureNode?.featureId === feature.id && !isAddingFeatureNode && (
                      <p className="tool-instruction" role="status">Node {selectedFeatureNode.pointIndex + 1} selected. Its details and delete option are shown above.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {undefinedFiringLines.length > 0 && (
        <ul className="firing-feature-list" aria-label="Firing lines and routes without coordinates">
          {undefinedFiringLines.map((feature) => {
            const isRoute = feature.kind === "route";
            const label = isRoute ? "Route segment undefined" : "Firing line undefined";
            const nodeCount = feature.coordinates?.length ?? 0;
            return (
              <li
                key={feature.id}
                className="firing-feature firing-feature--undefined"
                title={`${label}${feature.areaName ? ` · ${feature.areaName}` : ""} · ${nodeCount} map node${nodeCount === 1 ? "" : "s"}; at least two are needed.`}
                aria-label={`${feature.areaName ? `${feature.areaName}: ` : ""}${label}`}
              >
                <span className="firing-feature-undefined-icon" aria-hidden="true">!</span>
                <span className="firing-feature-undefined-label">
                  <strong>{label}</strong>
                  <small>{feature.areaName || "Area not provided"} · {nodeCount === 0 ? "no coordinates" : `${nodeCount} node${nodeCount === 1 ? "" : "s"} · needs at least two`}</small>
                </span>
                {isRoute && (
                  <div className="firing-feature-undefined-actions">
                    <button
                      type="button"
                      className="quiet-small-button"
                      aria-label={`Map route segment ${feature.name || feature.areaName || "without a name"}`}
                      onClick={() => onMapUndefinedRoute(feature)}
                    >
                      Map route
                    </button>
                    <button
                      type="button"
                      className="danger-text-button"
                      aria-label={`Delete route segment ${feature.name || feature.areaName || "without a name"}`}
                      onClick={() => handleFeatureDelete(feature)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showAreaSelectionHint && (
        <p className="tool-instruction">Select a barangay or area above to view records without coordinates.</p>
      )}
      {firingLines.length === 0 && undefinedFiringLines.length === 0 && !showAreaSelectionHint && (
        <p className="tool-instruction">No firing lines or bounded areas are saved for this driver and day.</p>
      )}
      {firingLines.some((feature) => feature.id === editingFeatureId && feature.feature_type === "firing_line") && (
        <p className="tool-instruction firing-feature-edit-note">{isAddingFeatureNode
          ? "Adding nodes is on. Click the map to place points, then double-click or use Finish adding nodes."
          : "Edit pins is on. Drag any blue pin on the map to move it; the location is saved to your local working copy."}</p>
      )}
    </section>
  );
}
