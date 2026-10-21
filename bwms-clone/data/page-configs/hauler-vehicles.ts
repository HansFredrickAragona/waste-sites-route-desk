import { cols, field, type PageDefinition } from '../pageTypes';

export const haulerVehicles: PageDefinition = {
  path:'/haulers/hauler-vehicle-records', section:'Vehicle Informations', title:'Manage Hauler Trucks', heading:'Hauler Trucks', description:'View and manage Hauler Trucks', addLabel:'Add New Hauler Truck',
  columns:cols([['status','Status'],['plate','Plate Number'],['company','Company Name'],['facility','Final Waste Disposal / Processing Facility'],['updated','Last Updated']]),
  fields:[field('plate','Plate Number'),field('company','Hauling Company','select',true,['North Valley Hauling','Cordillera Waste Services']),field('facility','Final Waste Disposal / Processing Facility'),field('status','Availability','select',true,['Available','Unavailable'])],
  records:[{id:1,status:'Available',plate:'TST 1001',company:'North Valley Hauling',facility:'Irisan Disposal Facility',updated:'Sep 27, 2026'},{id:2,status:'Available',plate:'TST 1002',company:'Cordillera Waste Services',facility:'Tuba Processing Center',updated:'Sep 26, 2026'},{id:3,status:'Unavailable',plate:'TST 1003',company:'North Valley Hauling',facility:'Irisan Disposal Facility',updated:'Sep 24, 2026'}],
};
