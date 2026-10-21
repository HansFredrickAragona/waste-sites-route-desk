"""Apply reviewed area decisions to the v4 schedule research checklist.

Run this before build_driver_schedule_v4.py. It reads the v3-seeded checklist
and the SWMD source rows, filters candidate coordinates by the verified CSV
barangay, and writes the reviewed v4 checklist. It does not edit v3 or source
CSVs.
"""

from __future__ import annotations

import csv
import math
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2] / "data"
CHECKLIST = ROOT / "csvs" / "mapping" / "schedule_area_research_v4.csv"
SWMD = ROOT / "csvs" / "raw" / "SWMD MAP - Baguio_SWMD_Google_MyMaps.csv"
LOOKUP = ROOT / "csvs" / "mapping" / "swmd_coordinate_lookup_v2.csv"
PSA = "https://psa.gov.ph/classification/psgc/barangays/1430300000"


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def distance_km(a: float, b: float, c: float, d: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(value), math.sqrt(1 - value))


# The strings on the right are canonical spellings from the SWMD CSV. An empty
# list means research did not establish a barangay confidently enough to filter.
BARANGAY_OVERRIDES = {
    "17": ["Irisan"],
    "2": ["Bakakeng North"],
    "28 Upper San Carlos Hts.": ["Irisan"],
    "ADD Rd.": ["Irisan"],
    "Agpaoa Rd.": ["Camp 7"],
    "Amsing": ["Pacdal"],
    "Avelino Fairview": ["Fairview Village"],
    "Balacbac": ["Santo Tomas Proper"],
    "Balenben": ["Irisan"],
    "Bengao": ["Bakakeng Central"],
    "Bouganvilla St.": ["Santo Tomas Proper"],
    "Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas": ["Camp 7"],
    "Centermall": ["Legarda-Burnham-Kisad"],
    "Chapis": ["Bakakeng Central"],
    "Crystal Cave Waiting Shed Intersection up to Turning Point": ["Asin Road", "Bakakeng Central"],
    "Crystal Dale Subdivision": ["Bakakeng Central"],
    "Cudirao Rd. (in front of Baptist School)": ["Loakan Proper"],
    "Doclas Cerio Village": ["Pacdal"],
    "Eagle Crest-Phase 1": ["Bakakeng North"],
    "Easter": ["Guisad Central"],
    "Hollywood": ["Bakakeng Central"],
    "Idogan Village": ["Irisan"],
    "Justice/Pucay Village": ["Bakakeng Central"],
    "Kadaclan": ["Apugan-Loakan"],
    "Lexber Subdivision": ["Camp 7"],
    "Liteng (3am-12nn)": ["Pacdal"],
    "Ma. Basa": ["Pacdal"],
    "Magsaysay Drive (Tesda)": ["Loakan Proper"],
    "Market 2 Hangar": ["Market Subdivision, Upper"],
    "Munoz Drive": ["Asin Road"],
    "PHILSCI": ["Irisan"],
    "Pias": ["Camp 7"],
    "Pines Hospital": ["Camdas Subdivision"],
    "Pucay St.": ["Guisad Central"],
    "Purok 15-Agro": ["Irisan"],
    "Purok 16": ["Irisan"],
    "Purok 27": ["Irisan"],
    "Purok 6/7 (Boundary)-Harvester": ["Irisan", "Asin Road"],
    "Quirino Higway": ["Irisan"],
    "Richview Square": ["Bakakeng North"],
    "San Carlos": ["Irisan"],
    "Sariling Sikap": ["Irisan"],
    "Sarok": ["Camp 7"],
    "Siapno Rd.": ["Pacdal"],
    "Smith drive (3am-12nn)": ["Asin Road"],
    "Spring Hills": ["Apugan-Loakan"],
    "St. Patrick Rd.": ["Irisan"],
    "Sto. Ni\u00f1o": ["Bakakeng Central"],
    "Suello Village": ["Bakakeng Central"],
    "UP Village": ["Irisan"],
    "Upper/Lower Cypress": ["Irisan"],
    "Veniz Hotel": ["Abanao-Zandueta-Kayong-Chugum-Otek (AZKCO)", "Session Road Area"],
    "Woodsville (3am-12nn)": ["Camp 7"],
    "Youngland": ["Camp 7"],
    "Youngland to Lions Head": ["Camp 7"],
    "Overpass SLU left side to Rimando Bridge": ["A. Bonifacio-Caguioa-Rimando (ABCR)"],
    "Kitma": ["Bakakeng Central"],
    "Moldex Box": ["Bakakeng Central"],
    "Leonard Wood rd.": ["Cabinet Hill-Teacher's Camp", "Saint Joseph Village", "Outlook Drive", "Gibraltar", "Pacdal"],
}

# Override v3 selections where its barangay-wide carry-over or reverse map
# labels show that the point belongs to a different named route/locality.
SELECTED_OVERRIDES = {
    "17": [],
    "2": [89],  # Eagle Crest Main / Phase 2, Bakakeng North
    "28 Upper San Carlos Hts.": [],
    "ADD Rd.": [340, 341],
    "Agpaoa Rd.": [],
    "Amsing": [507],
    "Avelino Fairview": [],
    "Balenben": [300, 302, 303],
    "Bengao": [56, 57, 58],
    "Bouganvilla St.": [],
    "Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas": [130, 131, 132, 133, 143, 144, 145],
    "Centermall": [],
    "Chapis": [72, 73, 74, 75],
    "Crystal Cave Waiting Shed Intersection up to Turning Point": [27, 28, 66, 69, 70, 71],
    "Cudirao Rd. (in front of Baptist School)": [416],
    "Doclas Cerio Village": [],
    "Eagle Crest-Phase 1": [],
    "Easter": [249],
    "Hollywood": [65],
    "Idogan Village": [],
    "Justice/Pucay Village": [],
    "Kadaclan": [25],
    "Lexber Subdivision": [130, 131, 144],
    "Liteng (3am-12nn)": [508, 509],
    "Ma. Basa": [511, 512, 513],
    "Magsaysay Drive (Tesda)": [424],
    "Market 2 Hangar": [457],
    "Munoz Drive": [32, 33, 34],
    "PHILSCI": [325, 326],
    "Pias": [127],
    "Pines Hospital": [125],
    "Pucay St.": [250],
    "Purok 1 to 6 Irisan": list(range(289, 300)),
    "Purok 12 (Irisan) (3am-12nn)": [307, 323, 324, 325, 326],
    "Purok 15-Agro": [318],
    "Purok 16": [],
    "Purok 27": [349],
    "Purok 6 Asin": [],
    "Purok 6/7 (Boundary)-Harvester": [298, 299],
    "Purok 8-Bakakeng Norte": [],
    "Moldex Box": [77],
    "Leonard Wood rd.": [585],
    "Phase 3 Bakakeng Norte": [87],
    "Richview Square": [],
    "San Carlos": list(range(342, 355)),
    "Sariling Sikap": [335, 336],
    "Sarok": [],
    "Siapno Rd.": [501, 502, 504, 505, 506],
    "Smith drive (3am-12nn)": [],
    "Spring Hills": [23, 24],
    "St. Patrick Rd.": [322, 339],
    "Suello Village": [61],
    "UP Village": [311, 312, 313],
    "Upper/Lower Cypress": [308, 309],
    "Veniz Hotel": [7],
    "Woodsville (3am-12nn)": [137],
    "Youngland": [],
    "Youngland to Lions Head": [],
    # Purok labels are narrower than the earlier v3 barangay selections.
    "18 Irisan": [319, 340, 341],
    "Overpass SLU left side to Rimando Bridge": [2, 3, 4, 5, 6],
    "Camp 7": list(range(126, 146)),
    "Camp 7 (Woodsgate/ Richgate/ Monticello)": [128, 129, 141, 142],
    "Bakakeng Norte (Purok 6,7)": [83],
    "Bakakeng Old Site": [],
    "Camdas": [122, 123, 124, 125],
    "Crystal Dale Subdivision": [67, 68],
    "Kitma": [78, 79, 80, 81, 82],
    "Pacdal Circle": [501],
    "Gibraltar Interior": [],
    "Gibraltar Main road except Cuneta compound and Good Shepherd": [233, 236, 237, 238, 239, 240, 241, 242, 243, 244],
    "Sto. Ni\u00f1o": [51, 52, 53, 54, 55],
    "St. Joseph Brgy. (Navy Base)": [583, 585, 588, 589],
    "Scout Barrio": [645, 647, 648, 649, 650],
    "Kisad st.": [],
    "Legarda": [],
    "Otek st.": [],
    "San Luis": [592, 593, 594, 595, 597, 599],
    "Trancoville": [662, 663, 664, 665, 666, 668],
    "Loakan Proper (Brgy Hall/Welcome Arc)": [417, 418, 421, 426],
    "Loakan Proper (Pidawan-Maridit Rd., MOOG/NFA/BSP)": [419, 420],
    "Loakan Proper-Ongasan/Feeder Rd./CAAP": [412, 413, 414, 415],
    "Quirino Higway": [289, 290, 291, 293, 294, 295, 296, 297, 298, 299],
    "Quirino Hill": [561, 562, 563, 567, 568, 569, 570],
    "Sto. Tomas Central": [623, 624, 625, 626, 627, 628, 630, 631, 632],
}

