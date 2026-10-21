import { cols, field, type PageDefinition } from '../pageTypes';

export const collectionSites: PageDefinition = {
  path:'/lgu/collection_route', section:'Collection Sites', title:'Manage Collection Sites', heading:'Collection Site', description:'View and manage City Waste Collection Sites', addLabel:'Add New Site',
  columns:cols([['barangay','Barangay'],['purok','Purok'],['site','Site'],['coordinates','Coordinates'],['remarks','Remarks'],['created','Date Created'],['updated','Last Updated']]),
  fields:[field('barangay','Barangay'),field('purok','Purok','text',false),field('site','Collection Site'),field('latitude','Latitude'),field('longitude','Longitude'),field('remarks','Remarks','textarea',false,undefined,true)],
  records:[{id:1,barangay:'Camp 7',purok:'—',site:'Market Access Road',coordinates:'16.381812, 120.605679',remarks:'—',created:'Oct 7, 2026',updated:'Oct 7, 2026'},{id:2,barangay:'Session Road Area',purok:'Purok 2',site:'Burnham Park Gate',coordinates:'16.410583, 120.594671',remarks:'Morning pickup',created:'Oct 6, 2026',updated:'Oct 6, 2026'},{id:3,barangay:'Padre Burgos',purok:'Purok 6',site:'City Hall Annex',coordinates:'16.422085, 120.590057',remarks:'Use rear entrance',created:'Oct 5, 2026',updated:'Oct 5, 2026'},{id:4,barangay:'Irisan',purok:'Purok 3',site:'Community Center',coordinates:'16.408813, 120.595856',remarks:'—',created:'Sep 27, 2026',updated:'Sep 27, 2026'}],
};
