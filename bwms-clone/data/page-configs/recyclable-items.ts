import { cols, field, type PageDefinition } from '../pageTypes';

export const recyclableItems: PageDefinition = {
  path:'/recyclables/recyclable-waste-items', section:'Category Items', title:'Manage Recyclable Items', heading:'Recyclable Materials', description:'Manage recyclable item categories', addLabel:'Add New Item',
  columns:cols([['name','Waste Item Name'],['created','Date Input'],['updated','Last Updated']]),
  fields:[field('name','Waste Item Name')],
  records:[{id:1,name:'Cardboard',created:'Oct 7, 2026',updated:'Oct 7, 2026'},{id:2,name:'Flexible Plastic',created:'Sep 27, 2026',updated:'Sep 27, 2026'},{id:3,name:'Aluminum',created:'Sep 24, 2026',updated:'Sep 24, 2026'},{id:4,name:'Glass Bottles',created:'Sep 24, 2026',updated:'Sep 24, 2026'},{id:5,name:'Paper',created:'Sep 24, 2026',updated:'Sep 24, 2026'}],
};