FALLBACK_OVERRIDES = {
    "17": "blank",
    "2": "blank",
    "28 Upper San Carlos Hts.": "blank",
    "ADD Rd.": "firingline",
    "Agpaoa Rd.": "firingline",
    "Amsing": "none",
    "Avelino Fairview": "blank",
    "Balenben": "firingline",
    "Bengao": "none",
    "Bouganvilla St.": "firingline",
    "Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas": "firingline",
    "Centermall": "blank",
    "Chapis": "firingline",
    "Crystal Cave Waiting Shed Intersection up to Turning Point": "firingline",
    "Cudirao Rd. (in front of Baptist School)": "none",
    "Doclas Cerio Village": "blank",
    "Eagle Crest-Phase 1": "blank",
    "Easter": "none",
    "Hollywood": "none",
    "Idogan Village": "blank",
    "Justice/Pucay Village": "blank",
    "Kadaclan": "none",
    "Lexber Subdivision": "none",
    "Liteng (3am-12nn)": "firingline",
    "Ma. Basa": "firingline",
    "Magsaysay Drive (Tesda)": "none",
    "Market 2 Hangar": "none",
    "Munoz Drive": "firingline",
    "PHILSCI": "firingline",
    "Pias": "firingline",
    "Pines Hospital": "none",
    "Pucay St.": "firingline",
    "Purok 1 to 6 Irisan": "none",
    "Purok 12 (Irisan) (3am-12nn)": "none",
    "Purok 15-Agro": "firingline",
    "Purok 27": "none",
    "Purok 6 Asin": "blank",
    "Purok 6/7 (Boundary)-Harvester": "firingline",
    "Purok 8-Bakakeng Norte": "blank",
    "Quirino Higway": "firingline",
    "Richview Square": "blank",
    "San Carlos": "firingline",
    "Sariling Sikap": "firingline",
    "Sarok": "blank",
    "Siapno Rd.": "firingline",
    "Smith drive (3am-12nn)": "firingline",
    "Spring Hills": "none",
    "St. Patrick Rd.": "firingline",
    "Suello Village": "none",
    "Upper/Lower Cypress": "firingline",
    "Veniz Hotel": "none",
    "Woodsville (3am-12nn)": "none",
    "Youngland": "blank",
    "Youngland to Lions Head": "firingline",
    "18 Irisan": "none",
    "Overpass SLU left side to Rimando Bridge": "firingline",
    "Bakakeng Norte (Purok 6,7)": "blank",
    "Bakakeng Old Site": "blank",
    "Camp 7 (Woodsgate/ Richgate/ Monticello)": "firingline",
    "Kisad st.": "firingline",
    "Legarda": "blank",
    "Otek st.": "firingline",
    "Sto. Tomas Central": "firingline",
    "South/North Sanitary Camp-Yap St.": "firingline",
    "RIC 1 Military Cut-off": "firingline",
    "RIC 2 (3am-12nn) Bokawkan to Magsaysay City Limit": "firingline",
    "RIC 2 Bokawkan to Magsaysay City Limit": "firingline",
    "CBD Session Road Diego Silang": "firingline",
    "Loakan Proper (Brgy Hall/Welcome Arc)": "firingline",
    "Loakan Proper (Pidawan-Maridit Rd., MOOG/NFA/BSP)": "firingline",
    "Loakan Proper-Ongasan/Feeder Rd./CAAP": "firingline",
    "St. Joseph Brgy. (Navy Base)": "blank",
    "Pacdal Circle": "none",
    "Gibraltar Interior": "blank",
    "Gibraltar Main road except Cuneta compound and Good Shepherd": "firingline",
    "Pinsao Proper (Monol/Tam-awan up to Hway Boundary LT)": "firingline",
    "Pinsao Proper-Crusher/Hway before Aguinalde Hrdwre": "firingline",
    "Purok 16": "blank",
    "Dominican/Mirador Hill (St. Theresa St.)": "firingline",
    "Outlook Drive (Highway and Interior)": "firingline",
    "UP Village": "firingline",
    "Phase 3 Bakakeng Norte": "none",
    "Moldex Box": "none",
    "Leonard Wood rd.": "firingline",
}

AMBIGUOUS = {
    "2", "28 Upper San Carlos Hts.", "Avelino Fairview", "APTS. Ambuklao Rd.",
    "Assumption", "Bakbakan (Joaquin Smith NHS) to City Limit", "Balacbac",
    "Bouganvilla St.", "Calderon", "Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas",
    "Celestial to Belshang", "City Limit", "CLARO M. RECTO st.",
    "Crystal Cave Waiting Shed Intersection up to Turning Point", "Cuneta and Good Sheperd",
    "Doclas Cerio Village", "Dr. Cari\u00f1o St.", "Eagle Crest-Phase 1", "Empire",
    "Food Waste Collection", "Food Waste Collection (8am-5pm)", "Gov. Pack",
    "Guevarra St.", "Idogan Village", "IEC/QRT", "IEC/QRT (2pm-11pm)",
    "IEC/QRT (8am-5pm)", "incld. BPI Compd.", "Justice/Pucay Village", "Lakandula",
    "Lower Mabini", "Lower Malvar/Quisumbing", "Manzanillo Subdivision",
    "Mercury/ Silver/ Copper/ Ponce St.", "Minesview/J. Felipe St.", "Montinola st.",
    "Naguilian", "Naguilian road", "Naguillan", "Pacday Junction", "Paraan",
    "Pines Hospital", "PLDT-Naguilian Rd.", "Pyramid", "Recoletos", "Regidor st.",
    "Richview Square", "Richwood Square", "Sarok", "Shangrila Village", "SLU",
    "Smith drive (3am-12nn)", "St Peter's /Teachers Village/ Marcos Highway cor. Suello-Tuba Highway Boundary",
    "Sta. Lucia (3am-12nn)", "Suello Junction", "Summer Ville (Bakakeng)",
    "Summerville (Ambuklao rd.)", "Sumulong", "Sunny side - Tacay Rd.",
    "Tetep-an Village", "UP Village", "Upper Bonifacio", "Upper Malvar St.",
    "Veniz Hotel", "YMCA", "Youngland", "Youngland to Lions Head",
    "(Road 1 to 3)", "(Upper/Mid, East/ West)", "Purok 6/7 (Boundary)-Harvester",
    "17", "Bakakeng Norte (Purok 6,7)", "Bakakeng Old Site",
    "Camp 7 (Woodsgate/ Richgate/ Monticello)", "Kisad st.", "Legarda", "Otek st.", "Purok 16",
    "Gibraltar Interior",
}

