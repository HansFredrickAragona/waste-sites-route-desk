import { useCallback, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import BarangayCoverage from "./BarangayCoverage.jsx";
import BarangayOverviewMarkers from "./BarangayOverviewMarkers.jsx";
import ClusterPanel from "./ClusterPanel.jsx";
import ClusterSummaryCard from "./ClusterSummaryCard.jsx";
import { formatNumber, hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
import barangayClusters from "../data/barangayClusters.json";
import { assignedCluster, clusterName, clusterFilterValue } from "../data/clusterColors.js";
import { buildClusterSummaries } from "../data/clusterSummary.js";
const clusterOptions = [...new Set(Object.values(barangayClusters))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
const BAGUIO_CENTER = [16.41, 120.593];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
function siteCenter(pins) {
  const mapped = pins.filter(hasMapCoordinates);
  return mapped.length ? [mapped.reduce((s,p) => s + Number(p.latitude),0)/mapped.length, mapped.reduce((s,p) => s + Number(p.longitude),0)/mapped.length] : null;
}
function FitBarangayCenters({points, restoredView}) {
  const map = useMap();
  // When the overview remounts with a saved view (returning to the Map tab),
  // keep that view instead of refitting to the filtered points.
  const skipFirstFit = useRef(Boolean(restoredView));
  useEffect(() => {
    if (skipFirstFit.current) { skipFirstFit.current = false; return; }
    if (points.length) map.fitBounds(L.latLngBounds(points), {padding:[44,44],maxZoom:14}); else map.setView(BAGUIO_CENTER,12);
  },[map,points]);
  return null;
}
function FocusOverviewMap({focus, restoredView}) {
  const map = useMap();
  // A restored view wins over the last focus request on the first render.
  const skipFirstFocus = useRef(Boolean(restoredView));
  useEffect(() => {
    const skip = skipFirstFocus.current;
    skipFirstFocus.current = false;
    if (skip || !focus) return;
    if (focus.type === "point") map.flyTo(focus.point,focus.zoom ?? 16,{duration:0.6}); else if (focus.type === "bounds" && focus.points.length) { if(focus.points.length === 1) map.flyTo(focus.points[0],focus.maxZoom ?? 14,{duration:0.6}); else map.flyToBounds(L.latLngBounds(focus.points),{padding:[44,44],maxZoom:focus.maxZoom ?? 14,duration:0.6}); }
  },[map,focus]);
  return null;
}
function PersistMapView({initialView, onChange}) {
  const map = useMap();
  const initialRef = useRef(initialView);
  useEffect(() => {
    if (initialRef.current) map.setView(initialRef.current.center, initialRef.current.zoom, {animate:false});
  },[map]);
  useEffect(() => {
    const save = () => onChange({ center:[map.getCenter().lat,map.getCenter().lng], zoom:map.getZoom() });
    map.on("moveend", save);
    return () => map.off("moveend", save);
  },[map,onChange]);
  return null;
}

function ClearSelectionOnMapClick({ onClear }) {
  const map = useMap();
  useEffect(() => {
    map.on("click", onClear);
    return () => map.off("click", onClear);
  }, [map, onClear]);
  return null;
}

function BarangayDetailsCard({ selected, hasPendingEdit, selectedBarangay, onOpenBarangay, onClose, anchored }) {
  return <article className={`barangays-overview-card${anchored ? " barangays-overview-popup-card" : ""}`} aria-labelledby="overview-card-title">
    <button className="barangays-overview-card-close" type="button" aria-label="Close barangay details" onClick={onClose}>×</button>
    <div className="barangays-overview-card-heading"><div><p className="eyebrow">Barangay details</p><h2 id="overview-card-title">{selected.barangay.name}</h2></div><span className={`barangays-overview-status${selected.barangay.confirmed ? " barangays-overview-status--confirmed" : ""}`}>{selected.barangay.confirmed ? "Confirmed" : "Needs review"}</span></div>
    <p className="barangays-overview-card-location">{selected.center ? `Approximate center from ${formatNumber(selected.mappedCount)} mapped site records.` : "No mapped site coordinates are available, so this barangay has no marker."}</p>
    <p className="barangays-overview-card-location">Draft proximity cluster: {clusterName(selected.barangay.name)}</p>
    <dl className="barangays-overview-details"><div><dt>Site records</dt><dd>{formatNumber(selected.barangay.pins.length)}</dd></div><div><dt>Mapped records</dt><dd>{formatNumber(selected.mappedCount)}</dd></div><div><dt>Puroks</dt><dd>{formatNumber(selected.barangay.puroks.length)}</dd></div><div><dt>Firing lines</dt><dd>{formatNumber(selected.barangay.firingLines.length)}</dd></div></dl>
    {selected.barangay.notes && <p className="barangays-overview-notes"><strong>Barangay notes</strong>{selected.barangay.notes}</p>}
    <div className="barangays-overview-card-actions"><button className="primary-small-button" type="button" disabled={hasPendingEdit && selectedBarangay?.id !== selected.barangay.id} onClick={() => onOpenBarangay(selected.barangay)}>Open site pins <span aria-hidden="true">→</span></button></div>
  </article>;
}

function BarangayGroupCard({ selectedGroup, onSelectBarangay, onClose }) {
  return <article className="barangays-overview-card barangays-overview-group-card barangays-overview-popup-card" aria-labelledby="overview-group-title">
    <button className="barangays-overview-card-close" type="button" aria-label="Close barangay group" onClick={onClose}>×</button>
    <div className="barangays-overview-card-heading"><div><p className="eyebrow">Nearby group</p><h2 id="overview-group-title">{formatNumber(selectedGroup.length)} barangays</h2></div></div>
    <p className="barangays-overview-card-location">{formatNumber(selectedGroup.reduce((sum, item) => sum + item.barangay.pins.length, 0))} total site records. Choose a barangay to see its details.</p>
    <div className="barangays-overview-group-list">{selectedGroup.map(({ barangay, center }) => <button key={barangay.id} type="button" onClick={() => onSelectBarangay(barangay.id, center)}><span><strong>{barangay.name}</strong><small>{barangay.confirmed ? "Confirmed" : "Needs review"}</small></span><span className="barangays-overview-group-records">{formatNumber(barangay.pins.length)}<small>site records</small></span></button>)}</div>
  </article>;
}
export default function BarangaysOverview({barangays,activeJsonName,selectedBarangay,hasPendingEdit,deviceLocation,isLocatingCurrentPosition,mapFocus,recenterOnCurrentLocation,setMapFocus,onOpenBarangay,overviewState,setOverviewState}) {
  const {clusterFilter,search,typeFilter,selectedId,selectedGroupIds,view} = overviewState;
  const updateOverview = useCallback((patch) => setOverviewState(current => ({...current,...patch})),[setOverviewState]);
  const saveMapView = useCallback((nextView) => setOverviewState(current => current.view?.zoom === nextView.zoom && current.view?.center[0] === nextView.center[0] && current.view?.center[1] === nextView.center[1] ? current : {...current,view:nextView}),[setOverviewState]);
  // Compare filters against the previous values so a remount (returning to the
  // Map tab) does not clear a selection the user already made.
  const previousFiltersRef = useRef({search,typeFilter,clusterFilter});
  const filtered = useMemo(() => barangays.filter(b => (clusterFilter === "all" || (assignedCluster(b.name) || "unassigned") === clusterFilter) && b.name.toLowerCase().includes(search.trim().toLowerCase()) && (typeFilter === "all" || typeFilter === "confirmed" && b.confirmed || typeFilter === "unconfirmed" && !b.confirmed || typeFilter === "no-sites" && b.pins.length === 0)),[barangays,search,typeFilter,clusterFilter]);
  const locations = useMemo(() => filtered.map(barangay => ({barangay,mappedCount:barangay.pins.filter(hasMapCoordinates).length,center:siteCenter(barangay.pins)})),[filtered]);
  const placed = useMemo(() => locations.filter(x => x.center),[locations]);
  const unplaced = locations.filter(x => !x.center);
  const mapPoints = useMemo(() => placed.map(x => x.center),[placed]);
  const selected = locations.find(x => x.barangay.id === selectedId);
  const selectedGroup = selectedGroupIds?.map(id => locations.find(x => x.barangay.id === id)).filter(Boolean);
  const selectedGroupCenter = selectedGroup?.length ? L.latLngBounds(selectedGroup.map(x => x.center)).getCenter() : null;
  const clusterSummaries = useMemo(() => buildClusterSummaries(barangays),[barangays]);
  // The chip panel and the cluster dropdown share this one value, so choosing
  // either control keeps the other in sync.
  const selectedCluster = useMemo(() => clusterFilter === "all" ? null : clusterSummaries.find(summary => clusterFilterValue(summary.name) === clusterFilter) || null,[clusterFilter,clusterSummaries]);
  const visibleBarangayIds = useMemo(() => new Set(filtered.map(barangay => barangay.id)),[filtered]);
  useEffect(() => {
    const previous = previousFiltersRef.current;
    if (previous.search === search && previous.typeFilter === typeFilter && previous.clusterFilter === clusterFilter) return;
    previousFiltersRef.current = {search,typeFilter,clusterFilter};
    updateOverview({selectedId:null,selectedGroupIds:null});
  },[search,typeFilter,clusterFilter,updateOverview]);
  // Map background clicks only deselect the pin, so the selected cluster, the
  // filter, and the current zoom/pan survive. Closing the cluster card is the
  // explicit way to go back to the all-clusters view.
  const closeCluster = useCallback(() => updateOverview({selectedId:null,selectedGroupIds:null,clusterFilter:"all"}),[updateOverview]);
  const clearBarangaySelection = useCallback(() => updateOverview({selectedId:null,selectedGroupIds:null}),[updateOverview]);
  function selectBarangay(id,center) {updateOverview({selectedGroupIds:null,selectedId:id});if(center)setMapFocus({type:"point",point:center,zoom:16});}
  function selectCluster(name) {const value = clusterFilterValue(name);setOverviewState(current => ({...current,selectedId:null,selectedGroupIds:null,clusterFilter:current.clusterFilter === value ? "all" : value}));}
  function selectClusterBarangay(id) {const barangay = barangays.find(item => item.id === id);if (!barangay) return;selectBarangay(id,siteCenter(barangay.pins));}
  function selectGroup(group) {updateOverview({selectedId:null,selectedGroupIds:group.items.map(x => x.barangay.id)});setMapFocus({type:"bounds",points:group.items.map(x => x.center),maxZoom:18});}
  function findSelectedPin() {if(selected?.center)setMapFocus({type:"point",point:selected.center,zoom:16});else setMapFocus({type:"bounds",points:selectedGroup?.length ? selectedGroup.map(x => x.center) : mapPoints,maxZoom:selectedGroup?.length ? 18 : 14});}
  return <section className="barangays-overview" aria-labelledby="barangays-overview-title">
    <header className="barangays-overview-heading"><div><p className="eyebrow">Barangay map</p><h1 id="barangays-overview-title">Barangays</h1><p className="dashboard-subtitle">Each barangay with mapped sites has its own pin at every zoom level. Select a cluster to list its barangays and site totals; select a pin or shaded area to see barangay details.</p></div><div className="source-chip"><span className="source-dot"/>Active dataset <strong>{activeJsonName}</strong></div></header>
    <div className="directory-controls barangays-overview-controls">
      <label className="directory-search"><input type="search" value={search} onChange={e=>updateOverview({search:e.target.value})} placeholder="Search by barangay" aria-label="Search by barangay"/></label>
      <label className="directory-filter"><span className="sr-only">Barangay type</span><select aria-label="Barangay type" value={typeFilter} onChange={e=>updateOverview({typeFilter:e.target.value})}><option value="all">All barangays</option><option value="confirmed">Confirmed</option><option value="unconfirmed">Needs confirmation</option><option value="no-sites">No site pins</option></select></label>
      <label className="directory-filter"><span className="sr-only">Draft proximity cluster</span><select aria-label="Draft proximity cluster" value={clusterFilter} onChange={e=>updateOverview({clusterFilter:e.target.value})}><option value="all">All clusters (draft)</option>{clusterOptions.map(cluster=><option key={cluster} value={cluster}>{cluster}</option>)}<option value="unassigned">Bida Barangays</option></select></label>
      {(search || typeFilter !== "all" || clusterFilter !== "all") && <button className="small-quiet" type="button" onClick={()=>updateOverview({search:"",typeFilter:"all",clusterFilter:"all"})}>Clear filters</button>}
    </div>
    <div className="barangays-overview-stats" aria-label="Filtered map totals"><span><strong>{formatNumber(filtered.length)}</strong> of {formatNumber(barangays.length)} barangays</span><span><strong>{formatNumber(placed.length)}</strong> approximate centers</span><span><strong>{formatNumber(filtered.reduce((s,b)=>s+b.pins.length,0))}</strong> site records</span><span><strong>{formatNumber(locations.reduce((s,x)=>s+x.mappedCount,0))}</strong> site records with coordinates</span></div>
    <p className="barangays-overview-note">Shaded polygons surround each barangay’s outermost recorded site points; overlaps are possible. Areas with fewer than three non-collinear mapped points have no polygon. Pins show approximate site centers. They do not show official barangay boundaries or offices. Cluster assignments are draft proximity groups from the mapping CSV; travel times and interview locations are not verified.</p>
    <div className="barangays-overview-map-frame">
      <MapContainer className="barangays-overview-map" center={view?.center ?? BAGUIO_CENTER} zoom={view?.zoom ?? 12} scrollWheelZoom><ClearSelectionOnMapClick onClear={clearBarangaySelection}/><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url={TILE_URL} maxZoom={19}/><FitBarangayCenters points={mapPoints} restoredView={view}/><FocusOverviewMap focus={mapFocus} restoredView={view}/><PersistMapView initialView={view} onChange={saveMapView}/>
        {deviceLocation && <>{Number.isFinite(deviceLocation.accuracy) && deviceLocation.accuracy > 0 && <Circle center={[deviceLocation.latitude,deviceLocation.longitude]} radius={deviceLocation.accuracy} pathOptions={{color:"#4389e8",weight:1,fillOpacity:0.12}} interactive={false}/>}<CircleMarker center={[deviceLocation.latitude,deviceLocation.longitude]} radius={7} pathOptions={{color:"#fff",weight:3,fillColor:"#4389e8",fillOpacity:1}} interactive={false}/></>}
        <BarangayCoverage barangays={filtered} selectedId={selectedId} activeCluster={selectedCluster?.name ?? null} onSelect={selectBarangay}/>
        <BarangayOverviewMarkers locations={placed} selectedId={selectedId} selectedGroupIds={selectedGroupIds} activeCluster={selectedCluster?.name ?? null} onSelectBarangay={selectBarangay} onSelectGroup={selectGroup}/>
        {selectedGroup?.length > 1 && <Popup className="barangays-overview-popup" position={selectedGroupCenter} closeButton={false} maxWidth={390} autoPan autoPanPadding={[24,24]}><BarangayGroupCard selectedGroup={selectedGroup} onSelectBarangay={selectBarangay} onClose={clearBarangaySelection}/></Popup>}
        {selected?.center && <Popup className="barangays-overview-popup" position={selected.center} closeButton={false} maxWidth={390} autoPan autoPanPadding={[24,24]}><BarangayDetailsCard selected={selected} hasPendingEdit={hasPendingEdit} selectedBarangay={selectedBarangay} onOpenBarangay={onOpenBarangay} onClose={clearBarangaySelection} anchored/></Popup>}
      </MapContainer>
      <button className={`map-recenter-button${isLocatingCurrentPosition ? " map-recenter-button--loading" : ""}`} type="button" onClick={recenterOnCurrentLocation} disabled={isLocatingCurrentPosition} aria-label="Recenter map on my current location" title="Where I am"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.25"/><circle className="map-recenter-dot" cx="12" cy="12" r="1.5"/><path d="M12 2.75v3.1M12 18.15v3.1M2.75 12h3.1M18.15 12h3.1"/></svg></button>
      <button className="map-recenter-button map-recenter-button--pin" type="button" disabled={!mapPoints.length} onClick={findSelectedPin} aria-label="Find selected barangay pin" title="Find selected pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.25"/></svg></button>
      <ClusterPanel summaries={clusterSummaries} selectedName={selectedCluster?.name ?? null} onSelect={selectCluster}/>
      {selectedCluster && <ClusterSummaryCard summary={selectedCluster} visibleIds={visibleBarangayIds} onSelectBarangay={selectClusterBarangay} onClose={closeCluster}/>}
      {selected && !selected.center && <BarangayDetailsCard selected={selected} hasPendingEdit={hasPendingEdit} selectedBarangay={selectedBarangay} onOpenBarangay={onOpenBarangay} onClose={clearBarangaySelection} anchored={false}/>}
      {!filtered.length && <p className="barangays-overview-empty">{barangays.length ? "No barangays match your search and filter." : "No barangays are available in this JSON."}</p>}
    </div>
    {!!unplaced.length && <section className="barangays-overview-unplaced" aria-labelledby="unplaced-barangays-title"><h2 id="unplaced-barangays-title">Without mapped site coordinates</h2><p>These barangays have no approximate center to place on the map.</p>{unplaced.map(({barangay})=><button className="small-quiet" key={barangay.id} type="button" onClick={()=>selectBarangay(barangay.id,null)}>{barangay.name}</button>)}</section>}
  </section>;
}
