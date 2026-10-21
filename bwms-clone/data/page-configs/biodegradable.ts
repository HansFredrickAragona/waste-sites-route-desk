import { cols, field, type PageDefinition } from '../pageTypes';

export const biodegradable: PageDefinition = {
  path:'/biodegradable', section:'Biodegradable', title:'Manage Biodegradable Records', heading:'Biodegradable Records', description:'View and manage biodegradable feed records', addLabel:'Add Record', exportLabel:'Export Report', dateFilter:true,
  columns:cols([['date','Date'],['feedTime','Feed Time'],['volume','Volume (kg)'],['bed','Bed No.'],['establishment','Establishment'],['source','Source'],['from','From'],['inputDate','Date Input'],['updated','Last Updated']]),
  fields:[field('date','Record Date','date'),field('feedTime','Feed Time','time'),field('volume','Volume (kg)','number'),field('bed','Bed Number'),field('establishment','Establishment'),field('source','Source'),field('from','From','select',true,['Waste Transfer Station','ERS','City Collection'])],
  records:[
    {id:1,date:'Oct 7, 2026',feedTime:'8:30 AM',volume:'245.00',bed:'2',establishment:'Green Valley Farm',source:'City Market',from:'Waste Transfer Station',inputDate:'Oct 7, 2026',updated:'Oct 7, 2026'},
    {id:2,date:'Oct 6, 2026',feedTime:'10:00 AM',volume:'186.00',bed:'3',establishment:'Baguio Compost Site',source:'Public Market',from:'ERS',inputDate:'Oct 6, 2026',updated:'Oct 6, 2026'},
    {id:3,date:'Oct 5, 2026',feedTime:'9:15 AM',volume:'212.00',bed:'1',establishment:'Green Valley Farm',source:'City Collection',from:'Waste Transfer Station',inputDate:'Oct 5, 2026',updated:'Oct 5, 2026'},
    {id:4,date:'Oct 4, 2026',feedTime:'11:20 AM',volume:'98.00',bed:'4',establishment:'Baguio Compost Site',source:'Market Area',from:'ERS',inputDate:'Oct 4, 2026',updated:'Oct 4, 2026'},
    {id:5,date:'Oct 3, 2026',feedTime:'8:45 AM',volume:'174.00',bed:'2',establishment:'Green Valley Farm',source:'City Market',from:'Waste Transfer Station',inputDate:'Oct 3, 2026',updated:'Oct 3, 2026'},
    {id:6,date:'Oct 2, 2026',feedTime:'9:40 AM',volume:'231.00',bed:'3',establishment:'Baguio Compost Site',source:'City Collection',from:'ERS',inputDate:'Oct 2, 2026',updated:'Oct 2, 2026'},
    {id:7,date:'Oct 1, 2026',feedTime:'8:10 AM',volume:'153.00',bed:'1',establishment:'Green Valley Farm',source:'Public Market',from:'Waste Transfer Station',inputDate:'Oct 1, 2026',updated:'Oct 1, 2026'},
  ],
};