SPECIFIC_LOCATIONS = {
    "17": "Purok 17 in Irisan; Mapcarta places it among Puroks 15–18 near the Agro Loop.",
    "18 Irisan": "Purok 18, Irisan, beside Add Road and Elpidio Quirino Highway.",
    "Moldex Box": "Moldex Residences Baguio on Ben Palispis Highway at Crystal Cave Road, Bakakeng Central; the mapped locality point is about 75 m from SWMD row 77.",
    "Leonard Wood rd.": "Leonard Wood Road through its Cabinet Hill-Teachers Camp, Saint Joseph Village, and Outlook Drive/Gibraltar/Pacdal-side segments; the schedule gives no route endpoints, but SWMD row 585 is explicitly mapped on the road in Saint Joseph Village.",
    "Phase 3 Bakakeng Norte": "Eagle Crest Subdivision Phase 3, Bakakeng North; Mapcarta places the neighborhood near 16.38116, 120.59326, about 72 m from SWMD row 87.",
    "Quirino Hill": "The Quirino Hill East, Middle, and West barangays in Baguio; seven of eight source-barangay candidates map to roads/localities in those quarters. Row 566 is on Upper Camdas Road in Camdas and is excluded.",
    "2": "Eagle Crest Subdivision Phase 2, Bakakeng North; SWMD Site 7 is on Eagle Crest Main.",
    "28 Upper San Carlos Hts.": "Purok 28, Upper San Carlos Heights, Irisan; exact Purok 28 extent was not separately mapped.",
    "ADD Rd.": "Add Road in Purok 18, Irisan; the schedule wording indicates a road corridor.",
    "Amsing": "Amsing Street, Purok 2, Pacdal.",
    "Balenben": "Balenben Road and nearby Puroks 8–9, Irisan.",
    "Bengao": "Bengao Road and Bengao neighborhood, Bakakeng Central.",
    "Centermall": "Baguio Center Mall on Magsaysay Avenue, Legarda-Burnham-Kisad.",
    "Chapis": "Chapis Village Road, Bakakeng Central.",
    "Crystal Cave Waiting Shed Intersection up to Turning Point": "Crystal Cave Road from the Asin Road/Celestial Village side toward the Crystal Cave neighborhood; the endpoint lies close to the San Luis boundary.",
    "Crystal Dale Subdivision": "Crystal Dale Subdivision, Bakakeng Central.",
    "Cudirao Rd. (in front of Baptist School)": "Cudirao Road at Lakban Baptist Church Christian Education Center, Loakan Proper.",
    "Doclas Cerio Village": "Doclas Cerio locality near Ambuklao Road, Pacdal; the schedule gives no address or point within the village.",
    "Easter": "Easter Road and Easter College, Guisad Central.",
    "Eagle Crest-Phase 1": "Eagle Crest Subdivision Phase 1, Bakakeng North; the mapped SWMD road point found is for Phase 2, so no Phase 1 coordinate was assigned.",
    "Hollywood": "Hollywood Drive-In Hotel area on Ben Palispis Highway, Bakakeng Central.",
    "Kadaclan": "Kadaclan Village and Spring Hills Road at the Apugan-Loakan edge.",
    "Liteng (3am-12nn)": "Liteng Street, Purok 3, Pacdal.",
    "Ma. Basa": "Maria Basa Street, Pacdal.",
    "Magsaysay Drive (Tesda)": "132 Magsaysay Drive/Loakan Road at TESDA Regional Training Center, Loakan Proper.",
    "Market 2 Hangar": "Hangar Market at the north side of the Baguio Public Market, near the Upper Market Subdivision area.",
    "Munoz Drive": "Muñoz Drive in the Asin Road barangay.",
    "PHILSCI": "Philippine Science High School/Baguio City National Science High School road in Purok 12, Irisan.",
    "Pias": "Pias Road and the Lower Pias neighborhood in Camp 7.",
    "Pines Hospital": "Pines City Doctors Hospital on Magsaysay Avenue, opposite New Lucban Elementary School near Camdas Subdivision.",
    "Pucay St.": "Daroan Pucay Road, Guisad Central.",
    "Purok 1 to 6 Irisan": "Irisan Puroks 1–6 along Elpidio Quirino Highway and nearby access streets.",
    "Purok 12 (Irisan) (3am-12nn)": "Purok 12, Irisan, around Tengdow Road and the Philippine Science High School Road.",
    "Purok 15-Agro": "Agro Street/Loop in Purok 15, Irisan, near Naguilian Road.",
    "Purok 16": "Purok 16, Irisan, around the Agro Loop/Purok 18 access roads.",
    "Purok 27": "Purok 27 in Upper San Carlos Heights, Irisan.",
    "Purok 6 Asin": "Purok 6 within the Asin Road barangay; reviewed Asin Road SWMD pins are mapped to other puroks, so no coordinate was forced.",
    "Purok 6/7 (Boundary)-Harvester": "Harvester Building at the Irisan Purok 6/7 boundary; exact boundary point not exposed by the available map sources.",
    "Purok 8-Bakakeng Norte": "Purok 8, Bakakeng North; the available Bakakeng North SWMD pins map to other named roads or subdivisions.",
    "Quirino Higway": "Elpidio Quirino Highway through Irisan, a linear corridor.",
    "Richview Square": "Richview Square Subdivision, Bakakeng North.",
    "San Carlos": "San Carlos Heights in Irisan, extending across the lower and upper purok area.",
    "Sariling Sikap": "Sariling Sikap Road in Puroks 21–22, Irisan.",
    "Siapno Rd.": "Siapno Road, Pacdal.",
    "Spring Hills": "Spring Hills Road and Spring Hills Elementary School, Apugan-Loakan.",
    "St. Patrick Rd.": "Saint Patrick Road through Irisan Puroks 19 and 25.",
    "Suello Village": "Suello Village neighborhood, Bakakeng Central, near PNB Ville and the Ben Palispis Highway.",
    "UP Village": "UP Village in Purok 14, Irisan.",
    "Upper/Lower Cypress": "Cypress Road/Cypress Point Road, Irisan Purok 14.",
    "Veniz Hotel": "Likely Hotel Veniz Burnham on Abanao Street; the label could also mean Hotel Veniz Session, so the branch is not certain.",
    "Woodsville (3am-12nn)": "Woodsville Subdivision, Camp 7, near Pine Drive.",
    "Youngland": "Youngland neighborhood, Camp 7; no SWMD coordinate is mapped to Youngland itself.",
    "Youngland to Lions Head": "Route from Youngland in Camp 7 toward the Lion's Head/Camp 6 boundary; only the Baguio-side route is represented.",
    "Camp 7": "Baguio City barangay Camp 7; the reviewed SWMD pins span Cari\u00f1o, Pias, Richgate, Lexber, Petersville, Amparo Heights, Woodsville, Woodsgate and the Camp 7 West Road.",
    "Camp 7 (Woodsgate/ Richgate/ Monticello)": "Camp 7: the schedule names the Woodsgate and Richgate localities plus Monticello; only the mapped Woodsgate and Richgate points were confirmed.",
    "Bakakeng Norte (Purok 6,7)": "Bakakeng North around Purok 6 and the Bakakeng Road/New Site area; the remaining source pins map to Purok 5 or separate subdivisions.",
    "Bakakeng Old Site": "Bakakeng Central/Old Site area; the filtered source pins split across Santo Ni\u00f1o, Bengao, PNB Ville, Crystal Cave, Chapis and Kitma, so the exact Old Site extent is unresolved.",
    "Camdas": "Camdas Subdivision and its mapped Purok 2–4 roads; one barangay-tagged source pin reverse-geocodes to neighboring Happy Homes/Old Lucban and was excluded.",
    "Kitma": "Kitma and Lower Kitma roads in Bakakeng Central.",
    "Kisad st.": "Kisad Road is a central Baguio corridor; the reviewed Legarda-Burnham-Kisad pins map to Burnham Park roads rather than Kisad Street itself.",
    "Legarda": "Legarda locality within the Legarda-Burnham-Kisad barangay; the available mapped SWMD pins are concentrated around Burnham Park and do not establish the intended Legarda segment.",
    "Otek st.": "Otek Street in the Abanao-Zandueta-Kayong-Chugum-Otek barangay; none of the filtered SWMD pins is mapped directly to Otek Street.",
    "Sto. Ni\u00f1o": "Santo Ni\u00f1o Road and Santo Ni\u00f1o Subdivision in Bakakeng Central.",
    "St. Joseph Brgy. (Navy Base)": "Saint Joseph Village/Navy Base; four filtered pins map to Purok 6 Road, Leonard Wood Road/Navy Base, Purok 7 and Calla Lily Street; three pins map outside the named locality.",
    "Scout Barrio": "Scout Barrio around Loakan Road and Magnolia Alley; the Purok 7 source pin reverse-geocodes to Country Club and was excluded.",
    "San Luis": "San Luis Village and the Spring/Diamond/Sunflower subdivisions; two barangay-tagged points map to neighboring Victoria Village and Irisan and were excluded.",
    "Trancoville": "Trancoville; six SWMD pins map to Trancoville streets, while one A. Rimando Road pin reverse-geocodes to Brookside and was excluded.",
    "Loakan Proper (Brgy Hall/Welcome Arc)": "Loakan Road near the Loakan Proper Barangay Hall through the Welcome Arch direction; the hall location is established, but the arch endpoint is not precisely mapped.",
    "Loakan Proper (Pidawan-Maridit Rd., MOOG/NFA/BSP)": "Pidawan Street and Pidawan Interior Drive in Loakan Proper, around the Pidawan/MOOG/NFA route grouping.",
    "Loakan Proper-Ongasan/Feeder Rd./CAAP": "Ongasan Road and Feeder Road in Loakan Proper, with the route continuing toward the CAAP area.",
    "Quirino Higway": "Elpidio Quirino Highway through Irisan; selected pins are on the highway, including Puroks 1–6, while the adjacent Kaafuan Street point is excluded.",
    "Pacdal Circle": "Pacdal Circle near Pacdal Circle Park/Police Station 3; the nearest source-brgy Pacdal coordinate is row 501 on Siapno Road.",
    "Gibraltar Interior": "Interior Gibraltar is the Purok 3 locality; the filtered Gibraltar pins map to Gibraltar Road or Purok 5 side streets, so no Purok 3 coordinate was assigned.",
    "Gibraltar Main road except Cuneta compound and Good Shepherd": "Gibraltar Road corridor through the Mines View side of Gibraltar; the two C. Arellano/F. Baltazar side-street points were excluded from the main-road match.",
}

