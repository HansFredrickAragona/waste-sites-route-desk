import { cols, field, type PageDefinition } from '../pageTypes';

export const junkshopRecords: PageDefinition = {
  path:'/recyclables/recyclable-company-records', section:'Junkshop Informations', title:'Manage Junkshop Information', heading:"Junkshop's Information", description:"View and manage Junkshop's Information", addLabel:'Add New Company',
  columns:cols([['status','Status'],['company','Company Name'],['contact','Contact Number'],['updated','Last Updated']]),
  fields:[field('company','Company Name'),field('contact','Contact Number','text',false)],
  records:[{id:1,status:'Active',company:'Mountain Recyclables',contact:'(074) 445 2100',updated:'Sep 27, 2026'},{id:2,status:'Active',company:'Baguio Eco Traders',contact:'(074) 445 2101',updated:'Sep 24, 2026'},{id:3,status:'Active',company:'Cordillera Paper Recovery',contact:'(074) 445 2102',updated:'Sep 24, 2026'},{id:4,status:'Inactive',company:'Northside Materials',contact:'(074) 445 2103',updated:'Sep 23, 2026'}],
};
