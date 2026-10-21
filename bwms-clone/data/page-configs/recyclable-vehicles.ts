import { cols, field, type PageDefinition } from '../pageTypes';

export const recyclableVehicles: PageDefinition = {
  path:'/recyclables/recyclable-vehicles-records', section:'Vehicles Informations', title:'Manage Junkshop Trucks', heading:'Junkshop Trucks', description:'View and manage Junkshop Trucks', addLabel:'Add New Recyclable Truck',
  columns:cols([['status','Status'],['company','Company Name'],['plate','Plate Number'],['updated','Last Updated']]),
  fields:[field('company','Junkshop','select',true,['Mountain Recyclables','Baguio Eco Traders']),field('plate','Plate Number'),field('status','Status','select',true,['Enabled','Disabled'])],
  records:[{id:1,status:'Enabled',company:'Mountain Recyclables',plate:'REC 2001',updated:'Oct 6, 2026'},{id:2,status:'Enabled',company:'Baguio Eco Traders',plate:'REC 2002',updated:'Sep 27, 2026'},{id:3,status:'Disabled',company:'Cordillera Paper Recovery',plate:'REC 2003',updated:'Sep 24, 2026'}],
};
