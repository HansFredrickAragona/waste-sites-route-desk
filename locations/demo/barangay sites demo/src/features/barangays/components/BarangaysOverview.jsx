import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import BarangayOverviewMarkers from "./BarangayOverviewMarkers.jsx";
import { formatNumber, hasMapCoordinates } from "../../../shared/utils/reviewFormatting.js";
const BAGUIO_CENTER = [16.41, 120.593];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
function siteCenter(pins) {
  const mapped = pins.filter(hasMapCoordinates);
  return mapped.length ? [mapped.reduce((s,p) => s + Number(p.latitude),0)/mapped.length, mapped.reduce((s,p) => s + Number(p.longitude),0)/mapped.length] : null;
}
function FitBarangayCenters({points}) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(L.latLngBounds(points), {padding:[44,44],maxZoom:14}); else map.setView(BAGUIO_CENTER,12); },[map,points]);
  return null;
}
function FocusOverviewMap({focus}) {
  const map = useMap();
  useEffect(() => { if (!focus) return; if (focus.type === "point") map.flyTo(focus.point,focus.zoom ?? 16,{duration:0.6}); else if (focus.type === "bounds" && focus.points.length) { if(focus.points.length === 1) map.flyTo(focus.points[0],focus.maxZoom ?? 14,{duration:0.6}); else map.flyToBounds(L.latLngBounds(focus.points),{padding:[44,44],maxZoom:focus.maxZoom ?? 14,duration:0.6}); } },[map,focus]);
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
export default function BarangaysOverview({barangays,activeJsonName,selectedBarangay,hasPendingEdit,deviceLocation,isLocatingCurrentPosition,mapFocus,recenterOnCurrentLocation,setMapFocus,onOpenBarangay}) {
  const [search,setSearch] = useState("");
  const [typeFilter,setTypeFilter] = useState("all");
  const [selectedId,setSelectedId] = useState(null);
  const [selectedGroupIds,setSelectedGroupIds] = useState(null);
  const filtered = useMemo(() => barangays.filter(b => b.name.toLowerCase().includes(search.trim().toLowerCase()) && (typeFilter === "all" || typeFilter === "confirmed" && b.confirmed || typeFilter === "unconfirmed" && !b.confirmed || typeFilter === "no-sites" && b.pins.length === 0)),[barangays,search,typeFilter]);
  const locations = useMemo(() => filtered.map(barangay => ({barangay,mappedCount:barangay.pins.filter(hasMapCoordinates).length,center:siteCenter(barangay.pins)})),[filtered]);
  const placed = useMemo(() => locations.filter(x => x.center),[locations]);
  const unplaced = locations.filter(x => !x.center);
  const mapPoints = useMemo(() => placed.map(x => x.center),[placed]);
  const selected = locations.find(x => x.barangay.id === selectedId);
  const selectedGroup = selectedGroupIds?.map(id => locations.find(x => x.barangay.id === id)).filter(Boolean);
  const selectedGroupCenter = selectedGroup?.length ? L.latLngBounds(selectedGroup.map(x => x.center)).getCenter() : null;
  useEffect(() => {setSelectedId(null);setSelectedGroupIds(null);},[search,typeFilter]);
  const clearSelection = useCallback(() => {setSelectedId(null);setSelectedGroupIds(null);},[]);
  function selectBarangay(id,center) {setSelectedGroupIds(null);setSelectedId(id);if(center)setMapFocus({type:"point",point:center,zoom:16});}
  function selectGroup(group) {setSelectedId(null);setSelectedGroupIds(group.items.map(x => x.barangay.id));setMapFocus({type:"bounds",points:group.items.map(x => x.center),maxZoom:18});}
  function findSelectedPin() {if(selected?.center)setMapFocus({type:"point",point:selected.center,zoom:16});else setMapFocus({type:"bounds",points:selectedGroup?.length ? selectedGroup.map(x => x.center) : mapPoints,maxZoom:selectedGroup?.length ? 18 : 14});}
  return <section className="barangays-overview" aria-labelledby="barangays-overview-title">
    <header className="barangays-overview-heading"><div><p className="eyebrow">Barangay map</p><h1 id="barangays-overview-title">Barangays</h1><p className="dashboard-subtitle">Nearby centers group as you zoom out. Select a group pin to zoom in and choose a barangay.</p></div><div className="source-chip"><span className="source-dot"/>Active dataset <strong>{activeJsonName}</strong></div></header>
    <div className="directory-controls barangays-overview-controls">
      <label className="directory-search"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by barangay" aria-label="Search by barangay"/></label>
      <label className="directory-filter"><span className="sr-only">Barangay type</span><select aria-label="Barangay type" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All barangays</option><option value="confirmed">Confirmed</option><option value="unconfirmed">Needs confirmation</option><option value="no-sites">No site pins</option></select></label>
      {(search || typeFilter !== "all") && <button className="small-quiet" type="button" onClick={()=>{setSearch("");setTypeFilter("all");}}>Clear filters</button>}
    </div>
    <div className="barangays-overview-stats" aria-label="Filtered map totals"><span><strong>{formatNumber(filtered.length)}</strong> of {formatNumber(barangays.length)} barangays</span><span><strong>{formatNumber(placed.length)}</strong> approximate centers</span><span><strong>{formatNumber(filtered.reduce((s,b)=>s+b.pins.length,0))}</strong> site records</span><span><strong>{formatNumber(locations.reduce((s,x)=>s+x.mappedCount,0))}</strong> site records with coordinates</span></div>
    <p className="barangays-overview-note">Markers show approximate centers calculated from mapped site records. They do not show official barangay boundaries or offices.</p>
    <div className="barangays-overview-map-frame">
      <MapContainer className="barangays-overview-map" center={BAGUIO_CENTER} zoom={12} scrollWheelZoom><ClearSelectionOnMapClick onClear={clearSelection}/><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url={TILE_URL} maxZoom={19}/><FitBarangayCenters points={mapPoints}/><FocusOverviewMap focus={mapFocus}/>
        {deviceLocation && <>{Number.isFinite(deviceLocation.accuracy) && deviceLocation.accuracy > 0 && <Circle center={[deviceLocation.latitude,deviceLocation.longitude]} radius={deviceLocation.accuracy} pathOptions={{color:"#4389e8",weight:1,fillOpacity:0.12}} interactive={false}/>}<CircleMarker center={[deviceLocation.latitude,deviceLocation.longitude]} radius={7} pathOptions={{color:"#fff",weight:3,fillColor:"#4389e8",fillOpacity:1}} interactive={false}/></>}
        <BarangayOverviewMarkers locations={placed} selectedId={selectedId} selectedGroupIds={selectedGroupIds} onSelectBarangay={selectBarangay} onSelectGroup={selectGroup}/>
        {selectedGroup?.length > 1 && <Popup className="barangays-overview-popup" position={selectedGroupCenter} closeButton={false} maxWidth={390} autoPan autoPanPadding={[24,24]}><BarangayGroupCard selectedGroup={selectedGroup} onSelectBarangay={selectBarangay} onClose={clearSelection}/></Popup>}
        {selected?.center && <Popup className="barangays-overview-popup" position={selected.center} closeButton={false} maxWidth={390} autoPan autoPanPadding={[24,24]}><BarangayDetailsCard selected={selected} hasPendingEdit={hasPendingEdit} selectedBarangay={selectedBarangay} onOpenBarangay={onOpenBarangay} onClose={clearSelection} anchored/></Popup>}
      </MapContainer>
      <button className={`map-recenter-button${isLocatingCurrentPosition ? " map-recenter-button--loading" : ""}`} type="button" onClick={recenterOnCurrentLocation} disabled={isLocatingCurrentPosition} aria-label="Recenter map on my current location" title="Where I am"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5.25"/><circle className="map-recenter-dot" cx="12" cy="12" r="1.5"/><path d="M12 2.75v3.1M12 18.15v3.1M2.75 12h3.1M18.15 12h3.1"/></svg></button>
      <button className="map-recenter-button map-recenter-button--pin" type="button" disabled={!mapPoints.length} onClick={findSelectedPin} aria-label="Find selected barangay pin" title="Find selected pin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.25"/></svg></button>
      <div className="barangays-overview-legend" aria-label="Map marker legend"><span><i className="barangays-overview-legend-dot barangays-overview-legend-dot--confirmed"/>Confirmed</span><span><i className="barangays-overview-legend-dot barangays-overview-legend-dot--review"/>Needs review</span><small>Group counts appear on hover and in the detail card.</small></div>
      {selected && !selected.center && <BarangayDetailsCard selected={selected} hasPendingEdit={hasPendingEdit} selectedBarangay={selectedBarangay} onOpenBarangay={onOpenBarangay} onClose={clearSelection} anchored={false}/>}
      {!filtered.length && <p className="barangays-overview-empty">{barangays.length ? "No barangays match your search and filter." : "No barangays are available in this JSON."}</p>}
    </div>
    {!!unplaced.length && <section className="barangays-overview-unplaced" aria-labelledby="unplaced-barangays-title"><h2 id="unplaced-barangays-title">Without mapped site coordinates</h2><p>These barangays have no approximate center to place on the map.</p>{unplaced.map(({barangay})=><button className="small-quiet" key={barangay.id} type="button" onClick={()=>selectBarangay(barangay.id,null)}>{barangay.name}</button>)}</section>}
  </section>;
}
