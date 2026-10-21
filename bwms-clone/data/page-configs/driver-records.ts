import { cols, field, type PageDefinition } from '../pageTypes';

export const driverRecords: PageDefinition = {
  path:'/lgu/driver-records', section:'Driver Informations', title:'Manage Drivers', heading:'Drivers', description:'View and manage City Waste Management Drivers', addLabel:'Add New Driver',
  columns:cols([['status','Status'],['name','Assigned Driver'],['weight','Weight (kg)'],['updated','Last Updated']]),
  fields:[field('firstName','First Name'),field('middleName','Middle Name','text',false),field('lastName','Last Name'),field('suffix','Suffix','text',false),field('weight','Weight (kg)','number')],
  records:[{id:1,status:'Active',name:'Alex Reyes',weight:'72 kg',updated:'Oct 7, 2026'},{id:2,status:'Active',name:'Mina Santos',weight:'64 kg',updated:'Oct 7, 2026'},{id:3,status:'Inactive',name:'Jordan Cruz',weight:'78 kg',updated:'Oct 6, 2026'},{id:4,status:'Active',name:'Rafael Dizon',weight:'69 kg',updated:'Oct 5, 2026'},{id:5,status:'Inactive',name:'Jamie Flores',weight:'75 kg',updated:'Sep 27, 2026'}],
};
