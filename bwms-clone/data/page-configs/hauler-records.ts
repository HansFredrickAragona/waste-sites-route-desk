import { cols, field, type PageDefinition } from '../pageTypes';

export const haulerRecords: PageDefinition = {
  path:'/haulers/hauler-records', section:'Hauling Informations', title:'Manage Hauler Information', heading:"Private Hauler's Information", description:"View and manage Hauler's Information", addLabel:'Add New Hauler',
  columns:cols([['status','Status'],['company','Company Name'],['contact','Contact Number'],['facility','Final Waste Disposal / Processing Facility'],['updated','Last Updated']]),
  fields:[field('company','Company Name'),field('contact','Contact Number','text',false),field('facility','Final Waste Disposal / Processing Facility','textarea',false)],
  records:[{id:1,status:'Active',company:'North Valley Hauling',contact:'(074) 442 1001',facility:'Irisan Disposal Facility',updated:'Sep 27, 2026'},{id:2,status:'Active',company:'Cordillera Waste Services',contact:'(074) 442 1002',facility:'Tuba Processing Center',updated:'Sep 26, 2026'},{id:3,status:'Inactive',company:'Mountain Clean Transport',contact:'(074) 442 1003',facility:'Baguio Recovery Center',updated:'Sep 24, 2026'}],
};
