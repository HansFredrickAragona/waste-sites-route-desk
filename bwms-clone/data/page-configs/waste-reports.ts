import { cols, field, type PageDefinition } from '../pageTypes';

export const wasteReports: PageDefinition = {
  path:'/lgu/management-records', section:'Waste Reports', title:'Manage Waste Records', heading:'City Waste Reports', description:'View and manage city waste records', addLabel:'Add Record', exportLabel:'Export Report', dateFilter:true,
  columns:cols([['status','Status'],['date','Date Collected'],['plate','Plate No.'],['gross','Gross (kg)'],['tare','Tare (kg)'],['net','Net (kg)'],['departure','Departure'],['arrival','Arrival'],['source','Source'],['driver','Driver'],['updated','Last Updated']]),
  fields:[field('plate','Plate Number','select',true,['BGU 4210','BGU 4211','BGU 4212','BGU 4213']),field('gross','Truck Weight (kg)','number'),field('sourceSites','Collection Sites','text',false),field('arrivedAt','Arrival Date & Time','datetime-local'),field('departureAt','Departure Date & Time','datetime-local',false),field('status','Status','select',true,['Arrived','Pending Departure','Completed'])],
  records:[
    {id:1,status:'Pending Departure',date:'Oct 8, 2026',plate:'BGU 4210',gross:'4,860 kg',tare:'2,140 kg',net:'2,720 kg',departure:'—',departureAt:'',arrival:'7:12 AM',arrivedAt:'2026-10-08T07:12',source:'Market Access Road, Burnham Park Gate',sourceSites:'Market Access Road, Burnham Park Gate',driver:'Alex Reyes',updated:'Oct 8, 2026'},
    {id:2,status:'Arrived',date:'Oct 8, 2026',plate:'BGU 4212',gross:'5,120 kg',tare:'2,210 kg',net:'2,910 kg',departure:'—',departureAt:'',arrival:'8:05 AM',arrivedAt:'2026-10-08T08:05',source:'Market Access Road',sourceSites:'Market Access Road',driver:'Jordan Cruz',updated:'Oct 8, 2026'},
    {id:3,status:'Completed',date:'Oct 7, 2026',plate:'BGU 4211',gross:'4,430 kg',tare:'2,080 kg',net:'2,350 kg',departure:'11:03 AM',departureAt:'2026-10-07T11:03',arrival:'7:00 AM',arrivedAt:'2026-10-07T07:00',source:'Community Center',sourceSites:'Community Center',driver:'Mina Santos',updated:'Oct 7, 2026'},
    {id:4,status:'Completed',date:'Oct 7, 2026',plate:'BGU 4210',gross:'4,650 kg',tare:'2,140 kg',net:'2,510 kg',departure:'12:25 PM',departureAt:'2026-10-07T12:25',arrival:'8:15 AM',arrivedAt:'2026-10-07T08:15',source:'Market Access Road',sourceSites:'Market Access Road',driver:'Alex Reyes',updated:'Oct 7, 2026'},
    {id:5,status:'Pending Departure',date:'Oct 6, 2026',plate:'BGU 4212',gross:'5,040 kg',tare:'2,210 kg',net:'2,830 kg',departure:'—',departureAt:'',arrival:'10:42 AM',arrivedAt:'2026-10-06T10:42',source:'Burnham Park Gate',sourceSites:'Burnham Park Gate',driver:'Jordan Cruz',updated:'Oct 6, 2026'},
    {id:6,status:'Completed',date:'Oct 5, 2026',plate:'BGU 4211',gross:'4,780 kg',tare:'2,080 kg',net:'2,700 kg',departure:'11:34 AM',departureAt:'2026-10-05T11:34',arrival:'7:05 AM',arrivedAt:'2026-10-05T07:05',source:'Community Center',sourceSites:'Community Center',driver:'Mina Santos',updated:'Oct 5, 2026'},
  ],
};
