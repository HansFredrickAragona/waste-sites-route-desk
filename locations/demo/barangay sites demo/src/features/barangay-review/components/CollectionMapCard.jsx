import { BarangayMap, MapModeNotice } from "./MapView.jsx";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

export default function CollectionMapCard({ data, ui, actions, refs }) {
  const { selectedBarangay, mapFilteredPins, mappedSiteCount, unlocatedSiteCount, removedSiteCount, selectedPinHasMapCoordinates, selectedPinForMap, mapPinPoints } = data;
  const { mode, linePoints, selectedLineNodeIndex, mapFocus, mapView, deviceLocation, selectedPinId, selectedLineId, pinDraft, lineDraft, isLocatingCurrentPosition, mapPurokFilter, mapSiteStatusFilter } = ui;
  const { finishLineNodePlacement, cancelMapMode, finishLineDrawing, handleMapClick, selectPin, selectLine, selectLineNode, setUndoCount, recenterOnCurrentLocation, setMapFocus, setMapView, setPinDraft, updateLineNodePosition, deleteSelectedLineNode, disconnectFiringLine, requestDelete } = actions;
  const { pinDragStartRef, pinMoveUndoRef, reviewUndoRef, lineDraftUndoRef } = refs;
  return (
            <section className="map-card" aria-label={`${selectedBarangay.name} collection-site map`}>
              <div className="map-card-heading"><div><h2>Collection map</h2></div><span className="map-count-card"><strong className="map-count-number">{formatNumber(mappedSiteCount)}</strong> mapped{mapPurokFilter !== "all" || mapSiteStatusFilter !== "all" ? " shown" : ""}</span></div>
              <MapModeNotice
                mode={mode}
                linePointCount={linePoints.length}
                selectedLineNodeIndex={selectedLineNodeIndex}
                onCancel={mode === "add-line-node" ? finishLineNodePlacement : cancelMapMode}
                onFinish={finishLineDrawing}
                onFinishNodePlacement={finishLineNodePlacement}
              />
              <div className={`map-frame barangay-map-frame${mode !== "browse" ? " barangay-map-frame--active-tool" : ""}`}>
                <BarangayMap
                  key={selectedBarangay.id}
                  barangay={selectedBarangay}
                  mapPins={mapFilteredPins}
                  focus={mapFocus}
                  mapView={mapView}
                  deviceLocation={deviceLocation}
                  mode={mode}
                  selectedPinId={selectedPinId}
                  selectedLineId={selectedLineId}
                  selectedLineNodeIndex={selectedLineNodeIndex}
                  pinDraft={pinDraft}
                  lineDraft={lineDraft}
                  linePoints={linePoints}
                  onMapClick={handleMapClick}
                  onFinishLine={finishLineDrawing}
                  onMapViewChange={setMapView}
                  onSelectPin={selectPin}
                  onSelectLine={selectLine}
                  onSelectLineNode={selectLineNode}
                  onPinDragStart={(pinId) => {
                    if (pinDraft?.id !== pinId) return;
                    pinDragStartRef.current = {
                      pinId,
                      latitude: Number(pinDraft.latitude),
                      longitude: Number(pinDraft.longitude),
                    };
                  }}
                  onPinDrag={(latitude, longitude) => setPinDraft((current) => current ? ({ ...current, latitude, longitude }) : current)}
                  onPinDragEnd={(pinId, latitude, longitude) => {
                    const previous = pinDragStartRef.current;
                    pinDragStartRef.current = null;
                    if (!previous || previous.pinId !== pinId) return;
                    const moved = Math.abs(previous.latitude - latitude) > 0.0000001 || Math.abs(previous.longitude - longitude) > 0.0000001;
                    if (!moved) return;
                    pinMoveUndoRef.current.push({
                      pinId,
                      latitude: previous.latitude,
                      longitude: previous.longitude,
                    });
                    if (pinMoveUndoRef.current.length > 100) pinMoveUndoRef.current.shift();
                    setUndoCount(reviewUndoRef.current.length + pinMoveUndoRef.current.length + lineDraftUndoRef.current.length);
                  }}
                  onLineVertexDrag={(pointIndex, nextPoint) => updateLineNodePosition(pointIndex, nextPoint[0], nextPoint[1])}
                  onDeleteLineNode={deleteSelectedLineNode}
                  onDisconnectLine={disconnectFiringLine}
                  onRemoveLine={() => {
                    if (!lineDraft) return;
                    if (lineDraft.isNew) cancelMapMode();
                    else requestDelete("line", lineDraft);
                  }}
                />
                <button
                  className={`map-recenter-button${isLocatingCurrentPosition ? " map-recenter-button--loading" : ""}`}
                  type="button"
                  onClick={recenterOnCurrentLocation}
                  disabled={isLocatingCurrentPosition}
                  aria-label="Recenter map on my current location"
                  aria-busy={isLocatingCurrentPosition}
                  title="Recenter on my current location"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="5.25" />
                    <circle className="map-recenter-dot" cx="12" cy="12" r="1.5" />
                    <path d="M12 2.75v3.1M12 18.15v3.1M2.75 12h3.1M18.15 12h3.1" />
                  </svg>
                </button>
                <button
                  className="map-recenter-button map-recenter-button--pin"
                  type="button"
                  disabled={!selectedPinHasMapCoordinates && mapPinPoints.length === 0}
                  onClick={() => {
                    if (selectedPinHasMapCoordinates) {
                      setMapFocus({ type: "point", point: [Number(selectedPinForMap.latitude), Number(selectedPinForMap.longitude)], zoom: 19 });
                    } else {
                      setMapFocus({ type: "bounds", points: mapPinPoints });
                    }
                  }}
                  aria-label={selectedPinHasMapCoordinates ? "Recenter map on selected pin" : "Recenter map to show all pins"}
                  title={selectedPinHasMapCoordinates ? "Recenter on selected pin" : "Show all pins on map"}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                    <circle cx="12" cy="10" r="2.25" />
                  </svg>
                </button>
                <div className="map-legend"><span><i className="legend-pin" />Collection site</span>{deviceLocation && <span><i className="legend-current-location" />My location</span>}<span><i className="legend-line" />Firing line</span><span><i className="legend-removed" />Removed in source</span></div>
              </div>
              <div className="map-card-footer"><span>Map tiles by OpenStreetMap</span><span>{formatNumber(unlocatedSiteCount)} without coordinates · {formatNumber(removedSiteCount)} removed in source</span></div>
            </section>


  );
}
