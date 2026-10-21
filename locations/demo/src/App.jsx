import { useEffect, useMemo, useState } from "react";
import DataNotes from "./components/DataNotes.jsx";
import Dashboard from "./components/Dashboard.jsx";
import DriverFilter, { ALL_DRIVERS } from "./components/DriverFilter.jsx";
import QrtHistoryView from "./components/QrtHistoryView.jsx";
import ScheduleVersionControl from "./components/ScheduleVersionControl.jsx";
import SiteMap from "./components/SiteMap.jsx";
import WeeklySchedule from "./components/WeeklySchedule.jsx";
import {
  ALL_BARANGAYS,
  buildScheduleModel,
  getBarangaysForAreas,
  getAreasForCell,
  getSitesForAreas,
} from "./data/scheduleModel.js";
import {
  createScheduleExport,
  loadScheduleEdits,
  parseScheduleFile,
  persistScheduleEdit,
  removeScheduleEdit,
} from "./data/scheduleEdits.js";
import { cellReviewKey } from "./data/cellReview.js";
import { groupAreaAssignments, isQrtAreaName } from "./data/scheduleCellPresentation.js";
import cleanedDriverAreaLabels from "./data/schedules/cleanedDriverAreaLabels.json";

const SCHEDULE_LIBRARY_KEY = "baguio-driver-schedules";
const LEGACY_V4_STORAGE_KEY = "baguio-driver-schedule-v4";
const HIDDEN_BUILT_IN_VERSIONS_KEY = "baguio-driver-hidden-schedules";
const ACTIVE_VERSION_STORAGE_KEY = "baguio-driver-active-schedule";
const BUILT_IN_VERSION_ORDER = ["v3", "v4", "v5"];
const BUILT_IN_VERSIONS = new Set(BUILT_IN_VERSION_ORDER);

function isUndefinedFiringLineSite(site) {
  return site.siteName?.toLocaleLowerCase().replace(/\s+/g, "") === "firingline" && !site.hasCoordinates;
}

function normalizedScheduleLabel(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    : "";
}

function loadHiddenBuiltInVersions() {
  if (typeof window === "undefined") return [];
  try {
    const hidden = JSON.parse(window.localStorage.getItem(HIDDEN_BUILT_IN_VERSIONS_KEY) || "[]");
    return Array.isArray(hidden) ? hidden.filter((version) => BUILT_IN_VERSIONS.has(version)) : [];
  } catch {
    return [];
  }
}

function loadSavedSchedules() {
  if (typeof window === "undefined") return [];
  let saved = [];
  try {
    const library = JSON.parse(window.localStorage.getItem(SCHEDULE_LIBRARY_KEY) || "null");
    if (Array.isArray(library)) {
      saved = library;
    } else {
      throw new Error("No schedule library found.");
    }
  } catch { /* Try the older single-v4 slot below. */ }

  if (saved.length === 0) {
    try {
      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_V4_STORAGE_KEY) || "null");
      if (Array.isArray(legacy?.data)) saved = [{ id: "v4", ...legacy }];
    } catch { /* Ignore invalid browser storage. */ }
  }

  const usedIds = new Set(BUILT_IN_VERSIONS);
  const existingIds = new Set(saved.map((item) => item?.id).filter((id) => typeof id === "string"));
  const renamed = [];
  let nextVersionNumber = 6;
  const schedules = saved
    .filter((item) => item && typeof item.id === "string" && Array.isArray(item.data))
    .map((item) => {
      let id = item.id;
      if (usedIds.has(id)) {
        do {
          id = `v${nextVersionNumber}`;
          nextVersionNumber += 1;
        } while (usedIds.has(id) || existingIds.has(id));
      }
      usedIds.add(id);
      if (id !== item.id) renamed.push({ from: item.id, to: id });
      return id === item.id ? item : { ...item, id };
    });

  if (renamed.length > 0) {
    try {
      const oldV5 = renamed.find(({ from }) => from === "v5");
      if (oldV5) {
        const edits = loadScheduleEdits();
        if (edits.v5) {
          if (!edits[oldV5.to]) persistScheduleEdit(oldV5.to, edits.v5);
          removeScheduleEdit("v5");
        }
        if (window.localStorage.getItem(ACTIVE_VERSION_STORAGE_KEY) === "v5") {
          window.localStorage.setItem(ACTIVE_VERSION_STORAGE_KEY, oldV5.to);
        }
      }
      window.localStorage.setItem(SCHEDULE_LIBRARY_KEY, JSON.stringify(schedules));
    } catch { /* Keep renamed schedules available for this session. */ }
  }
  return schedules;
}

function loadActiveVersion() {
  if (typeof window === "undefined") return "v5";
  try {
    return window.localStorage.getItem(ACTIVE_VERSION_STORAGE_KEY) || "v5";
  } catch {
    return "v5";
  }
}

