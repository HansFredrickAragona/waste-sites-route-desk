import { MetricCard } from "../../../shared/ui/MetricCard.jsx";
import { formatNumber } from "../../../shared/utils/reviewFormatting.js";

export default function BarangaysDirectory({ page, barangays, siteCount, activeJson, confirmedCount, unconfirmedCount, needsPurokCount, filteredBarangays, search, setSearch, listFilter, setListFilter, openBarangay }) {
  return (
    <>
      {page === "barangays" && (
        <section className="directory-view" aria-labelledby="directory-title">
          <div className="directory-heading">
            <div><p className="eyebrow">Collection-site verification</p><h1 id="directory-title">Barangay review</h1><p className="dashboard-subtitle">Choose a barangay to review its mapped collection sites and confirm local details together.</p></div>
            <div className="source-chip"><span className="source-dot" />Active dataset <strong>{activeJson?.name ?? "No JSON loaded"} · {formatNumber(siteCount)} records</strong></div>
          </div>
          <div className="directory-metrics">
            <MetricCard tone="green" label="Barangays" value={barangays.length} detail="Areas in this review workspace" icon="⌖" />
            <MetricCard tone="orange" label="Collection sites" value={siteCount} detail="Site records in the active JSON" icon="●" />
            <MetricCard tone="violet" label="Confirmed" value={confirmedCount} detail={`${formatNumber(unconfirmedCount)} still to review`} icon="✓" />
            <MetricCard tone="blue" label="Puroks recorded" value={barangays.length - needsPurokCount} detail={`${formatNumber(needsPurokCount)} barangays need purok details`} icon="⌂" />
          </div>
          <section className="directory-panel" aria-label="Barangay list">
            <div className="directory-panel-heading">
              <div><h2>Barangays <span>{filteredBarangays.length}</span></h2></div>
              <div className="directory-controls">
                <label className="directory-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a barangay" aria-label="Find a barangay" /></label>
                <label className="directory-filter"><span className="sr-only">Filter barangays</span><select value={listFilter} onChange={(event) => setListFilter(event.target.value)}><option value="all">All barangays</option><option value="unconfirmed">Needs confirmation</option><option value="confirmed">Confirmed</option><option value="no-sites">No site pins</option></select></label>
              </div>
            </div>
            <div className="barangay-list-head" aria-hidden="true"><span>Barangay</span><span>Sites</span><span>Review status</span></div>
            <div className="barangay-list">
              {filteredBarangays.map((barangay, index) => (
                <button className="barangay-row" key={barangay.id} type="button" onClick={() => openBarangay(barangay)}>
                  <span className="barangay-row-name"><span className="row-index">{String(index + 1).padStart(2, "0")}</span><span><strong>{barangay.name}</strong><small>{barangay.puroks.length ? `${barangay.puroks.length} purok${barangay.puroks.length === 1 ? "" : "s"} recorded` : "Puroks not yet recorded"}</small></span></span>
                  <span className="barangay-site-count"><strong>{formatNumber(barangay.pins.length)}</strong><small>site{barangay.pins.length === 1 ? "" : "s"}</small></span>
                  <span className={`review-status${barangay.confirmed ? " review-status--confirmed" : ""}`}><i />{barangay.confirmed ? "Confirmed" : "Needs review"}</span>
                </button>
              ))}
              {filteredBarangays.length === 0 && (barangays.length === 0
                ? <div className="directory-empty"><span>⌖</span><strong>No JSON data loaded</strong><p>Add a JSON file to review its barangays and collection sites.</p></div>
                : <div className="directory-empty"><span>⌕</span><strong>No barangays found</strong><p>Try another name or change the review filter.</p><button className="small-quiet" type="button" onClick={() => { setSearch(""); setListFilter("all"); }}>Clear filters</button></div>)}

            </div>
            <p className="directory-footnote">{activeJson ? <>Active data: <code>{activeJson.name}</code>. </> : "No JSON is currently loaded. Add a file to begin a review. "}Changes in this demo stay in this browser until exported.</p>
          </section>
        </section>
      )}


    </>
  );
}