ANCHORS = {
    "17": (16.41093, 120.55996, "Mapcarta Purok 17 locality point; nearby Puroks 15, 16, and 18."),
    "18 Irisan": (16.41278, 120.56271, "Mapcarta Purok 18 neighborhood point."),
    "Market 2 Hangar": (16.41649, 120.59545, "Hangar Market map point."),
    "Centermall": (16.41631, 120.59634, "OpenStreetMap Baguio Center Mall point."),
    "Cudirao Rd. (in front of Baptist School)": (16.37722, 120.60928, "Mapcarta Cudirao neighborhood point; church address is on Cudirao Road."),
    "Magsaysay Drive (Tesda)": (16.37786, 120.62149, "Mapcarta TESDA Regional Training Center point."),
    "Pines Hospital": (16.42677, 120.59449, "Map geocoder point for Pines City Doctors Hospital."),
    "Purok 15-Agro": (16.4135501, 120.5601356, "Mapped Agro store, Purok 15, Irisan."),
    "Purok 16": (16.41323, 120.56125, "Mapcarta Purok 16 neighborhood point."),
    "Purok 27": (16.41591, 120.56778, "Mapcarta Purok 27 neighborhood point."),
    "Suello Village": (16.3910206, 120.5760051, "OpenStreetMap Suello Village locality point."),
    "Crystal Cave Waiting Shed Intersection up to Turning Point": (16.4014, 120.57497, "Mapcarta Crystal Cave turning-point/intersection point; route is not a single point."),
    "Veniz Hotel": (16.41332, 120.59448, "OpenStreetMap Hotel Veniz Burnham point on Abanao Street; alternate Session branch exists."),
    "Loakan Proper (Brgy Hall/Welcome Arc)": (16.37675, 120.6135, "Mapcarta/OpenStreetMap point for Loakan Proper Barangay Hall; the schedule's Welcome Arch endpoint is not fixed."),
    "Pacdal Circle": (16.416076, 120.614782, "Mapped Pacdal Circle landmark point; filtered Pacdal candidates are ranked by straight-line distance."),
    "Phase 3 Bakakeng Norte": (16.38116, 120.59326, "Mapcarta/OpenStreetMap point for Eagle Crest Subdivision Phase 3; SWMD rows were filtered to Bakakeng North."),
    "Moldex Box": (16.39823, 120.5824, "Mapcarta/OpenStreetMap point for Moldex Residences Baguio; nearest Bakakeng Central source coordinate is row 77."),
}

