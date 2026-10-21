import { cols, field, type PageDefinition } from '../pageTypes';

export const vehicleRecords: PageDefinition = {
  path:'/lgu/vehicle-records', section:'Vehicle Informations', title:'Manage LGU Trucks', heading:'LGU - Baguio City Trucks', description:'View and manage City Waste Management trucks', addLabel:'Add New Truck',
  columns:cols([['status','Status'],['year','Year Model'],['make','Make'],['plate','Plate No.'],['driver','Assigned Driver'],['tare','Tare Weight'],['updated','Last Updated']]),
  fields:[field('year','Vehicle Year Model'),field('make','Vehicle Make'),field('plate','Plate Number'),field('driver','Assigned Driver','select',true,['Alex Reyes','Mina Santos','Jordan Cruz','Rafael Dizon']),field('tare','Tare Weight (kg)','number')],
  records:[{id:1,status:'On Duty',year:'2022',make:'Isuzu',plate:'BGU 4210',driver:'Alex Reyes',tare:'2,140 kg',updated:'Oct 7, 2026'},{id:2,status:'On Duty',year:'2021',make:'Hino',plate:'BGU 4211',driver:'Mina Santos',tare:'2,080 kg',updated:'Oct 6, 2026'},{id:3,status:'Under Repair',year:'2019',make:'Isuzu',plate:'BGU 4212',driver:'Jordan Cruz',tare:'2,210 kg',updated:'Oct 5, 2026'},{id:4,status:'On Duty',year:'2024',make:'Fuso',plate:'BGU 4213',driver:'Rafael Dizon',tare:'2,340 kg',updated:'Sep 27, 2026'}],
};