export default function App() {
  const [builtInSchedules, setBuiltInSchedules] = useState({});
  const [siteIndex, setSiteIndex] = useState(null);
  const [uploadedSchedules, setUploadedSchedules] = useState(loadSavedSchedules);
  const [scheduleEdits, setScheduleEdits] = useState(loadScheduleEdits);
  const [hiddenBuiltInVersions, setHiddenBuiltInVersions] = useState(loadHiddenBuiltInVersions);
  const [unavailableBuiltInVersions, setUnavailableBuiltInVersions] = useState([]);
  const [activeVersion, setActiveVersion] = useState(loadActiveVersion);
  const [siteIndexError, setSiteIndexError] = useState("");
  const [scheduleLoadError, setScheduleLoadError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState(ALL_DRIVERS);
  const [selectedCell, setSelectedCell] = useState(null);
  const [activeTab, setActiveTab] = useState("schedule");
  const loadError = siteIndexError || scheduleLoadError;

  useEffect(() => {
    if (!uploadMessage) return undefined;

    const timeoutId = window.setTimeout(() => setUploadMessage(""), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [uploadMessage]);

  const availableBuiltInVersions = useMemo(
    () => BUILT_IN_VERSION_ORDER.filter((version) =>
      !hiddenBuiltInVersions.includes(version) && !unavailableBuiltInVersions.includes(version)),
    [hiddenBuiltInVersions, unavailableBuiltInVersions],
  );
  const noSchedulesAvailable = availableBuiltInVersions.length === 0 && uploadedSchedules.length === 0;

  const activeUploadedSchedule = uploadedSchedules.find((schedule) => schedule.id === activeVersion) ?? null;
  const sourceSchedule = BUILT_IN_VERSIONS.has(activeVersion)
    ? (hiddenBuiltInVersions.includes(activeVersion) ? null : builtInSchedules[activeVersion] ?? null)
    : activeUploadedSchedule?.data ?? null;
  const activeEdit = scheduleEdits[activeVersion] ?? null;
  const activeSchedule = activeEdit?.schedule ?? sourceSchedule;
  const activeMapFeatures = Array.isArray(activeEdit?.mapFeatures)
    ? activeEdit.mapFeatures
    : Array.isArray(activeUploadedSchedule?.mapFeatures)
      ? activeUploadedSchedule.mapFeatures
      : [];
  const activeCellStatuses = activeEdit?.cellStatuses ?? activeUploadedSchedule?.cellStatuses ?? {};
  const scheduleModel = useMemo(
    () => activeSchedule && siteIndex
      ? buildScheduleModel(
        activeSchedule,
        siteIndex,
        activeVersion,
        activeVersion === "v4" ? cleanedDriverAreaLabels : {},
      )
      : null,
    [activeSchedule, activeVersion, siteIndex],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSiteIndex() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/maps/swmd_site_index.json`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok && response.status === 404) {
          if (!cancelled) {
            setSiteIndex({ sites: [], sourceSites: [], barangays: [] });
            setSiteIndexError("");
          }
          return;
        }
        if (!response.ok) throw new Error(`swmd_site_index.json returned HTTP ${response.status}.`);
        const index = await response.json();
        if (!cancelled) {
          setSiteIndex(index);
        }
      } catch (error) {
        if (!cancelled) {
          setSiteIndexError(
            error instanceof Error
              ? `Could not read the SWMD site index. ${error.message}`
              : "Could not read the SWMD site index.",
          );
        }
      }
    }

    loadSiteIndex();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (
      !BUILT_IN_VERSIONS.has(activeVersion) ||
      hiddenBuiltInVersions.includes(activeVersion) ||
      builtInSchedules[activeVersion]
    ) return undefined;
    let cancelled = false;

    async function loadSelectedSchedule() {
      const filename = `driver_schedule_${activeVersion}.json`;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/schedules/${filename}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok && response.status === 404) {
          if (!cancelled) {
            setUnavailableBuiltInVersions((current) => current.includes(activeVersion)
              ? current
              : [...current, activeVersion]);
            setScheduleLoadError("");
          }
          return;
        }
        if (!response.ok) throw new Error(`${filename} returned HTTP ${response.status}.`);
        const schedule = await response.json();
        if (!cancelled) {
          setBuiltInSchedules((current) => ({ ...current, [activeVersion]: schedule }));
          setScheduleLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setScheduleLoadError(
            error instanceof Error
              ? `Could not read ${filename}. ${error.message}`
              : `Could not read ${filename}.`,
          );
        }
      }
    }

    loadSelectedSchedule();
    return () => { cancelled = true; };
  }, [activeVersion, builtInSchedules[activeVersion], hiddenBuiltInVersions]);

  useEffect(() => {
    const activeBuiltInIsAvailable = availableBuiltInVersions.includes(activeVersion);
    const activeUploadIsAvailable = uploadedSchedules.some((schedule) => schedule.id === activeVersion);
    if (activeBuiltInIsAvailable || activeUploadIsAvailable) return;

    setActiveVersion(availableBuiltInVersions[0] ?? uploadedSchedules[0]?.id ?? "");
  }, [activeVersion, availableBuiltInVersions, uploadedSchedules]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_VERSION_STORAGE_KEY, activeVersion);
    } catch { /* The selected version still works for this session. */ }
  }, [activeVersion]);

  useEffect(() => {
    if (selectedDriverId === ALL_DRIVERS || !scheduleModel) return;
    if (scheduleModel.drivers.some((driver) => driver.id === selectedDriverId)) return;
    setSelectedDriverId(ALL_DRIVERS);
  }, [scheduleModel, selectedDriverId]);

  async function handleScheduleUpload(files) {
    setUploadError("");
    setUploadMessage("");

    const addedSchedules = [];
    const rejectedFiles = [];
    const usedIds = new Set([
      ...BUILT_IN_VERSIONS,
      ...uploadedSchedules.map((schedule) => schedule.id),
    ]);
    let nextVersionNumber = 6;

    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text());
        const { schedule, mapFeatures, cellStatuses } = parseScheduleFile(parsed);
        if (!schedule.some((record) => record && typeof record === "object" && Array.isArray(record.schedule))) {
          throw new Error("no driver record with a schedule array was found");
        }

        let id = `v${nextVersionNumber}`;
        while (usedIds.has(id)) {
          nextVersionNumber += 1;
          id = `v${nextVersionNumber}`;
        }
        usedIds.add(id);
        nextVersionNumber += 1;
        addedSchedules.push({ id, name: file.name, data: schedule, mapFeatures, cellStatuses });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "could not read this JSON file";
        rejectedFiles.push(`${file.name}: ${reason}`);
      }
    }

    if (addedSchedules.length === 0) {
      setUploadError(rejectedFiles.join(" ") || "No JSON files were selected.");
      return;
    }

    const nextLibrary = [...uploadedSchedules, ...addedSchedules];
    setUploadedSchedules(nextLibrary);
    setActiveVersion(addedSchedules[0].id);
    setScheduleLoadError("");
    setSelectedDriverId(ALL_DRIVERS);
    setSelectedCell(null);
    setEditMessage("");

    try {
      window.localStorage.setItem(SCHEDULE_LIBRARY_KEY, JSON.stringify(nextLibrary));
      setUploadMessage(`Added ${addedSchedules.map((schedule) => schedule.name).join(", ")}; saved in this browser.`);
    } catch {
      setUploadMessage(`Added ${addedSchedules.map((schedule) => schedule.name).join(", ")} for this session; browser storage was unavailable.`);
    }
    if (rejectedFiles.length > 0) setUploadError(`Skipped: ${rejectedFiles.join(" · ")}`);
  }

  function handleScheduleDelete() {
    const deletingBuiltIn = availableBuiltInVersions.includes(activeVersion);
    if (!activeUploadedSchedule && !deletingBuiltIn) return;

    const nextLibrary = activeUploadedSchedule
      ? uploadedSchedules.filter((schedule) => schedule.id !== activeUploadedSchedule.id)
      : uploadedSchedules;
    const nextHiddenBuiltIns = deletingBuiltIn
      ? [...new Set([...hiddenBuiltInVersions, activeVersion])]
      : hiddenBuiltInVersions;
    const fileName = activeUploadedSchedule?.name || `driver_schedule_${activeVersion}.json`;
    const nextBuiltIn = BUILT_IN_VERSION_ORDER.find((version) => !nextHiddenBuiltIns.includes(version));
    const nextVersion = nextBuiltIn ?? nextLibrary[0]?.id ?? "";

    setUploadedSchedules(nextLibrary);
    setHiddenBuiltInVersions(nextHiddenBuiltIns);
    if (activeUploadedSchedule) {
      setScheduleEdits((current) => {
        const next = { ...current };
        delete next[activeVersion];
        return next;
      });
    }
    setActiveVersion(nextVersion);
    setScheduleLoadError("");
    setSelectedDriverId(ALL_DRIVERS);
    setSelectedCell(null);
    setUploadError("");
    setEditMessage("");

    try {
      window.localStorage.setItem(SCHEDULE_LIBRARY_KEY, JSON.stringify(nextLibrary));
      window.localStorage.setItem(HIDDEN_BUILT_IN_VERSIONS_KEY, JSON.stringify(nextHiddenBuiltIns));
      if (activeUploadedSchedule) removeScheduleEdit(activeVersion);
      setUploadMessage(`Removed ${fileName} from this browser's schedule list.`);
    } catch {
      setUploadMessage(`Removed ${fileName} for this session; browser storage could not be updated.`);
    }
  }

  function handleRestoreBuiltInSchedules() {
    if (hiddenBuiltInVersions.length === 0) return;

    setHiddenBuiltInVersions([]);
    setUnavailableBuiltInVersions([]);
    setSelectedDriverId(ALL_DRIVERS);
    if (!activeVersion || hiddenBuiltInVersions.includes(activeVersion)) {
      setActiveVersion(BUILT_IN_VERSION_ORDER[0]);
    }
    try {
      window.localStorage.removeItem(HIDDEN_BUILT_IN_VERSIONS_KEY);
      setUploadMessage("Restored the bundled schedule files to the selector.");
    } catch {
      setUploadMessage("Restored the bundled schedule files for this session; browser storage could not be updated.");
    }
  }

  function handleVersionChange(version) {
    if (!availableBuiltInVersions.includes(version) && !uploadedSchedules.some((schedule) => schedule.id === version)) return;
    setActiveVersion(version);
    setScheduleLoadError("");
    setSelectedDriverId(ALL_DRIVERS);
    setSelectedCell(null);
    setUploadError("");
    setUploadMessage("");
    setEditMessage("");
  }

  function commitScheduleEdit(
    nextSchedule,
    nextMapFeatures = activeMapFeatures,
    nextCellStatuses = activeCellStatuses,
  ) {
    const edit = {
      schedule: nextSchedule,
      mapFeatures: nextMapFeatures,
      cellStatuses: nextCellStatuses,
      updatedAt: new Date().toISOString(),
    };
    setScheduleEdits((current) => ({ ...current, [activeVersion]: edit }));
    try {
      persistScheduleEdit(activeVersion, edit);
      setEditMessage("Changes saved in this browser.");
    } catch {
      setEditMessage("Changes are active for this session, but browser storage could not save them.");
    }
    return edit;
  }

  function editSchedule(mutator) {
    if (!Array.isArray(activeSchedule)) return null;
    const nextSchedule = JSON.parse(JSON.stringify(activeSchedule));
    const result = mutator(nextSchedule);
    commitScheduleEdit(nextSchedule);
    return result;
  }

  function readRawArea(schedule, ref) {
    if (!ref) return null;
    const dayArea = schedule?.[ref.driverIndex]?.schedule?.[ref.entryIndex]?.area;
    const details = Array.isArray(dayArea) ? dayArea : dayArea?.details;
    return Array.isArray(details) ? details[ref.areaIndex] : null;
  }

  function readRawSite(schedule, site) {
    const ref = site?.sourceRef;
    return readRawArea(schedule, ref)?.sites?.[ref.siteIndex] ?? null;
  }

  function handleSaveSite(siteId, values) {
    const site = allCellMappedSites.find((item) => item.id === siteId) ?? allCellSites.find((item) => item.id === siteId);
    if (!site) return false;
    let saved = false;
    editSchedule((nextSchedule) => {
      const rawSite = readRawSite(nextSchedule, site);
      if (rawSite) {
        const moved = values.latitude !== site.latitude || values.longitude !== site.longitude;
        const barangayChanged = values.barangay !== site.barangay;
        Object.assign(rawSite, values);
        if (moved || barangayChanged) rawSite.manual_override = true;
        saved = true;
      }
    });
    return saved;
  }

  function handleDeleteSite(site) {
    const sourceSite = allCellMappedSites.find((item) => item.id === site.id) ?? allCellSites.find((item) => item.id === site.id);
    const ref = sourceSite?.sourceRef;
    if (!ref) return;
    editSchedule((nextSchedule) => {
      const rawArea = readRawArea(nextSchedule, ref);
      if (Array.isArray(rawArea?.sites)) rawArea.sites.splice(ref.siteIndex, 1);
    });
  }

  function handleAddSite(area, coordinates, values = {}) {
    const ref = area.sourceRef;
    if (!ref) return null;
    let siteIndex = -1;
    editSchedule((nextSchedule) => {
      const rawArea = readRawArea(nextSchedule, ref);
      if (!rawArea) return;
      if (!Array.isArray(rawArea.sites)) rawArea.sites = [];
      siteIndex = rawArea.sites.length;
      rawArea.sites.push({
        site_name: values.site_name ?? "",
        map_label: values.map_label ?? "",
        barangay: values.barangay ?? area.barangay,
        latitude: values.latitude ?? coordinates[0],
        longitude: values.longitude ?? coordinates[1],
        manual_override: true,
      });
    });
    return siteIndex >= 0
      ? `${ref.driverIndex}-${ref.day}-${ref.entryIndex}-${ref.areaIndex}-${siteIndex}`
      : null;
  }

  function handleAddFiringLine(feature) {
    if (!selectedDriver || !selectedCell) return;
    const assignedAreaIds = Array.isArray(feature.area_ids) && feature.area_ids.length > 0
      ? [...new Set(feature.area_ids.filter(Boolean))]
      : [];
    const assignedAreaNames = Array.isArray(feature.area_names) && feature.area_names.length > 0
      ? [...new Set(feature.area_names.filter(Boolean))]
      : [...new Set(unfilteredCellAreas.map((area) => area.areaName).filter(Boolean))];
    const featureAreas = assignedAreaIds.length > 0
      ? unfilteredCellAreas.filter((area) => assignedAreaIds.includes(area.id))
      : assignedAreaNames.length > 0
        ? unfilteredCellAreas.filter((area) => assignedAreaNames.includes(area.areaName))
        : unfilteredCellAreas;
    const assignedBarangays = Array.isArray(feature.barangays) && feature.barangays.length > 0
      ? [...new Set(feature.barangays.filter(Boolean))]
      : [...new Set(featureAreas.flatMap((area) => [
        ...(area.mapBarangays ?? []),
        ...area.sites.flatMap((site) => site.mapBarangays ?? []),
      ]).filter(Boolean))];
    const mapFeature = {
      ...feature,
      driver_id: selectedDriver.id,
      driver: selectedDriver.name,
      day: selectedCell.day,
      area_names: assignedAreaNames,
      barangays: assignedBarangays,
      barangay: feature.barangay || assignedBarangays[0] || featureAreas[0]?.barangay || "",
    };
    commitScheduleEdit(activeSchedule, [...activeMapFeatures, mapFeature]);
  }

  function handleUpdateFiringLine(featureId, coordinates) {
    const routeFeature = findScheduleRouteFeature(featureId);
    if (routeFeature) {
      editSchedule((nextSchedule) => {
        const rawArea = readRawArea(nextSchedule, routeFeature.sourceRef);
        const rawSegment = rawArea?.unmapped_segments?.[routeFeature.sourceRef.segmentIndex];
        if (rawSegment && typeof rawSegment === "object") {
          rawSegment.coordinates = coordinates.map((point) => [...point]);
        }
      });
      return;
    }

    const nextFeatures = activeMapFeatures.map((feature) => feature.id === featureId
      ? { ...feature, coordinates }
      : feature);
    commitScheduleEdit(activeSchedule, nextFeatures);
  }

  function handleDeleteFiringLine(featureId) {
    const routeFeature = findScheduleRouteFeature(featureId);
    if (routeFeature) {
      editSchedule((nextSchedule) => {
        const rawArea = readRawArea(nextSchedule, routeFeature.sourceRef);
        const segments = rawArea?.unmapped_segments;
        const segmentIndex = routeFeature.sourceRef.segmentIndex;
        if (Array.isArray(segments) && segments[segmentIndex]?.type === "route") {
          segments.splice(segmentIndex, 1);
        }
      });
      return;
    }

    commitScheduleEdit(activeSchedule, activeMapFeatures.filter((feature) => feature.id !== featureId));
  }

  function handleCellConfirmationChange(confirmed) {
    if (!selectedDriver || !selectedCell || !Array.isArray(activeSchedule)) return;
    const key = cellReviewKey(selectedDriver.id, selectedCell.day);
    commitScheduleEdit(activeSchedule, activeMapFeatures, {
      ...activeCellStatuses,
      [key]: confirmed,
    });
  }

  function handleExportSchedule() {
    if (!Array.isArray(activeSchedule)) return;
    const existingNumbers = [
      ...BUILT_IN_VERSION_ORDER,
      ...uploadedSchedules.map((schedule) => schedule.id),
    ].map((version) => Number(version.match(/^v(\d+)$/)?.[1] ?? 0));
    let lastExportNumber = 0;
    try {
      lastExportNumber = Number(window.localStorage.getItem("baguio-driver-last-export-number")) || 0;
    } catch { /* A download remains available even if browser storage is disabled. */ }
    const versionNumber = Math.max(4, lastExportNumber, ...existingNumbers) + 1;
    const exportVersion = `v${versionNumber}`;
    const exportData = createScheduleExport({
      version: exportVersion,
      basedOn: activeVersion,
      schedule: activeSchedule,
      mapFeatures: activeMapFeatures,
      cellStatuses: activeCellStatuses,
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `driver_schedule_${exportVersion}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    try {
      window.localStorage.setItem("baguio-driver-last-export-number", String(versionNumber));
    } catch { /* The downloaded file is already complete. */ }
    setEditMessage(`Exported ${link.download}. The selected source JSON was not changed.`);
  }

  const selectedDriver = selectedCell
    ? scheduleModel?.drivers.find((driver) => driver.id === selectedCell.driverId) ?? null
    : null;
  const unfilteredCellAreas = useMemo(
    () => selectedDriver && selectedCell
      ? getAreasForCell(selectedDriver, selectedCell.day, ALL_BARANGAYS)
      : [],
    [selectedDriver, selectedCell],
  );
  const fixedCellAreas = useMemo(
    () => unfilteredCellAreas.filter((area) => !isQrtAreaName(
      area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName,
    )),
    [unfilteredCellAreas],
  );
  const hasQrtAssignment = unfilteredCellAreas.some((area) => isQrtAreaName(
    area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName,
  ));
  const qrtPreviousAreas = useMemo(() => {
    if (!selectedDriver || !scheduleModel) return [];

    const groupedAreas = new Map();
    for (const otherDriver of scheduleModel.drivers) {
      if (otherDriver.id === selectedDriver.id) continue;
      for (const [previousDay, entries] of Object.entries(otherDriver.days)) {
        for (const entry of entries) {
          for (const area of entry.areas) {
            const areaName = area.areaName || area.sourceAreaName || area.barangay || area.dayAreaName;
            const normalizedName = normalizedScheduleLabel(areaName);
            if (!normalizedName || isQrtAreaName(areaName)) continue;

            const id = `${otherDriver.id}::${previousDay}::${normalizedName}`;
            const previousArea = groupedAreas.get(id) ?? {
              id,
              driverName: otherDriver.name,
              day: previousDay,
              areaName,
              sites: new Map(),
            };
            for (const site of area.sites) {
              if (!site.hasCoordinates || site.catalogStatus === "removed" || isUndefinedFiringLineSite(site)) continue;
              previousArea.sites.set(site.id, site);
            }
            groupedAreas.set(id, previousArea);
          }
        }
      }
    }

    return [...groupedAreas.values()].map((area) => ({
      ...area,
      sites: [...area.sites.values()],
    }));
  }, [scheduleModel, selectedDriver]);
  const filterBarangays = useMemo(
    () => selectedCell
      ? getBarangaysForAreas(fixedCellAreas)
      : scheduleModel?.barangays ?? [],
    [selectedCell, fixedCellAreas, scheduleModel],
  );
  const allCellSites = useMemo(
    () => getSitesForAreas(fixedCellAreas).filter((site) => !isUndefinedFiringLineSite(site)),
    [fixedCellAreas],
  );
  const allCellMappedSites = useMemo(
    () => allCellSites.filter((site) => site.hasCoordinates && site.catalogStatus !== "removed"),
    [allCellSites],
  );
  const allCellRemovedSiteCount = allCellSites.filter((site) => site.catalogStatus === "removed").length;
  const allCellActiveSiteRecordCount = allCellSites.length - allCellRemovedSiteCount;
  const allCellUnmappedCount = allCellActiveSiteRecordCount - allCellMappedSites.length;
  const undefinedFiringLines = useMemo(
    () => fixedCellAreas.flatMap((area) => [
      ...area.sites
        .filter(isUndefinedFiringLineSite)
        .map((site) => ({
          id: site.id,
          kind: "firing_line",
          areaId: area.id,
          areaName: site.sourceAreaName || area.sourceAreaName || area.areaName || area.dayAreaName,
        })),
      ...(area.unmappedSegments ?? [])
        .filter((segment) => segment.type === "route" && segment.coordinates.length < 2)
        .map((segment) => ({
          id: `${area.id}-unmapped-route-${segment.sourceIndex}`,
          kind: "route",
          areaId: area.id,
          name: segment.name,
          areaName: segment.name || area.sourceAreaName || area.areaName || area.dayAreaName,
          coordinates: segment.coordinates,
          mapBarangays: area.mapBarangays,
          sourceRef: { ...area.sourceRef, segmentIndex: segment.sourceIndex },
        })),
    ]),
    [fixedCellAreas],
  );
  const scheduleRouteFiringLines = useMemo(
    () => fixedCellAreas.flatMap((area) => (area.unmappedSegments ?? [])
      .filter((segment) => segment.type === "route" && segment.coordinates.length >= 2)
      .map((segment) => ({
        id: `${area.id}-unmapped-route-${segment.sourceIndex}`,
        feature_type: "firing_line",
        name: segment.name,
        coordinates: segment.coordinates,
        area_ids: [area.id],
        area_names: [area.areaName].filter(Boolean),
        barangays: area.mapBarangays,
        sourceRef: { ...area.sourceRef, segmentIndex: segment.sourceIndex },
      }))),
    [fixedCellAreas],
  );
  const selectedFiringLines = useMemo(() => {
    if (!selectedDriver || !selectedCell) return [];
    const cellMapFeatures = activeMapFeatures.filter((feature) => {
      const featureDriverId = feature.driver_id ||
        scheduleModel?.drivers.find((driver) => driver.name === feature.driver)?.id;
      return featureDriverId === selectedDriver.id && feature.day === selectedCell.day;
    });
    return [...cellMapFeatures, ...scheduleRouteFiringLines];
  }, [activeMapFeatures, scheduleModel, scheduleRouteFiringLines, selectedCell, selectedDriver]);
  function findScheduleRouteFeature(featureId) {
    return [...selectedFiringLines, ...undefinedFiringLines].find((feature) =>
      feature.id === featureId && feature.sourceRef?.segmentIndex !== undefined,
    ) ?? null;
  }
  const selectedCellReviewKey = selectedDriver && selectedCell
    ? cellReviewKey(selectedDriver.id, selectedCell.day)
    : "";
  const selectedCellConfirmed = Boolean(activeCellStatuses[selectedCellReviewKey]);
  const selectedCellNotes = useMemo(() => {
    if (!selectedDriver || !selectedCell) return [];

    const areaGroups = groupAreaAssignments(unfilteredCellAreas);
    const areaWarnings = areaGroups.filter((group) => group.warning).length;
    const allCellSites = getSitesForAreas(fixedCellAreas).filter((site) => !isUndefinedFiringLineSite(site));
    const removedCount = allCellSites.filter((site) => site.catalogStatus === "removed").length;
    const activeSiteCount = allCellSites.length - removedCount;
    const mappedSiteCount = allCellSites.filter(
      (site) => site.hasCoordinates && site.catalogStatus !== "removed",
    ).length;
    const unmappedSiteCount = activeSiteCount - mappedSiteCount;
    const cellFeatures = selectedFiringLines;
    const firingLineCount = cellFeatures.filter((feature) => feature.feature_type === "firing_line").length;
    const undefinedFiringLineCount = undefinedFiringLines.filter((feature) => feature.kind === "firing_line").length;
    const undefinedRouteCount = undefinedFiringLines.filter((feature) => feature.kind === "route").length;
    const boundedAreaCount = cellFeatures.filter((feature) => feature.feature_type === "bounded_area").length;
    const areaNames = [...new Set(areaGroups.map((group) => group.areaName).filter(Boolean))];

    return [
      `Assigned area names (${areaNames.length}): ${areaNames.length > 0 ? areaNames.join(", ") : "none recorded"}.`,
      areaWarnings > 0
        ? `${areaWarnings} area group${areaWarnings === 1 ? " has" : "s have"} map-data notes.`
        : "Area map checks have no reported issues.",
      `Collection sites: ${mappedSiteCount} mapped${unmappedSiteCount > 0 ? `, ${unmappedSiteCount} without usable coordinates` : ""}${removedCount > 0 ? `, ${removedCount} marked removed` : ""}.`,
      firingLineCount > 0
        ? `Firing lines: ${firingLineCount} defined for this cell.`
        : "Firing lines: none saved as map features for this cell.",
      ...(undefinedFiringLineCount > 0
        ? [`${undefinedFiringLineCount} schedule firing-line record${undefinedFiringLineCount === 1 ? " has" : "s have"} no coordinates; select its area to view it in Firing lines and areas.`]
        : []),
      ...(undefinedRouteCount > 0
        ? [`${undefinedRouteCount} route segment${undefinedRouteCount === 1 ? " has" : "s have"} no map coordinates; select its area to view it in Firing lines and areas.`]
        : []),
      boundedAreaCount > 0
        ? `Bounded areas: ${boundedAreaCount} defined for this cell.`
        : "Bounded areas: none defined for this cell.",
      `Cell confirmation: ${selectedCellConfirmed ? "confirmed" : "not confirmed"}.`,
    ];
  }, [
    allCellSites,
    selectedFiringLines,
    undefinedFiringLines,
    selectedCell,
    selectedCellConfirmed,
    selectedDriver,
    unfilteredCellAreas,
    fixedCellAreas,
  ]);
  const fallbackMapCenter = useMemo(() => {
    const selectedAreaSite = fixedCellAreas.flatMap((area) => area.sites).find((site) => site.hasCoordinates);
    if (selectedAreaSite) return [selectedAreaSite.latitude, selectedAreaSite.longitude];

    for (const driver of scheduleModel?.drivers ?? []) {
      for (const dayEntries of Object.values(driver.days)) {
        for (const entry of dayEntries) {
          for (const area of entry.areas) {
            const site = area.sites.find((item) => item.hasCoordinates);
            if (site) return [site.latitude, site.longitude];
          }
        }
      }
    }
    const sourceSite = siteIndex?.sourceSites?.find((site) => site.status === "active");
    return sourceSite ? [sourceSite.latitude, sourceSite.longitude] : null;
  }, [scheduleModel, fixedCellAreas, siteIndex]);
  const activeScheduleName = BUILT_IN_VERSIONS.has(activeVersion)
    ? `driver_schedule_${activeVersion}.json`
    : activeUploadedSchedule?.name ?? activeVersion;

  function handleTabKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextTab = activeTab === "schedule" ? "dashboard" : "schedule";
    setActiveTab(nextTab);
    document.getElementById(`app-tab-${nextTab}`)?.focus();
  }

  return (
    <main className="app-shell">
      <div className="sticky-header">
        <header className="app-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
            <div>
              <p className="brand-kicker">Baguio City · Waste collection</p>
              <p className="brand-name">Route desk</p>
            </div>
          </div>
        </header>
        <nav className="app-tabs" role="tablist" aria-label="Route desk views">
          <button
            id="app-tab-schedule"
            className={`app-tab${activeTab === "schedule" ? " app-tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            aria-controls="app-tab-panel"
            tabIndex={activeTab === "schedule" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setActiveTab("schedule")}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M6.5 2.8v3M13.5 2.8v3M3 8h14M6.5 11h2M11.5 11h2M6.5 14h2" /></svg>
            Schedule
          </button>
          <button
            id="app-tab-dashboard"
            className={`app-tab${activeTab === "dashboard" ? " app-tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "dashboard"}
            aria-controls="app-tab-panel"
            tabIndex={activeTab === "dashboard" ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => setActiveTab("dashboard")}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>
            Dashboard
          </button>
        </nav>
        {((scheduleModel && (activeTab === "dashboard" || !selectedCell)) ||
          (!scheduleModel && noSchedulesAvailable && activeTab === "schedule")) && (
          <div className="toolbar-row">
            <ScheduleVersionControl
              activeVersion={activeVersion}
              availableBuiltInVersions={availableBuiltInVersions}
              hasHiddenBuiltInVersions={hiddenBuiltInVersions.length > 0}
              uploadedSchedules={uploadedSchedules}
              activeFileName={BUILT_IN_VERSIONS.has(activeVersion) ? `driver_schedule_${activeVersion}.json` : activeUploadedSchedule?.name ?? ""}
              canDeleteActiveSchedule={availableBuiltInVersions.includes(activeVersion) || Boolean(activeUploadedSchedule)}
              uploadMessage={uploadMessage}
              uploadError={uploadError}
              onVersionChange={handleVersionChange}
              onUpload={handleScheduleUpload}
              onDeleteSchedule={handleScheduleDelete}
              onRestoreBuiltInSchedules={handleRestoreBuiltInSchedules}
            />
            {scheduleModel && scheduleModel.drivers.length > 0 && activeTab === "schedule" && !selectedCell && (
              <DriverFilter
                drivers={scheduleModel.drivers}
                value={selectedDriverId}
                onChange={setSelectedDriverId}
              />
            )}
            {scheduleModel && (
              <button className="export-schedule-button" type="button" onClick={handleExportSchedule}>
                Export new JSON
              </button>
            )}
            {editMessage && <span className="schedule-edit-status" role="status">{editMessage}</span>}
          </div>
        )}
      </div>

      <div
        id="app-tab-panel"
        className="app-tab-panel"
        role="tabpanel"
        aria-labelledby={`app-tab-${activeTab}`}
        tabIndex={-1}
      >
        {activeTab === "schedule" && !selectedCell && !loadError && (
          noSchedulesAvailable || (scheduleModel && scheduleModel.drivers.length === 0)
        ) ? (
          <WeeklySchedule
            drivers={[]}
            emptyCalendar
            version={activeVersion || "v4"}
            onSelectCell={setSelectedCell}
          />
        ) : !scheduleModel ? (
          <section className={`data-load-state${loadError ? " data-load-state--error" : ""}`} role="status">
            <span className="data-load-symbol" aria-hidden="true">{loadError ? "!" : "…"}</span>
            <div>
              <h2>{loadError ? "Schedule data could not be loaded" : activeVersion ? "Loading schedules" : "No schedule files available"}</h2>
              <p>{loadError || (activeVersion ? "Reading the selected schedule and SWMD site index." : "Add a JSON file or restore bundled files to continue.")}</p>
            </div>
          </section>
        ) : activeTab === "dashboard" ? (
          <Dashboard
            scheduleModel={scheduleModel}
            mapFeatures={activeMapFeatures}
            scheduleName={activeScheduleName}
          />
        ) : selectedDriver && selectedCell && hasQrtAssignment ? (
          <QrtHistoryView
            driver={selectedDriver}
            day={selectedCell.day}
            areas={qrtPreviousAreas}
            onBack={() => setSelectedCell(null)}
          />
        ) : selectedDriver && selectedCell ? (
          <SiteMap
            driver={selectedDriver}
            day={selectedCell.day}
            cellAreas={unfilteredCellAreas}
            barangays={filterBarangays}
            qrtPreviousAreas={qrtPreviousAreas}
            sites={allCellMappedSites}
            areaLocationSites={siteIndex?.sourceSites ?? []}
            siteRecords={allCellActiveSiteRecordCount}
            unmappedCount={allCellUnmappedCount}
            removedSiteCount={allCellRemovedSiteCount}
            fallbackCenter={fallbackMapCenter}
            firingLines={selectedFiringLines}
            undefinedFiringLines={undefinedFiringLines}
            saveMessage={editMessage}
            cellNotes={selectedCellNotes}
            cellConfirmed={selectedCellConfirmed}
            scheduleIssues={scheduleModel.issues}
            scheduleContextNotes={scheduleModel.contextNotes}
            showV3Reports={activeVersion === "v3"}
            onCellConfirmationChange={handleCellConfirmationChange}
            onBack={() => setSelectedCell(null)}
            onAddSite={handleAddSite}
            onSaveSite={handleSaveSite}
            onDeleteSite={handleDeleteSite}
            onAddFiringLine={handleAddFiringLine}
            onUpdateFiringLine={handleUpdateFiringLine}
            onDeleteFiringLine={handleDeleteFiringLine}
          />
        ) : (
          <>
              <DataNotes
                mode="panel"
                issues={scheduleModel.issues}
                contextNotes={scheduleModel.contextNotes}
                showV3Reports={activeVersion === "v3"}
              />
              <WeeklySchedule
                drivers={scheduleModel.drivers}
                selectedDriverId={selectedDriverId}
                cellStatuses={activeCellStatuses}
                version={activeVersion}
                onSelectCell={setSelectedCell}
              />
          </>
        )}
      </div>

      <footer className="app-footer">
        <span>
          Schedule: <code>{activeScheduleName || "No schedule selected"}</code>
          {BUILT_IN_VERSIONS.has(activeVersion) && <> · Site reference: SWMD index</>}
        </span>
        <span>Map tiles: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></span>
      </footer>
    </main>
  );
}