SOURCES = {
    "17": ["https://mapcarta.com/N9220474694", "https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "18 Irisan": ["https://mapcarta.com/N9220474702", "https://ph.geoview.info/add_road_purok_18%2C10682078009n"],
    "2": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-north"],
    "28 Upper San Carlos Hts.": ["https://mapcarta.com/N9143386726", "https://turistaboy.com/pf-estacion-de-cafe/"],
    "ADD Rd.": ["https://ph.geoview.info/add_road_purok_18%2C10682078009n", "https://storage.googleapis.com/request-attachments/f1GbvBTR5EBdA7iQi8iqWciOP9hWzQvPgQ3bdjeJSO2ACTDOzECRFon11fJSMgZjUYSNCJe2ILtLc1MIcPb3xI4vUBQ15ghVxUGg/BWD%20Letter.Jaemar%20Reyes_request%20through%20foi%20website.02242021.pdf"],
    "Agpaoa Rd.": ["https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET", "https://baguiocityph.blogspot.com/2021/"],
    "Amsing": ["https://ren.ph/tools/zonal-value/benguet/baguio/pacdal"],
    "Balacbac": ["https://ren.ph/tools/zonal-value/benguet/baguio/santo-tomas-proper"],
    "Balenben": ["https://ren.ph/tools/zonal-value/benguet/baguio/irisan", "https://wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Bengao": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central", "https://www.waze.com/live-map/directions/ph/car/baguio/bengao-road?to=place.ChIJaUnwQQShkTMRe0geHU9Zm1w"],
    "Centermall": ["https://ph.geoview.info/baguio_center_mall%2C159128818w", "https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Chapis": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central", "https://philippines-streets.openalfa.com/streets/crystal-cave-road-celestial-village-asin-road-baguio-city"],
    "Crystal Cave Waiting Shed Intersection up to Turning Point": ["https://mapcarta.com/N3529908068", "https://philippines-streets.openalfa.com/streets/crystal-cave-road-celestial-village-asin-road-baguio-city", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "Crystal Dale Subdivision": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "Cudirao Rd. (in front of Baptist School)": ["https://www.deped.gov.ph/wp-content/uploads/2021/06/SY-2020-2021-Masterlist-of-Schools-Address-only-1-1.pdf", "https://philippines-streets.openalfa.com/streets/cudirao-road-cudirao-loakan-liwanag-loakan-proper-baguio-city", "https://www.waze.com/live-map/directions/ph/car/baguio/loakan-baptist-church-christian-education-center?to=place.ChIJSx_dUtagkTMRb2E8soUd1kU"],
    "Doclas Cerio Village": ["https://ren.ph/tools/zonal-value/benguet/baguio/pacdal"],
    "Eagle Crest-Phase 1": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-north"],
    "Easter": ["https://eastercollege.ph/public/contact", "https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET"],
    "Hollywood": ["https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "Kadaclan": ["https://ati2.da.gov.ph/ati-car/content/sites/default/files/2023-04/MASTERLIST_ATI-CAR_CONSOLIDATED%20LSA_%20AS_OF_FEBRUARY_2023.pdf", "https://ndrrmc.gov.ph/attachments/article/4153/11_NDRRMC_SWM_LUIS_2018.pdf"],
    "Liteng (3am-12nn)": ["https://ren.ph/tools/zonal-value/benguet/baguio/pacdal"],
    "Magsaysay Drive (Tesda)": ["https://car.tesda.gov.ph/tesdacar/rtc-baguio/", "https://mapcarta.com/W109574594", "https://tesda.gov.ph/Uploads/File/PhilGeps/2021/UAQTEA/Starter%20Toolkits%20for%20the%20Implementation%20of%20Universal%20Access%20to%20Quality%20Tertiary%20Education%20Act/Bid%20Docs%20-%20UAQTEA.pdf"],
    "Market 2 Hangar": ["https://mapcarta.com/W299600140", "https://mapcarta.com/N1796819139", "https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Munoz Drive": ["https://philippines-streets.openalfa.com/asin-road", "https://ren.ph/tools/zonal-value/benguet/baguio/asin-road"],
    "PHILSCI": ["https://ren.ph/tools/zonal-value/benguet/baguio/irisan", "https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Pias": ["https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET", "https://wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Pines Hospital": ["https://www.philhealth.gov.ph/partners/providers/facilities/accredited/HOSP_053126.pdf", "https://pcdh.ph/", "https://www.waze.com/live-map/directions/pines-city-doctors-hospital-baguio?to=place.w.79036580.790300267.1903444"],
    "Pucay St.": ["https://legacy.senate.gov.ph/lisdata/1191810531%21.pdf", "https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET"],
    "Purok 15-Agro": ["https://baguiowaterdistrict.gov.ph/wp-content/uploads/2025/01/CAS-2679-philgeps-NOA.pdf", "https://ph.near-place.com/agro-irisan-gen-mdse-88-agro-street-naguilan-road-purok-15-barangay-irisan-baguio"],
    "Purok 16": ["https://mapcarta.com/N9287042930", "https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "Purok 27": ["https://mapcarta.com/N9312284717", "https://turistaboy.com/pf-estacion-de-cafe/"],
    "Purok 6/7 (Boundary)-Harvester": ["https://m.depedcar.ph/sites/default/files/announcementFiles/list_of_private_school_-_car.pdf", "https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "Quirino Higway": ["https://philippines-streets.openalfa.com/irisan", "https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "Richview Square": ["https://www.waze.com/live-map/directions/richview-square-subdivision-bakakeng-baguio?to=place.w.79036580.790300263.1888225", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-north"],
    "San Carlos": ["https://mapcarta.com/N9143386726", "https://www.comelec.gov.ph/php-tpls-attachments/2022NLE/POP/BENGUET.pdf"],
    "Sariling Sikap": ["https://ren.ph/tools/zonal-value/benguet/baguio/irisan", "https://storage.googleapis.com/request-attachments/f1GbvBTR5EBdA7iQi8iqWciOP9hWzQvPgQ3bdjeJSO2ACTDOzECRFon11fJSMgZjUYSNCJe2ILtLc1MIcPb3xI4vUBQ15ghVxUGg/BWD%20Letter.Jaemar%20Reyes_request%20through%20foi%20website.02242021.pdf"],
    "Siapno Rd.": ["https://ren.ph/tools/zonal-value/benguet/baguio/pacdal"],
    "Spring Hills": ["https://www.deped.gov.ph/wp-content/uploads/2021/06/SY-2020-2021-Masterlist-of-Schools-Address-only-1-1.pdf", "https://ndrrmc.gov.ph/attachments/article/4153/11_NDRRMC_SWM_LUIS_2018.pdf"],
    "St. Patrick Rd.": ["https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "Suello Village": ["https://geocodingv3.1.deinekarre.de/details.php?place_id=3788925", "https://mapcarta.com/N4934290965", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "UP Village": ["https://ren.ph/tools/zonal-value/benguet/baguio/irisan", "https://wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Upper/Lower Cypress": ["https://philippines-streets.openalfa.com/asin-road", "https://ren.ph/tools/zonal-value/benguet/baguio/irisan"],
    "Veniz Hotel": ["https://mapcarta.com/W156175826", "https://www.philjobnet.gov.ph/job-vacancies/company/veniz-hotel-corp-10546", "https://philippines.travel/data/AEs_with_CAO_05Feb2021.pdf"],
    "Woodsville (3am-12nn)": ["https://baguiocityguide.com/beneco-starts-opening-converge-fiber-x-applications-in-baguio-city/", "https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET"],
    "Youngland": ["https://baguiocityph.blogspot.com/2021/", "https://wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Youngland to Lions Head": ["https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET", "https://philippines-streets.openalfa.com/camp-7_baguio-city"],
    "Camp 7": ["https://maps.apple.com/place?auid=16324333187343719529", "https://philippines-streets.openalfa.com/camp-7_baguio-city", "https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET"],
    "Camp 7 (Woodsgate/ Richgate/ Monticello)": ["https://philippines-streets.openalfa.com/camp-7_baguio-city", "https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Bakakeng Norte (Purok 6,7)": ["https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf", "https://storage.googleapis.com/request-attachments/f1GbvBTR5EBdA7iQi8iqWciOP9hWzQvPgQ3bdjeJSO2ACTDOzECRFon11fJSMgZjUYSNCJe2ILtLc1MIcPb3xI4vUBQ15ghVxUGg/BWD%20Letter.Jaemar%20Reyes_request%20through%20foi%20website.02242021.pdf"],
    "Bakakeng Old Site": ["https://storage.googleapis.com/request-attachments/f1GbvBTR5EBdA7iQi8iqWciOP9hWzQvPgQ3bdjeJSO2ACTDOzECRFon11fJSMgZjUYSNCJe2ILtLc1MIcPb3xI4vUBQ15ghVxUGg/BWD%20Letter.Jaemar%20Reyes_request%20through%20foi%20website.02242021.pdf", "https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf"],
    "Camdas": ["https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Crystal Dale Subdivision": ["https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "Kitma": ["https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "Kisad st.": ["https://philippines-streets.openalfa.com/baguio_legarda-burnham-kisad"],
    "Legarda": ["https://mapcarta.com/N1796637240", "https://philippines-streets.openalfa.com/baguio_legarda-burnham-kisad"],
    "Otek st.": ["https://philippines-streets.openalfa.com/baguio_legarda-burnham-kisad", "https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Sto. Ni\u00f1o": ["https://www.wheninbaguio.com/wp-content/uploads/2018/09/8Aug-2018-NCIP_2.pdf", "https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-central"],
    "St. Joseph Brgy. (Navy Base)": ["https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Scout Barrio": ["https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "San Luis": ["https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Trancoville": ["https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Loakan Proper (Brgy Hall/Welcome Arc)": ["https://mapcarta.com/N10948798932"],
    "Loakan Proper (Pidawan-Maridit Rd., MOOG/NFA/BSP)": ["https://www.peza.gov.ph/sites/default/files/construction_of_concrete_humps_and_rehabilitation_of_sitel_1_service_road_2.pdf"],
    "Loakan Proper-Ongasan/Feeder Rd./CAAP": ["https://www.peza.gov.ph/sites/default/files/construction_of_concrete_humps_and_rehabilitation_of_sitel_1_service_road_2.pdf"],
    "Pacdal Circle": ["https://www.waze.com/live-map/directions/ph/car/baguio/pacdal-circle?to=place.ChIJjZgSPFShkTMRXA0FR--IwDY", "https://www.findlatitudeandlongitude.com/l/Pacdal%2BCirle%2C%2BBaguio%2BCity%2C%2BCordillera%2BAdministrative%2BRegion%2C%2BPhilippines/10152411/gps-coordinates-converter/"],
    "Phase 3 Bakakeng Norte": ["https://mapcarta.com/N8821197527", "https://www.psbank.com.ph/media/7657/properties-with-special-prices_12052023.pdf", "https://baguiocityguide.com/baguio-city-cases-april-13-2021/"],
    "Moldex Box": ["https://mapcarta.com/W1222517602", "https://linky.ph/moldexresidencesbaguio", "https://web-assets.metrobank.com.ph/1710495118-03152024_list-of-accredited-developer-per-website-as-of-03-15-2024.pdf"],
    "Leonard Wood rd.": ["https://legacy.senate.gov.ph/lisdata/1191810531%21.pdf", "https://psa.gov.ph/classification/psgc/barangays/1430300000"],
    "Genesis": ["https://www.bookaway.com/routes/philippines/baguio/genesis-bus-station-baguio", "https://www.waze.com/live-map/directions/philippines/cordillera-administrative-region/baguio/genesis-baguio-loakan-motorpool?to=place.ChIJw46EzpCnkTMR-nFlGK4-izU"],
    "Milton-Highway": ["https://psa.gov.ph/classification/psgc/barangays/1430300000", "https://alternateroutes.baguio.gov.ph/"],
    "Quirino Hill": ["https://gadm.org/maps/PHL/benguet/baguiocity_3.html", "https://mapcarta.com/N1796637226"],
    "Gibraltar Interior": ["https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET", "https://mapcarta.com/N1796819125"],
    "Gibraltar Main road except Cuneta compound and Good Shepherd": ["https://zonalvaluefinderph.com/zonal-values/?city=BAGUIO+CITY&province=BENGUET", "https://mapcarta.com/N1796819125"],
    "Pinsao Proper (Monol/Tam-awan up to Hway Boundary LT)": ["https://app.philippines.travel/interests/tam-awan-village"],
    "Pinsao Proper-Crusher/Hway before Aguinalde Hrdwre": ["https://app.philippines.travel/interests/tam-awan-village"],
}

NEEDS_REVIEW_NOTES = {
    "2": "Phase 2 is identified; the v3 Phase 1/2 label was split. Only the source pin explicitly on Eagle Crest Main/Phase 2 is retained. Confirm whether the schedule's bare '2' means this Phase 2 label.",
    "28 Upper San Carlos Hts.": "The barangay and Upper San Carlos Heights locality are established, but available map sources do not isolate Purok 28 well enough to select a nearby Purok 25–27 SWMD pin.",
    "Avelino Fairview": "Fairview Village is verified, but the schedule does not say which Avelino Street segment; no source point was close enough to assign without an exact anchor.",
    "APTS. Ambuklao Rd.": "Ambuklao Road crosses several barangays; 'APTS.' does not identify a specific apartment or segment, so no one barangay or site point was forced.",
    "Assumption": "Assumption Road is a central corridor with more than one adjacent barangay; the schedule gives no endpoint to establish a single barangay or candidate subset.",
    "Bakbakan (Joaquin Smith NHS) to City Limit": "The school/road corridor is named, but available sources did not establish its exact Baguio-side barangay extent and a filtered coordinate subset.",
    "Balacbac": "Santo Tomas Proper is verified and the relevant SWMD points trace Balacbac feeder/bypass roads, but the neighborhood boundary is broad; keep the points as a corridor subset with a firingline marker.",
    "Bouganvilla St.": "The BIR road record places Bougainvillea Street in Santo Tomas Proper, but the schedule also couples it with Eagle Crest Phase 1/2; confirm which segment the driver means.",
    "Calderon": "The street name is central, but available route notes do not fix its barangay boundary or the particular SWMD site subset.",
    "Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas": "Camp 7 is verified. SWMD road/locality tags support the Amistad, Petersville and Lexber subset; Parisas has no explicit point, so a firingline marks the unmatched portion.",
    "Celestial to Belshang": "The endpoints span the Asin Road/Celestial side and the southern Bakakeng side, but the exact route and barangay transition remain unclear.",
    "City Limit": "A city limit is not a single locality; the schedule provides no road or endpoint from which to identify one barangay or coordinate subset.",
    "CLARO M. RECTO st.": "The street is referenced alongside the Bokawkan-to-Magsaysay route, but no exact line or site pin could be confirmed within a verified barangay.",
    "Crystal Cave Waiting Shed Intersection up to Turning Point": "The mapped road runs across/near the Asin Road and Bakakeng Central areas; six nearby points fit the corridor, but the schedule's exact start/end line remains uncertain.",
    "Cuneta and Good Sheperd": "Cuneta Subdivision and Good Shepherd are separate map landmarks on the Pacdal/Gibraltar/Mines View side; the schedule gives no route endpoints to choose a narrower barangay subset.",
    "Doclas Cerio Village": "Pacdal zoning material names Doclas Cario, but no SWMD point is identifiable as being in the village; retain a blank fallback.",
    "Dr. Cari\u00f1o St.": "The schedule context places this near Palma-Urbano/Upper Rock Quarry, but no candidate source point is tagged to the street itself.",
    "Eagle Crest-Phase 1": "Phase 1 is independently named in local zoning records, but the mapped source point explicitly labels Phase 2; no Phase 1 coordinate is assigned.",
    "Empire": "The central-city 'Empire' designation lacks an unambiguous map feature or barangay. It may refer to a commercial landmark near the market, but that was not enough to choose a site.",
    "Food Waste Collection": "This looks like a collection/activity label rather than a mapped area. The schedule provides no location or barangay to filter SWMD points.",
    "Food Waste Collection (8am-5pm)": "This looks like a collection/activity label rather than a mapped area. The schedule provides no location or barangay to filter SWMD points.",
    "Gov. Pack": "Governor Pack Road passes BGH and central-city areas; the schedule gives no endpoint, so the barangay and candidate subset remain unresolved.",
    "Guevarra St.": "The street is mentioned with East/West Modern Site and Upper Malvar, but the segment and side of the Modern Site boundary are not established.",
    "Idogan Village": "Irisan is supported by the route grouping, but no mapped boundary or SWMD coordinate identifies the Idogan locality itself.",
    "IEC/QRT": "The schedule label does not identify a public map place or route, so its barangay and candidate coordinates cannot be established.",
    "IEC/QRT (2pm-11pm)": "The schedule label does not identify a public map place or route, so its barangay and candidate coordinates cannot be established.",
    "IEC/QRT (8am-5pm)": "The schedule label does not identify a public map place or route, so its barangay and candidate coordinates cannot be established.",
    "incld. BPI Compd.": "The label is an inclusion note, not a standalone location. No exact BPI compound or barangay was identifiable from the schedule context.",
    "Justice/Pucay Village": "Bakakeng Central is the best-supported neighborhood context, but local references also place Pucay locations in Guisad Central; no point is assigned until the exact village is pinned.",
    "Lakandula": "Lakandula Street lies in the central business area; the schedule does not identify which adjacent barangay/segment is meant.",
    "Lower Mabini": "Lower Mabini is a central corridor; no endpoint or verified barangay segment is specified.",
    "Lower Malvar/Quisumbing": "The label combines two road/locality names near the Sanitary Camp/central boundary; the exact barangay and unmatched route extent remain unresolved.",
    "Manzanillo Subdivision": "The subdivision is associated with the Guisad/Pucay schedule grouping, but a source establishing its barangay boundary and exact SWMD site could not be found.",
    "Mercury/ Silver/ Copper/ Ponce St.": "The route label is associated with Victoria Village/Quezon Hill, but the exact street line and barangay crossing are not established.",
    "Minesview/J. Felipe St.": "The schedule combines a Mines View locality and J. Felipe Street near Lualhati; no exact street segment or boundary was confirmed.",
    "Montinola st.": "Montinola Street is mentioned with the central market route, but its exact segment and barangay-filtered SWMD candidate were not established.",
    "Naguilian": "Naguilian Road is a long corridor through several barangays; the schedule gives no endpoints, so a single barangay or nearby site subset cannot be assigned.",
    "Naguilian road": "Naguilian Road is a long corridor through several barangays; the schedule gives no endpoints, so a single barangay or nearby site subset cannot be assigned.",
    "Naguillan": "This appears to be a misspelling of Naguilian Road, but the schedule gives no endpoints for narrowing the corridor by barangay.",
    "Pacday Junction": "The place name may refer to a Pacdal junction, but no source established its exact location or candidate barangay.",
    "Paraan": "The market-area reference does not identify a specific street segment or barangay, and no relevant SWMD point can be selected confidently.",
    "Pines Hospital": "The hospital point and likely Camdas context are identified. The closest Camdas row is about 0.21 km away on Tandang Sora Street; keep it as a medium-confidence landmark match for local review.",
    "PLDT-Naguilian Rd.": "The schedule gives no specific PLDT building or Naguilian Road segment; the corridor crosses multiple barangays.",
    "Pyramid": "The area is grouped with Fort del Pilar and the Loakan feeder route, but no exact Pyramid landmark or close SWMD point was established.",
    "Recoletos": "The name may refer to a local landmark near San Luis/San Roque, but available sources did not resolve its barangay or site coordinate.",
    "Regidor st.": "Regidor Street is within the Pacdal road network, but the available SWMD points map to nearby Siapno, Liteng, Amsing and Maria Basa streets rather than Regidor itself.",
    "Richview Square": "Bakakeng North is verified, but the filtered SWMD pins map to other localities/roads and do not provide a defensible point inside Richview Square.",
    "Richwood Square": "The area is in the Guisad/Pucay schedule grouping, but a source pin or boundary confirmation was unavailable.",
    "Sarok": "Camp 7 is verified from local addresses; no SWMD point is specifically tagged to Sarok Road, so no point was forced.",
    "Shangrila Village": "The label is grouped with San Luis and San Roque, but available map sources did not distinguish which barangay contains this village.",
    "SLU": "The schedule does not specify whether it means the main campus, Maryheights, or SVP campus; those sites lie in different barangays.",
    "Smith drive (3am-12nn)": "Asin Road is supported by the surrounding schedule group; available site map labels do not show a coordinate on Smith Drive itself.",
    "St Peter's /Teachers Village/ Marcos Highway cor. Suello-Tuba Highway Boundary": "The route touches Bakakeng Central and Santo Tomas Proper and continues toward the Tuba boundary; exact start/end points are needed to assign a narrower subset.",
    "Sta. Lucia (3am-12nn)": "The schedule name is not unique in Baguio and does not establish a barangay or route endpoint.",
    "Suello Junction": "The junction sits at a Bakakeng/Santo Tomas/Tuba-side corridor; the exact junction point and filtered site segment were not established.",
    "Summer Ville (Bakakeng)": "The subdivision is associated with Bakakeng, but available sources do not resolve Bakakeng Central versus Bakakeng North or locate a matching SWMD point.",
    "Summerville (Ambuklao rd.)": "The name may refer to a subdivision on the Ambuklao Road corridor, which spans multiple barangays; no exact point was verified.",
    "Sumulong": "The schedule groups this with Imelda Village/M. Roxas, but the street/locality segment and matching candidate were not independently established.",
    "Sunny side - Tacay Rd.": "Sunnyside is associated with Fairview Village while Tacay Road also appears in Guisad Central; the schedule gives no endpoints for the route across these areas.",
    "Tetep-an Village": "The village is associated with Bakakeng North, but the available SWMD candidates map to Eagle Crest/Ciudad Grande and other nearby areas; the village pin itself was not resolved.",
    "UP Village": "Irisan is verified and three SWMD pins are mapped on UP Village roads, but the schedule is a corridor designation and its full route extent is not explicit.",
    "Upper Bonifacio": "The schedule groups this with SLU and Lower Bonifacio; the exact Upper Bonifacio street segment and barangay crossing are uncertain.",
    "Upper Malvar St.": "The street is grouped with East/West Modern Site, but the exact segment and barangay side are not established.",
    "Veniz Hotel": "The schedule's market/Abanao context supports Hotel Veniz Burnham and one nearby SWMD pin; an alternate Session Road branch exists, so confirm the intended branch.",
    "YMCA": "The schedule groups YMCA with Pacdal/Teachers Camp and central routes; no single Baguio YMCA pin or barangay could be matched confidently.",
    "Youngland": "Camp 7 is verified, but no SWMD site is explicitly mapped to Youngland; keep a blank fallback.",
    "Youngland to Lions Head": "The route crosses toward the Camp 6/Tuba edge; only the Camp 7 side is in the Baguio SWMD dataset, so retain a firingline marker for the route.",
    "(Road 1 to 3)": "The route is grouped with Victoria Village and Quezon Hill; exact start/end points and barangay crossing were not mapped.",
    "(Upper/Mid, East/ West)": "This is an abbreviated Quirino Hill area note; 'Upper/Mid, East/West' does not resolve cleanly to one of the CSV barangay spellings.",
    "Purok 6/7 (Boundary)-Harvester": "Irisan and Asin Road are both plausible at this boundary; the selected Irisan highway points are near Puroks 5–6, but the exact Harvester pin remains uncertain.",
    "17": "Mapcarta identifies nearby Puroks 16–18 in Irisan, but no Purok 17-specific SWMD site tag was recovered. The Irisan candidate rows were reviewed and none was selected; keep a blank marker pending a more precise pin.",
    "Bakakeng Norte (Purok 6,7)": "Only row 83 is explicitly mapped near Purok 6 on Bakakeng Road. Other Bakakeng North rows map to Purok 5, New Site, Santo Ni\u00f1o, Ciudad Grande, Eagle Crest, or Camp 7; the Purok 7 extent remains unresolved.",
    "Bakakeng Old Site": "The canonical source barangay is Bakakeng Central, but the 32 filtered pins map across several distinct neighborhoods and roads. No source defines the Old Site boundary, so no point is assigned.",
    "Camp 7 (Woodsgate/ Richgate/ Monticello)": "The filtered Camp 7 candidates identify Richgate rows 128–129 and Woodsgate rows 141–142. No source pin is labeled Monticello, so a firingline marks the unverified part of the route.",
    "Kisad st.": "The 35 filtered source pins map to Lake Drive, Shanum Street, Jose Abad Santos Drive and Juan Luna Drive around Burnham Park; none is mapped to Kisad Street. No coordinate was forced.",
    "Legarda": "Legarda is a locality within the composite source barangay, but all available pins map around Burnham Park rather than an identified Legarda segment. No coordinate was forced.",
    "Otek st.": "All five AZKCO candidates were reviewed; mapped roads are Abanao Street, Shagem Street, and Fernando G. Bautista Drive, with no Otek Street point. Retain a firingline marker pending an exact route pin.",
    "Loakan Proper (Brgy Hall/Welcome Arc)": "Rows 417–418 map to Loakan Proper Barangay Hall and Loakan Road; row 421 maps to Loakan Road near the Apugan boundary and row 426 to Loakan Road in Magsaysay. The precise Welcome Arch endpoint was not independently located.",
    "Gibraltar Interior": "The candidate list was filtered to the source Barangay Gibraltar. All 12 points were reviewed: ten map to Gibraltar Road and two map to C. Arellano Street/F. Baltazar Street in Purok 5; none is in the Purok 3 interior locality named by the schedule.",
    "Purok 16": "Mapcarta places Purok 16 near Puroks 15–18 in Irisan. The nearest Irisan candidate, source row 319, is about 0.115 km away but reverse-maps to Purok 18; no coordinate was forced into Purok 16.",
    "Genesis": "Search results identify at least two plausible Baguio locations: Genesis Bus Station on Gov. Pack Road and Genesis Baguio Loakan Motorpool on Magsaysay/Loakan Road. The schedule groups 'Genesis' with Camp 8, Sta. Escolastica, and Milton-Highway but does not identify which location; no barangay-filtered coordinate is assigned.",
    "Leonard Wood rd.": "The official road schedule identifies Leonard Wood Road segments in Cabinet Hill-Teachers Camp, Saint Joseph Village, and the Outlook Drive/Lualhati side; Gibraltar and Pacdal also meet the corridor. Row 585 is explicitly mapped on Leonard Wood Road in Saint Joseph Village. The schedule provides no endpoints, and the available SWMD pins do not trace the full road, so retain a firingline for the unmatched extent.",
    "Milton-Highway": "The label appears in the schedule grouping with Camp 8, Sta. Escolastica, and Genesis, but available map sources did not resolve 'Milton-Highway' to a named Baguio road segment or a single CSV barangay. Keep a firingline marker until the route endpoints are known.",
    "Moldex Box": "The schedule context and public location records support Moldex Residences in Bakakeng Central. Row 77 is about 0.075 km from the mapped residence and is the nearest plausible filtered site, on Ben Palispis Highway. The exact collection box point is not mapped; confirm the stop point before treating this as final.",
}


def main() -> None:
    with CHECKLIST.open("r", encoding="utf-8-sig", newline="") as handle:
        checklist = list(csv.DictReader(handle))
        fields = list(checklist[0].keys())
    with SWMD.open("r", encoding="utf-8-sig", newline="") as handle:
        raw_rows = list(csv.DictReader(handle))
    with LOOKUP.open("r", encoding="utf-8-sig", newline="") as handle:
        lookup_rows = list(csv.DictReader(handle))

    lookup_by_id = {int(row["source_csv_row"]): row for row in lookup_rows}
    source_by_id = {}
    rows_by_barangay: dict[str, list[dict]] = defaultdict(list)
    for source_id, source in enumerate(raw_rows, start=2):
        try:
            lat, lon = float(source["Latitude"]), float(source["Longitude"])
            valid = -90 <= lat <= 90 and -180 <= lon <= 180
        except (ValueError, TypeError):
            lat = lon = None
            valid = False
        row = {
            "source_csv_row": source_id,
            "site_name": source.get("Site Name", "").strip(),
            "barangay": source.get("Barangay", "").strip(),
            "latitude": lat if valid else None,
            "longitude": lon if valid else None,
            "valid": valid,
        }
        source_by_id[source_id] = row
        if row["barangay"]:
            rows_by_barangay[key(row["barangay"])].append(row)

    canonical = {key(row["barangay"]): row["barangay"] for row in source_by_id.values() if row["barangay"]}
    for record in checklist:
        area = record["area_name_exact"].strip()
        verified = BARANGAY_OVERRIDES.get(area)
        if verified is None:
            verified = [item.strip() for item in record.get("verified_barangay", "").split("|") if item.strip()]
        # Canonicalize all labels against the actual source CSV spelling.
        verified = list(dict.fromkeys(canonical.get(key(item), item) for item in verified))
        selected = SELECTED_OVERRIDES.get(area)
        if selected is None:
            selected = [int(item) for item in record.get("selected_source_rows", "").split("|") if item]
        selected = list(dict.fromkeys(selected))
        if verified:
            allowed = {key(item) for item in verified}
            selected = [source_id for source_id in selected if source_id in source_by_id and key(source_by_id[source_id]["barangay"]) in allowed and source_by_id[source_id]["valid"]]
        else:
            selected = []

        marker = FALLBACK_OVERRIDES.get(area, record.get("fallback_marker", "blank").strip().lower())
        if marker not in {"none", "blank", "firingline"}:
            marker = "blank"
        if not selected and marker == "none":
            marker = "firingline" if re.search(r"\b(road|rd|street|st|highway|junction|to|boundary|limit)\b", area, re.I) else "blank"

        candidates = []
        for barangay in verified:
            candidates.extend(rows_by_barangay.get(key(barangay), []))
        candidates.sort(key=lambda row: row["source_csv_row"])
        record["verified_barangay"] = "|".join(verified)
        record["candidate_source_rows"] = "|".join(str(row["source_csv_row"]) for row in candidates)
        record["selected_source_rows"] = "|".join(str(source_id) for source_id in selected)
        record["fallback_marker"] = marker
        record["fallback_barangay"] = verified[0] if len(verified) == 1 else ""

        location = SPECIFIC_LOCATIONS.get(area)
        if not location:
            if verified:
                location = f"{area}; reviewed against the mapped road/locality labels within {', '.join(verified)}."
            else:
                location = record.get("researched_location", "").strip()
        record["researched_location"] = location

        anchor = ANCHORS.get(area)
        reference = (anchor[0], anchor[1]) if anchor else None
        if reference:
            record["reference_latitude"] = f"{reference[0]:.8f}"
            record["reference_longitude"] = f"{reference[1]:.8f}"
            record["reference_point_method"] = anchor[2]
        else:
            record["reference_latitude"] = ""
            record["reference_longitude"] = ""
            record["reference_point_method"] = "Mapped road/locality labels and the filtered barangay set; no independent point coordinate for this broader area."

        ranked = []
        for candidate in candidates:
            if not candidate["valid"]:
                continue
            dist = distance_km(*reference, candidate["latitude"], candidate["longitude"]) if reference else None
            lookup = lookup_by_id.get(candidate["source_csv_row"], {})
            detail = "; ".join(filter(None, [lookup.get("street_or_road", "").strip(), lookup.get("nearby_locality", "").strip(), lookup.get("map_feature_name", "").strip()]))
            ranked.append((dist if dist is not None else float("inf"), candidate, detail))
        if reference:
            ranked.sort(key=lambda item: (item[0], item[1]["source_csv_row"]))
        candidate_description = []
        for dist, candidate, detail in ranked:
            suffix = f" ({dist:.3f} km)" if math.isfinite(dist) else ""
            suffix += f" — {detail}" if detail else ""
            candidate_description.append(
                f"{candidate['source_csv_row']}: {candidate['site_name']} [{candidate['barangay']}] "
                f"{candidate['latitude']:.6f},{candidate['longitude']:.6f}{suffix}"
            )
        record["candidate_sites_considered"] = "; ".join(candidate_description)

        selected_description = []
        selected_distances = []
        for source_id in selected:
            selected_row = source_by_id[source_id]
            detail = ""
            if reference:
                dist = distance_km(*reference, selected_row["latitude"], selected_row["longitude"])
                detail = f" ({dist:.3f} km from researched point)"
                selected_distances.append(f"{source_id}: {dist:.3f} km")
            else:
                mapped = lookup_by_id.get(source_id, {})
                road = mapped.get("street_or_road", "").strip()
                locality = mapped.get("nearby_locality", "").strip()
                detail = f" (mapped road/locality: {road or locality or 'not named'})"
                selected_distances.append(f"{source_id}: independent point distance unavailable; mapped road/locality reviewed")
            selected_description.append(
                f"{source_id}: {selected_row['site_name']} [{selected_row['barangay']}] "
                f"{selected_row['latitude']:.6f},{selected_row['longitude']:.6f}{detail}"
            )
        if selected_description:
            record["selected_site_or_fallback"] = "; ".join(selected_description)
            if marker in {"blank", "firingline"}:
                record["selected_site_or_fallback"] += f"; {marker} fallback marker for unmatched extent (null coordinates)"
            record["distance_to_selected_coordinate_km"] = "; ".join(selected_distances)
        else:
            record["selected_site_or_fallback"] = f"{marker} marker; coordinates null"
            record["distance_to_selected_coordinate_km"] = "No confirmed SWMD coordinate selected; fallback marker has null coordinates."
        if selected and not reference:
            record["distance_to_selected_coordinate_km"] += "; area is a neighborhood/road, so no single-point distance applies."

        source_urls = [item.strip() for item in record.get("research_source", "").split(";") if item.strip()]
        source_urls.append(PSA)
        source_urls.extend(SOURCES.get(area, []))
        for source_id in selected:
            mapped = lookup_by_id.get(source_id, {})
            for url in [mapped.get("research_source", ""), mapped.get("source_google_maps_url", "")]:
                if url.strip():
                    source_urls.append(url.strip())
        record["research_source"] = "; ".join(dict.fromkeys(source_urls))

        # A marked-complete row must have a location and canonical barangay, and
        # its complete filtered candidate set is recorded above. Ambiguities
        # stay in the checklist with a specific reason instead of being hidden.
        complete = bool(verified) and area not in AMBIGUOUS
        if area in NEEDS_REVIEW_NOTES:
            complete = False
        if area in {"Market 2 Hangar", "Magsaysay Drive (Tesda)", "Cudirao Rd. (in front of Baptist School)", "Centermall", "Purok 15-Agro", "Purok 16", "Purok 27", "17", "18 Irisan", "Pines Hospital", "Suello Village", "2", "Eagle Crest-Phase 1"}:
            # These decisions carry explicit mapped anchors and candidate distances;
            # only entries with a specific unresolved note remain incomplete.
            complete = area not in NEEDS_REVIEW_NOTES
        if not verified:
            complete = False
        record["fully_checked"] = "Yes" if complete else "No"
        record["research_status"] = "checked" if complete else "needs_review"
        record["needs_review"] = "No" if complete else "Yes"
        if complete:
            record["confidence"] = "High" if area in {"Cudirao Rd. (in front of Baptist School)", "Magsaysay Drive (Tesda)", "Market 2 Hangar", "Centermall", "Purok 27", "18 Irisan", "Pucay St.", "Easter", "Munoz Drive", "Bengao", "Balenben", "UP Village", "Woodsville (3am-12nn)", "Pacdal Circle", "Phase 3 Bakakeng Norte"} else "Medium"
            if area == "Phase 3 Bakakeng Norte":
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} source rows to Bakakeng North first. Selected row 87 because its coordinate is "
                    "0.072 km from the mapped Eagle Crest Phase 3 locality point; the other candidates map to separate phases, "
                    "Purok 5, New Site, Sunnyside, or other named roads/localities."
                )
            elif area == "Quirino Hill":
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} source rows to the three verified Quirino Hill barangays first. Selected seven pins "
                    "whose road/locality labels place them in the East, Middle, or West Quirino Hill area; excluded row 566 because it is "
                    "on Upper Camdas Road and reverse-maps to Purok 5, Camdas."
                )
            elif area == "Spring Hills":
                record["matching_rationale"] = (
                    "Filtered all six Apugan-Loakan rows before comparing locations. Rows 23–24 are both explicitly mapped to Spring Hills Road "
                    "and were selected. Rows 21–22 are on Loakan Road, row 25 is on Eastern Link Circumferential Road near Kadaclan, and row 26 "
                    "has no coordinate or map label. No researched Spring Hills extent remains unmatched, so no firingline marker is warranted."
                )
            elif selected:
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} source rows in {', '.join(verified)} before comparison. "
                    f"Selected {len(selected)} site row(s) because their mapped road/locality labels or independently researched proximity fit this area; "
                    f"all selected coordinates and source barangay spellings are recorded above."
                )
            else:
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} source rows in {', '.join(verified)} and reviewed their mapped locality/road labels "
                    "against the researched area. No coordinate was geographically plausible for this location; retained the required null-coordinate fallback."
                )
            record["review_note"] = "Location, canonical barangay, and every filtered SWMD candidate row were checked; no additional review is flagged."
        else:
            record["confidence"] = "Low" if not verified else "Medium"
            if area == "Moldex Box":
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} source rows in Bakakeng Central first. Row 77 is the nearest plausible point, "
                    "0.075 km from the mapped Moldex Residences locality and on Ben Palispis Highway; the schedule's exact box/stop point is not mapped."
                )
            elif area == "Leonard Wood rd.":
                record["matching_rationale"] = (
                    f"Filtered all {len(candidates)} rows only within the five canonical CSV barangays identified along the road. "
                    "Selected row 585 because its map label is Leonard Wood Road in Saint Joseph Village; retained a firingline marker for the untraced road extent."
                )
            elif area in {"Genesis", "Milton-Highway"}:
                record["matching_rationale"] = (
                    "The schedule context and map search were reviewed, but the label does not resolve to one location and one CSV barangay. "
                    "No candidate set or site coordinate is asserted; the fallback remains null-coordinate."
                )
            else:
                record["matching_rationale"] = (
                    f"Filtered candidate rows only by verified source barangay value(s): {', '.join(verified) if verified else 'not established'}. "
                    f"Selected only {len(selected)} row(s) whose map labels/proximity fit; the null-coordinate fallback represents any unmatched route or area."
                )
            record["review_note"] = NEEDS_REVIEW_NOTES.get(
                area,
                "The available sources do not establish both the exact location and barangay sufficiently to complete the coordinate match; review this area before treating it as final.",
            )

    with CHECKLIST.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(checklist)
    complete = sum(row["fully_checked"] == "Yes" for row in checklist)
    print(f"Reviewed {len(checklist)} distinct area labels; {complete} marked complete and {len(checklist) - complete} retained for review.")
    print(f"Updated {CHECKLIST}")


if __name__ == "__main__":
    main()
