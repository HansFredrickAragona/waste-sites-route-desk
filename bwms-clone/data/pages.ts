import type { PageDefinition, RecordRow } from './pageTypes';
import { wasteCollectionSchedules } from './page-configs/waste-collection-schedules';
import { biodegradable } from './page-configs/biodegradable';
import { wasteReports } from './page-configs/waste-reports';
import { driverRecords } from './page-configs/driver-records';
import { vehicleRecords } from './page-configs/vehicle-records';
import { collectionSites } from './page-configs/collection-sites';
import { haulingReports } from './page-configs/hauling-reports';
import { haulerRecords } from './page-configs/hauler-records';
import { haulerVehicles } from './page-configs/hauler-vehicles';
import { recyclableReports } from './page-configs/recyclable-reports';
import { junkshopRecords } from './page-configs/junkshop-records';
import { recyclableVehicles } from './page-configs/recyclable-vehicles';
import { recyclableItems } from './page-configs/recyclable-items';

export type { Column, Field, PageDefinition, RecordRow } from './pageTypes';

export const pageRegistry: Record<string, PageDefinition> = {
  [wasteCollectionSchedules.path]: wasteCollectionSchedules,
  [biodegradable.path]: biodegradable,
  [wasteReports.path]: wasteReports,
  [driverRecords.path]: driverRecords,
  [vehicleRecords.path]: vehicleRecords,
  [collectionSites.path]: collectionSites,
  [haulingReports.path]: haulingReports,
  [haulerRecords.path]: haulerRecords,
  [haulerVehicles.path]: haulerVehicles,
  [recyclableReports.path]: recyclableReports,
  [junkshopRecords.path]: junkshopRecords,
  [recyclableVehicles.path]: recyclableVehicles,
  [recyclableItems.path]: recyclableItems,
};

export const seedRecords = (): Record<string, RecordRow[]> => Object.fromEntries(
  Object.entries(pageRegistry).map(([path, page]) => [path, page.records.map((record) => ({ ...record }))]),
);

export const navigationGroups = [
  { label: 'Overview', items: [{ label: 'Summary of Data', path: '/' }] },
  { label: 'City Records', items: [
    { label: 'Waste Reports', path: '/lgu/management-records' },
    { label: 'Driver Informations', path: '/lgu/driver-records' },
    { label: 'Vehicle Informations', path: '/lgu/vehicle-records' },
    { label: 'Collection Sites', path: '/lgu/collection_route' },
  ] },
  { label: 'Services', items: [
    { label: 'Collection Schedule', path: '/waste-collection-schedules' },
    { label: 'Biodegradable', path: '/biodegradable' },
  ] },
  { label: 'Private Hauler', items: [
    { label: 'Residual Reports', path: '/haulers/hauling-reports' },
    { label: 'Hauling Informations', path: '/haulers/hauler-records' },
    { label: 'Vehicle Informations', path: '/haulers/hauler-vehicle-records' },
  ] },
  { label: 'Junkshops', items: [
    { label: 'Collection Reports', path: '/recyclables/recyclable-reports' },
    { label: 'Junkshop Informations', path: '/recyclables/recyclable-company-records' },
    { label: 'Vehicles Informations', path: '/recyclables/recyclable-vehicles-records' },
    { label: 'Category Items', path: '/recyclables/recyclable-waste-items' },
  ] },
];
