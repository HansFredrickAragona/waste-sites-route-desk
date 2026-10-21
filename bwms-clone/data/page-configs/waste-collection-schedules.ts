import { cols, field, type PageDefinition } from '../pageTypes';

export const wasteCollectionSchedules: PageDefinition = {
  path: '/waste-collection-schedules', section: 'Collection Schedule', title: 'Waste Collection Schedules', heading: 'City Collection Schedules',
  description: 'View and manage City Collection Schedule', addLabel: 'New Document', exportLabel: 'Export Schedule',
  columns: cols([['status','Status'],['name','Schedule Name'],['rows','Rows'],['active','Active'],['offDuty','Off Duty'],['created','Created']]),
  fields: [field('name','Schedule Name'),field('barangay','Barangay'),field('collectionDay','Collection Day','select',true,['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),field('active','Active Trucks','number'),field('offDuty','Off Duty Trucks','number',false),field('status','Status','select',true,['Active','Partial','Draft'])],
  records: [
    {id:1,status:'Partial',name:'Central District Rotation',rows:4,active:3,offDuty:1,created:'Oct 7, 2026'},
    {id:2,status:'Active',name:'Irisan Collection Schedule',rows:8,active:8,offDuty:0,created:'Oct 6, 2026'},
    {id:3,status:'Active',name:'Camp 7 Weekly Route',rows:5,active:5,offDuty:0,created:'Oct 4, 2026'},
    {id:4,status:'Draft',name:'North District Assignment',rows:3,active:2,offDuty:1,created:'Sep 28, 2026'},
    {id:5,status:'Active',name:'Market Area Schedule',rows:6,active:6,offDuty:0,created:'Sep 22, 2026'},
  ],
};
