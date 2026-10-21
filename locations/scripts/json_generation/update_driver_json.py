import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote_plus

import pandas as pd

base = Path(__file__).resolve().parents[2] / 'data'

# Load sources
df = pd.read_csv(base / 'csvs' / 'cleaned' / 'cleaned_drivers_dataset.csv')
swmd = pd.read_csv(
    base / 'csvs' / 'raw' / 'SWMD MAP - Baguio_SWMD_Google_MyMaps.csv',
    encoding='utf-8-sig',
).fillna('')

# The separate reverse-geocoding review file keeps each map label tied to its
# original SWMD CSV row. Keep the source site name and Purok value unchanged;
# expose map-derived Purok/place labels as review fields in the output JSON.
coordinate_lookup_path = base / 'csvs' / 'mapping' / 'swmd_coordinate_lookup_v2.csv'
coordinate_lookup_by_source_row = {}
if coordinate_lookup_path.exists():
    coordinate_lookup = pd.read_csv(coordinate_lookup_path, encoding='utf-8-sig').fillna('')
    for lookup_row in coordinate_lookup.to_dict(orient='records'):
        try:
            lookup_source_row = int(float(lookup_row['source_csv_row']))
        except (KeyError, TypeError, ValueError):
            continue
        coordinate_lookup_by_source_row[lookup_source_row] = lookup_row

# The older mapped schedule contains area-level pickup windows. Reuse only
# those values that can be matched to the same driver/day and an exact or
# source-barangay-equivalent schedule fragment; otherwise leave the field blank.
legacy_schedule_path = base / 'jsons' / 'schedules' / 'driver_schedule_swmd_map.json'
legacy_schedule_by_driver_day = {}
if legacy_schedule_path.exists():
    legacy_schedule = json.loads(legacy_schedule_path.read_text(encoding='utf-8-sig'))
    for legacy_driver in legacy_schedule:
        for legacy_day in legacy_driver.get('schedule', []):
            legacy_schedule_by_driver_day[(legacy_driver.get('driver'), legacy_day.get('day'))] = legacy_day.get('area', [])

# Keep the source map's names and coordinates intact. Do not collapse or rename
# rows: each source CSV row is tracked in the mapping audit below.
barangay_sites = {}
source_site_rows = []
for source_row, row in swmd.iterrows():
    try:
        latitude = float(row['Latitude'])
        longitude = float(row['Longitude'])
        coordinates_valid = -90 <= latitude <= 90 and -180 <= longitude <= 180
    except (TypeError, ValueError):
        latitude = longitude = None
        coordinates_valid = False

    source_csv_row = source_row + 2  # one-based CSV row, including the header
    lookup_row = coordinate_lookup_by_source_row.get(source_csv_row, {})
    site_row = {
        'source_row': source_csv_row,
        'barangay': str(row['Barangay']).strip(),
        'site_name': str(row['Site Name']).strip(),
        'purok': str(row['Purok']).strip(),
        'purok_candidate': str(lookup_row.get('purok_candidate', '')).strip(),
        'purok_check': str(lookup_row.get('purok_check', '')).strip(),
        'street_or_road': str(lookup_row.get('street_or_road', '')).strip(),
        'map_label': str(lookup_row.get('reverse_geocode_label', '')).strip(),
        'map_lookup_status': str(lookup_row.get('lookup_status', '')).strip(),
        'map_lookup_url': str(lookup_row.get('research_source', '')).strip(),
        'google_maps_url': str(lookup_row.get('source_google_maps_url', row['Google Maps'])).strip(),
        'latitude': latitude if coordinates_valid else None,
        'longitude': longitude if coordinates_valid else None,
        'coordinates_valid': coordinates_valid,
        'coordinate_source': str(row['Google Maps']).strip(),
    }
    source_site_rows.append(site_row)
    barangay_sites.setdefault(site_row['barangay'], []).append(site_row)

barangay_lookup = {b.lower(): (b, sites) for b, sites in barangay_sites.items()}
source_site_by_row = {site['source_row']: site for site in source_site_rows}

# Full-area aliases: cleaned full string -> list of (barangay_or_None, raw_part)
FULL_ALIASES = {
    'overpass slu left side to rimando bridge, kalkalan (pinget)':
        [('Pinget', 'Overpass SLU left side to Rimando Bridge, Kalkalan (Pinget)')],
    'dreamland pinget, central pinget':
        [('Pinget', 'Dreamland Pinget'), ('Pinget', 'Central Pinget')],
    'camp 7 (woodsgate/ richgate/ monticello)':
        [('Camp 7', 'Camp 7 (Woodsgate/ Richgate/ Monticello)')],
    'camp 7 (amistad, peters ville, lexber hts, parisas':
        [('Camp 7', 'Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas')],
    'camp 7, pias, youngland':
        [('Camp 7', 'Camp 7'), (None, 'Pias'), (None, 'Youngland')],
    'loakan proper (pidawan-maridit rd., moog/nfa/bsp)':
        [('Loakan Proper', 'Loakan Proper (Pidawan-Maridit Rd., MOOG/NFA/BSP)')],
    'loakan proper (brgy hall/welcome arc)':
        [('Loakan Proper', 'Loakan Proper (Brgy Hall/Welcome Arc)')],
    'purok 16,17,18 irisan':
        [('Irisan', 'Purok 16,17,18 Irisan')],
    'purok 1 to 6 irisan':
        [('Irisan', 'Purok 1 to 6 Irisan')],
    'purok 12 (irisan)':
        [('Irisan', 'Purok 12 (Irisan)')],
    'purok 27, 28 upper san carlos hts.':
        [(None, 'Purok 27, 28 Upper San Carlos Hts.')],
    'pinsao proper (monol/tam-awan up to hway boundary lt)':
        [('Pinsao Proper', 'Pinsao Proper (Monol/Tam-awan up to Hway Boundary LT)')],
    'pinsao pilot, pinsao proper-crusher/hway before aguinalde hrdwre':
        [('Pinsao Pilot Project', 'Pinsao Pilot'), ('Pinsao Proper', 'Pinsao Proper-Crusher/Hway before Aguinalde Hrdwre')],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca':
        [('Military Cut-off', 'Military Cut-off'), ('BGH Compound', 'BGH Hospital'), (None, 'Leonard Wood rd.'), ("Cabinet Hill-Teacher's Camp", "Teacher's Camp"), ('Pacdal', 'Pacdal Circle'), (None, 'YMCA')],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca, ma. basa, regidor st.':
        [('Military Cut-off', 'Military Cut-off'), ('BGH Compound', 'BGH Hospital'), (None, 'Leonard Wood rd.'), ("Cabinet Hill-Teacher's Camp", "Teacher's Camp"), ('Pacdal', 'Pacdal Circle'), (None, 'YMCA'), (None, 'Ma. Basa'), (None, 'Regidor st.')],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca, salud mitra':
        [('Military Cut-off', 'Military Cut-off'), ('BGH Compound', 'BGH Hospital'), (None, 'Leonard Wood rd.'), ("Cabinet Hill-Teacher's Camp", "Teacher's Camp"), ('Pacdal', 'Pacdal Circle'), (None, 'YMCA'), ('Salud Mitra', 'Salud Mitra')],
    'ric 2 (3am-12nn) bokawkan to magsaysay city limit, slu, lower bonifacio, claro m. recto st.':
        [(None, 'RIC 2 Bokawkan to Magsaysay City Limit'), (None, 'SLU'), (None, 'Lower Bonifacio'), (None, 'CLARO M. RECTO st.')],
    'ric 2 bokawkan to magsaysay city limit, slu, lower bonifacio':
        [(None, 'RIC 2 Bokawkan to Magsaysay City Limit'), (None, 'SLU'), (None, 'Lower Bonifacio')],
    'ric 2 bokawkan to magsaysay city limit, slu, lower bonifacio, upper bonifacio':
        [(None, 'RIC 2 Bokawkan to Magsaysay City Limit'), (None, 'SLU'), (None, 'Lower Bonifacio'), (None, 'Upper Bonifacio')],
    'cbd session road diego silang, lower mabini, lower gen. luna, gov. pack, assumption, calderon, lakandula, centermall':
        [('Session Road Area', 'CBD Session Road'), (None, 'Diego Silang'), (None, 'Lower Mabini'), ('General Luna, Lower', 'Lower Gen. Luna'), (None, 'Gov. Pack'), (None, 'Assumption'), (None, 'Calderon'), (None, 'Lakandula'), (None, 'Centermall')],
    'market 1 (magsaysay, abanao, kayang hilltop, baguio central school, lower mabini calderon, upper session rd., north drive, km.0, igorot park':
        [(None, 'Market 1 Magsaysay'), (None, 'Abanao'), ('Kayang-Hilltop', 'Kayang Hilltop'), (None, 'Baguio Central School'), (None, 'Lower Mabini Calderon'), (None, 'Upper Session rd.'), (None, 'North Drive'), (None, 'Km.0'), ('Rizal Monument Area', 'Igorot Park')],
    'market 2 hangar, upper magsaysay, maharlika abanao, empire, veniz hotel':
        [(None, 'Market 2 Hangar'), ('Upper Magsaysay', 'Upper Magsaysay'), (None, 'Maharlika Abanao'), (None, 'Empire'), (None, 'Veniz Hotel')],
    'market 3 dian huat, otek st., kisad st.':
        [(None, 'Market 3 Dian Huat'), (None, 'Otek st.'), ('Legarda-Burnham-Kisad', 'Kisad st.')],
    'market 3 dian huat, otek st., kisad st., montinola st.':
        [(None, 'Market 3 Dian Huat'), (None, 'Otek st.'), ('Legarda-Burnham-Kisad', 'Kisad st.'), (None, 'Montinola st.')],
    'market 3 dian huat, otek st., kisad st., san antonio village':
        [(None, 'Market 3 Dian Huat'), (None, 'Otek st.'), ('Legarda-Burnham-Kisad', 'Kisad st.'), ('San Antonio Village', 'San Antonio Village')],
    'gibraltar main road except cuneta compound and good shepherd':
        [('Gibraltar', 'Gibraltar Main road except Cuneta compound and Good Shepherd')],
    'fort del pilar, pyramid, loakan proper-ongasan/feeder rd./caap':
        [('Fort del Pilar', 'Fort Del Pilar'), (None, 'Pyramid'), ('Loakan Proper', 'Loakan Proper-Ongasan/Feeder Rd./CAAP')],
    'phase 3 bakakeng norte, eagle crest-phase 1,2, bouganvilla st.':
        [('Bakakeng North', 'Phase 3 Bakakeng Norte'), (None, 'Eagle Crest-Phase 1/2'), (None, 'Bouganvilla St.')],
    'a. tabora, trancoville, new lucban -interior':
        [('Alfonso Tabora', 'A. Tabora'), ('Trancoville', 'Trancoville'), ('New Lucban', 'New Lucban -Interior')],
    'agpaoa rd., poliwes, youngland to lions head, city limit':
        [(None, 'Agpaoa Rd.'), ('Poliwes', 'Poliwes'), (None, 'Youngland to Lions Head, City Limit')],
    'bakakeng norte (purok 6,7), summer ville (bakakeng)':
        [('Bakakeng North', 'Bakakeng Norte (Purok 6,7)'), (None, 'Summer Ville (Bakakeng)')],
    'san luis ,san roque village, shangrila village,recoletos':
        [('San Luis Village', 'San Luis'), ('San Roque Village', 'San Roque Village'), (None, 'Shangrila Village'), (None, 'Recoletos')],
    'south/north sanitary camp-yap st., lower malvar/quisumbing':
        [('Sanitary Camp, North', 'South/North Sanitary Camp-Yap St.'), ('Sanitary Camp, South', 'South/North Sanitary Camp-Yap St.'), (None, 'Lower Malvar/Quisumbing')],
    'outlook drive (highway and interior), magsaysay drive (tesda), happy hallow':
        [('Outlook Drive', 'Outlook Drive (Highway and Interior)'), (None, 'Magsaysay Drive (Tesda)'), ('Happy Hollow', 'Happy Hallow')],
    'campo filipino to petron ferguson rd., upper market, camp allen, kayang extn. (labsan) (3am-12nn)':
        [(None, 'Campo Filipino to Petron Ferguson rd.'), ('Market Subdivision, Upper', 'Upper Market'), ('Camp Allen', 'Camp Allen'), ('Kayang Extension', 'Kayang Extn. (Labsan)')],
    'quirino hill, (upper/mid, east/ west)':
        [(None, 'Quirino Hill (Upper/Mid, East/West)')],
    'quirino higway,pldt-naguilian rd.':
        [(None, 'Quirino Higway'), (None, 'PLDT-Naguilian Rd.')],
    'lamug st.-upper/middle quezon hill':
        [(None, 'Lamug St.-Upper/Middle Quezon Hill')],
    "st peter's /teachers village/ marcos highway cor. suello-tuba highway boundary":
        [(None, "St Peter's /Teachers Village/ Marcos Highway cor. Suello-Tuba Highway Boundary")],
    'bakbakan (joaquin smith nhs) to city limit':
        [(None, 'Bakbakan (Joaquin Smith NHS) to City Limit')],
    'crystal cave waiting shed intersection up to turning point,':
        [(None, 'Crystal Cave Waiting Shed Intersection up to Turning Point')],
    'apts. ambuklao rd., doclas cerio village, summerville (ambuklao rd.)':
        [(None, 'APTS. Ambuklao Rd.'), (None, 'Doclas Cerio Village'), (None, 'Summerville (Ambuklao rd.)')],
    'balacbac, lexber subdivision':
        [(None, 'Balacbac'), (None, 'Lexber Subdivision')],
    'celestial to belshang, suello junction, pacday junction':
        [(None, 'Celestial to Belshang'), (None, 'Suello Junction'), (None, 'Pacday Junction')],
    'ciudad grande-phase 1/2, tetep-an village':
        [(None, 'Ciudad Grande-Phase 1/2'), (None, 'Tetep-an Village')],
    'east/west modernsite,guevarra st., upper malvar st.':
        [(None, 'East/West Modernsite'), (None, 'Guevarra St.'), (None, 'Upper Malvar St.')],
    'food waste collection, iec/qrt (2pm-11pm)':
        [(None, 'Food Waste Collection'), (None, 'IEC/QRT')],
    'iec/qrt, food waste collection (8am-5pm)':
        [(None, 'IEC/QRT'), (None, 'Food Waste Collection')],
    'iec/qrt (8am-5pm)':
        [(None, 'IEC/QRT')],
    'kitma, chapis, justice/pucay village, moldex box, hollywood':
        [(None, 'Kitma'), (None, 'Chapis'), (None, 'Justice/Pucay Village'), (None, 'Moldex Box'), (None, 'Hollywood')],
    'purok 15-agro, add rd., purok 6/7 (boundary)-harvester':
        [(None, 'Purok 15-Agro'), (None, 'ADD Rd.'), (None, 'Purok 6/7 (Boundary)-Harvester')],
    'purok 6 asin, munoz drive, smith drive (3am-12nn)':
        [(None, 'Purok 6 Asin'), (None, 'Munoz Drive'), (None, 'Smith drive')],
    'san carlos, idogan village, sariling sikap':
        [(None, 'San Carlos'), (None, 'Idogan Village'), (None, 'Sariling Sikap')],
    'spring hills, kadaclan, cudirao rd. (in front of baptist school)':
        [(None, 'Spring Hills'), (None, 'Kadaclan'), (None, 'Cudirao Rd. (in front of Baptist School)')],
    'st. patrick rd., upper/lower cypress, up village, balenben':
        [(None, 'St. Patrick Rd.'), (None, 'Upper/Lower Cypress'), (None, 'UP Village'), (None, 'Balenben')],
    'east/west bayan park, leonila hill':
        [('Bayan Park East', 'East Bayan Park'), ('Bayan Park West (Bayan Park, Leonila Hill)', 'Leonila Hill')],
    'east/west modernsite':
        [(None, 'East/West Modernsite')],
    'east/west modernsite, guevarra st., upper malvar st.':
        [(None, 'East/West Modernsite'), (None, 'Guevarra St.'), (None, 'Upper Malvar St.')],
    'east/west bayan park':
        [('Bayan Park East', 'East Bayan Park'), ('Bayan Park West (Bayan Park, Leonila Hill)', 'West Bayan Park')],
    'san vicente, sarok, woodsville (3am-12nn)':
        [('San Vicente', 'San Vicente'), (None, 'Sarok'), (None, 'Woodsville')],
    'st. joseph brgy. (navy base), siapno rd.,amsing, liteng (3am-12nn)':
        [('Saint Joseph Village', "St. Joseph Brgy. (Navy Base)"), (None, 'Siapno Rd.'), (None, 'Amsing'), (None, 'Liteng')],
    'victoria village, quezon hill, (road 1 to 3), mercury/ silver/ copper/ ponce st.':
        [('Victoria Village', 'Victoria Village'), ('Quezon Hill Proper', 'Quezon Hill'), (None, 'Road 1 to 3'), (None, 'Mercury/ Silver/ Copper/ Ponce St.')],
    'upper/lower qm, gefa-aguinaldo':
        [('Quirino-Magsaysay, Upper (Upper QM)', 'Upper/Lower QM'), ('General Emilio F. Aguinaldo (Quirino\u2011Magsaysay, Lower)', 'GEFA-Aguinaldo')],
    'upper rock quarry, palma-urbano, dr. cari\u00f1o st.':
        [('Rock Quarry, Upper', 'Upper Rock Quarry'), ('Palma-Urbano (Cari\u00f1o-Palma)', 'Palma-Urbano'), ('Palma-Urbano (Cari\u00f1o-Palma)', 'Dr. Cari\u00f1o St.')],
    'legarda, naguilian road, paraan, avelino fairview,':
        [('Legarda-Burnham-Kisad', 'Legarda'), (None, 'Naguilian road'), (None, 'Paraan'), (None, 'Avelino Fairview')],
    'legarda, naguilian road, t. alonzo, cuneta and good sheperd':
        [('Legarda-Burnham-Kisad', 'Legarda'), (None, 'Naguilian road'), ('Teodora Alonzo', 'T. Alonzo'), (None, 'Cuneta and Good Sheperd')],
    'legarda, naguilian, lourdes extension':
        [('Legarda-Burnham-Kisad', 'Legarda'), (None, 'Naguilian'), ('Lourdes Subdivision Extension', 'Lourdes Extension')],
    'legarda, naguillan, philsci, purok 12 (irisan) (3am-12nn)':
        [('Legarda-Burnham-Kisad', 'Legarda'), (None, 'Naguillan'), (None, 'PHILSCI'), ('Irisan', 'Purok 12 (Irisan)')],
    'naguilian, legarda':
        [(None, 'Naguilian'), ('Legarda-Burnham-Kisad', 'Legarda')],
    'burnham (3am-12nn), naguilian, legarda':
        [('Legarda-Burnham-Kisad', 'Burnham'), (None, 'Naguilian'), ('Legarda-Burnham-Kisad', 'Legarda')],
    'burnham, naguillan, legarda , suello village, sta. lucia (3am-12nn)':
        [('Legarda-Burnham-Kisad', 'Burnham'), (None, 'Naguillan'), ('Legarda-Burnham-Kisad', 'Legarda'), (None, 'Suello Village'), (None, 'Sta. Lucia')],
    'burnham, rimando bridge to aurora hill (rimando road) (3am-12nn)':
        [('Legarda-Burnham-Kisad', 'Burnham'), (None, 'Rimando Bridge to Aurora Hill (Rimando road)')],
    'burnham-legarda, ferdinand brgy. happy homes':
        [('Legarda-Burnham-Kisad', 'Burnham-Legarda'), ('Ferdinand (Happy Homes-Campo Sioco)', 'Ferdinand Brgy. Happy Homes')],
    'burnham (3am-12nn)':
        [('Legarda-Burnham-Kisad', 'Burnham')],
    'burnham':
        [('Legarda-Burnham-Kisad', 'Burnham')],
    'guisad surong, cresencia, andres bonifacio':
        [('Guisad Sorong', 'Guisad Surong'), ('Cresencia Village', 'Cresencia'), ('Andres Bonifacio (Lower Bokawkan)', 'Andres Bonifacio')],
    'guisad central, easter, pucay st.,richwood square, manzanillo subdivision':
        [('Guisad Central', 'Guisad Central'), (None, 'Easter'), (None, 'Pucay St.'), (None, 'Richwood Square'), (None, 'Manzanillo Subdivision')],
    'imelda marcos, phil-am, sto. rosario':
        [('Imelda R. Marcos (La Salle)', 'Imelda Marcos'), ('Phil-Am', 'Phil-am'), ('Santo Rosario', 'Sto. Rosario')],
    'imelda village, m. roxas, sumulong':
        [('Imelda Village', 'Imelda Village'), ('Manuel A. Roxas', 'M. Roxas'), (None, 'Sumulong')],
    'lourdes proper, lower lourdes, sn roque extn.mrr-queen of peace':
        [('Lourdes Subdivision, Proper', 'Lourdes Proper'), ('Lourdes Subdivision, Lower', 'Lower Lourdes'), ('MRR-Queen of Peace', 'Sn Roque Extn.MRR-Queen of Peace')],
    'lower/upper brookside, east modernsite':
        [('Brookside', 'Lower/Upper Brookside'), ('Modern Site, East', 'East Modernsite')],
    'mines view, gibraltar interior, pucsusan':
        [('Mines View Park', 'Mines View'), ('Gibraltar', 'Gibraltar Interior'), ('Pucsusan', 'Pucsusan')],
    'p. burgos, p. zamora':
        [('Padre Burgos', 'P. Burgos'), ('Padre Zamora', 'P. Zamora')],
    'balsigan, lower pinget':
        [('Balsigan', 'Balsigan'), ('Pinget', 'Lower Pinget')],
    'atok trail, loakan-apugan':
        [('Atok Trail', 'Atok Trail'), ('Apugan-Loakan', 'Loakan-Apugan')],
    'engineers hill, marcoville':
        [("Engineers' Hill", 'Engineers Hill'), ('Bal-Marcoville (Marcoville)', 'Marcoville')],
    'gabriela silang, lower dagsian, hillside':
        [('Gabriela Silang', 'Gabriela Silang'), ('Dagsian, Lower', 'Lower Dagsian'), ('Hillside', 'Hillside')],
    'honeymoon-holyghost, holyghost ext.':
        [('Honeymoon (Honeymoon-Holy Ghost)', 'Honeymoon-Holyghost'), ('Holy Ghost Extension', 'Holyghost Ext.')],
    'city camp proper, city camp central':
        [('City Camp Proper', 'City Camp Proper'), ('City Camp Central', 'City Camp Central')],
    'country club, lucnab':
        [('Country Club Village', 'Country Club'), ('Lucnab', 'Lucnab')],
    'dominican/mirador hill (st. theresa st.)':
        [('Dominican Hill-Mirador', 'Dominican/Mirador Hill (St. Theresa St.)')],
    'fairview,sunny side - tacay rd.':
        [('Fairview Village', 'Fairview'), (None, 'Sunny side - Tacay Rd.')],
    'south central aurora hill,west bayan park village':
        [('Aurora Hill, South Central', 'South Central Aurora Hill'), ('Bayan Park Village', 'West Bayan Park Village')],
    'sta. escolastica,upper dagsian, scout barrio':
        [('Santa Escolastica', 'Sta. Escolastica'), ('Dagsian, Upper', 'Upper Dagsian'), ('Scout Barrio', 'Scout Barrio')],
    'sto. tomas central, dontogan':
        [('Santo Tomas Proper', 'Sto. Tomas Central'), ('Dontogan', 'Dontogan')],
    'cabinet hill, south drive, green water':
        [("Cabinet Hill-Teacher's Camp", 'Cabinet Hill'), ('South Drive', 'South Drive'), ('Greenwater Village', 'Green Water')],
    'sto. ni\u00f1o-slaughter, lower p. burgos, andres bonifacio,incld. bpi compd.':
        [('Slaughter House Area (Santo Ni\u00f1o Slaughter)', 'Sto. Ni\u00f1o-Slaughter'), ('Padre Burgos', 'Lower P. Burgos'), ('Andres Bonifacio (Lower Bokawkan)', 'Andres Bonifacio'), (None, 'incld. BPI Compd.')],
    'dizon subdv., camdas, lower quirino hill, happy homes-old lucban, pines hospital':
        [('Dizon Subdivision', 'Dizon Subdv.'), ('Camdas Subdivision', 'Camdas'), ('Quirino Hill, Lower', 'Lower Quirino Hill'), ('Happy Homes (Happy Homes-Lucban)', 'Happy Homes-Old Lucban'), (None, 'Pines Hospital')],
    'crystal dale subdivision, sto. ni\u00f1o, bengao, greenvalley':
        [(None, 'Crystal Dale Subdivision'), (None, 'Sto. Ni\u00f1o'), (None, 'Bengao'), ('Greenwater Village', 'Greenvalley')],
    'camp 8, sta escolastica, milton-highway, genesis':
        [('Camp 8', 'Camp 8'), ('Santa Escolastica', 'Sta Escolastica'), (None, 'Milton-Highway'), (None, 'Genesis')],
    'mid./lower rock quarry':
        [('Rock Quarry, Middle', 'Mid./Lower Rock Quarry')],
    'brookspoint, purok 1 north sanitary camp':
        [('Brookspoint', 'Brookspoint'), (None, 'Purok 1 North Sanitary Camp')],
    'slu-svp, bakakeng old site, richview square, purok 8-bakakeng norte':
        [('SLU-SVP Housing Village', 'SLU-SVP'), ('Bakakeng Central', 'Bakakeng Old Site'), (None, 'Richview Square'), ('Bakakeng North', 'Purok 8-Bakakeng Norte')],
    'lualhati, minesview/j. felipe st.':
        [('Lualhati', 'Lualhati'), (None, 'Minesview/J. Felipe St.')],
}

# Per-part exact aliases
PART_ALIASES = {
    'ambiong': 'Ambiong', 'kias': 'Kias', 'new lucban': 'New Lucban', 'poliwes': 'Poliwes',
    'balsigan': 'Balsigan', 'pucsusan': 'Pucsusan', 'lucnab': 'Lucnab', 'dontogan': 'Dontogan',
    'south drive': 'South Drive', 'hillside': 'Hillside', 'camp 7': 'Camp 7', 'camp 8': 'Camp 8',
    'phil-am': 'Phil-Am', 'brookspoint': 'Brookspoint', 'san vicente': 'San Vicente',
    'lualhati': 'Lualhati', 'green water': 'Greenwater Village', 'greenvalley': 'Greenwater Village',
    'guisad surong': 'Guisad Sorong', 'guisad central': 'Guisad Central',
    'cresencia': 'Cresencia Village', 'atok trail': 'Atok Trail', 'loakan-apugan': 'Apugan-Loakan',
    'loakan proper': 'Loakan Proper', 'fort del pilar': 'Fort del Pilar',
    'dizon subdv.': 'Dizon Subdivision', 'camdas': 'Camdas Subdivision',
    'imelda village': 'Imelda Village', 'imelda marcos': 'Imelda R. Marcos (La Salle)',
    'm. roxas': 'Manuel A. Roxas', 'sto. rosario': 'Santo Rosario',
    'andres bonifacio': 'Andres Bonifacio (Lower Bokawkan)',
    'lower p. burgos': 'Padre Burgos', 'p. burgos': 'Padre Burgos', 'padre burgos': 'Padre Burgos',
    'sto. ni\u00f1o-slaughter': 'Slaughter House Area (Santo Ni\u00f1o Slaughter)',
    'happy hallow': 'Happy Hollow', 't. alonzo': 'Teodora Alonzo',
    'lourdes extension': 'Lourdes Subdivision Extension', 'lourdes proper': 'Lourdes Subdivision, Proper',
    'lower lourdes': 'Lourdes Subdivision, Lower', 'mrr-queen of peace': 'MRR-Queen of Peace',
    'holyghost ext.': 'Holy Ghost Extension', 'holy ghost extension': 'Holy Ghost Extension',
    'holyghost': 'Holy Ghost Proper', 'holy ghost': 'Holy Ghost Proper',
    'honeymoon-holyghost': 'Honeymoon (Honeymoon-Holy Ghost)', 'country club': 'Country Club Village',
    'burnham': 'Legarda-Burnham-Kisad', 'burnham-legarda': 'Legarda-Burnham-Kisad',
    'legarda': 'Legarda-Burnham-Kisad', 'kisad st.': 'Legarda-Burnham-Kisad',
    'fairview': 'Fairview Village', 'east modernsite': 'Modern Site, East',
    'west modernsite': 'Modern Site, West', 'lower/upper brookside': 'Brookside',
    'cabinet hill': "Cabinet Hill-Teacher's Camp", "teacher's camp": "Cabinet Hill-Teacher's Camp",
    'mines view': 'Mines View Park', 'gibraltar interior': 'Gibraltar',
    'engineers hill': "Engineers' Hill", 'marcoville': 'Bal-Marcoville (Marcoville)',
    'upper dagsian': 'Dagsian, Upper', 'lower dagsian': 'Dagsian, Lower', 'scout barrio': 'Scout Barrio',
    'santa escolastica': 'Santa Escolastica', 'sta escolastica': 'Santa Escolastica',
    'sta. escolastica': 'Santa Escolastica', 'sto. tomas central': 'Santo Tomas Proper',
    'pinsao pilot': 'Pinsao Pilot Project', 'pinsao proper': 'Pinsao Proper',
    'city camp proper': 'City Camp Proper', 'city camp central': 'City Camp Central',
    'bakakeng norte': 'Bakakeng North', 'bakakeng old site': 'Bakakeng Central',
    'dominican/mirador hill (st. theresa st.)': 'Dominican Hill-Mirador',
    'a. tabora': 'Alfonso Tabora', 'trancoville': 'Trancoville', 'victoria village': 'Victoria Village',
    'quezon hill': 'Quezon Hill Proper', 'upper qm': 'Quirino-Magsaysay, Upper (Upper QM)',
    'lower qm': 'General Emilio F. Aguinaldo (Quirino\u2011Magsaysay, Lower)',
    'gefa-aguinaldo': 'General Emilio F. Aguinaldo (Quirino\u2011Magsaysay, Lower)',
    'upper rock quarry': 'Rock Quarry, Upper', 'lower rock quarry': 'Rock Quarry, Lower',
    'middle rock quarry': 'Rock Quarry, Middle', 'mid./lower rock quarry': 'Rock Quarry, Middle',
    'palma-urbano': 'Palma-Urbano (Cari\u00f1o-Palma)',
    'san roque village': 'San Roque Village', 'san luis': 'San Luis Village',
    'north sanitary camp': 'Sanitary Camp, North', 'south sanitary camp': 'Sanitary Camp, South',
    'military cut-off': 'Military Cut-off', 'bgh hospital': 'BGH Compound',
    'pacdal circle': 'Pacdal', 'salud mitra': 'Salud Mitra', 'upper magsaysay': 'Upper Magsaysay',
    'san antonio village': 'San Antonio Village', 'kayang hilltop': 'Kayang-Hilltop',
    'kayang extn. (labsan)': 'Kayang Extension', 'camp allen': 'Camp Allen',
    'upper market': 'Market Subdivision, Upper', 'campo filipino': 'Campo Filipino',
    'st. joseph brgy. (navy base)': 'Saint Joseph Village',
    'lower gen. luna': 'General Luna, Lower', 'upper gen. luna': 'General Luna, Upper',
    'cbd session road': 'Session Road Area', 'south central aurora hill': 'Aurora Hill, South Central',
    'west bayan park village': 'Bayan Park Village', 'east bayan park': 'Bayan Park East',
    'west bayan park': 'Bayan Park West (Bayan Park, Leonila Hill)',
    'leonila hill': 'Bayan Park West (Bayan Park, Leonila Hill)',
    'gabriela silang': 'Gabriela Silang', 'upper quezon hill': 'Quezon Hill, Upper',
    'middle quezon hill': 'Middle Quezon Hill Subdivision (Quezon Hill Middle)',
    'new lucban-interior': 'New Lucban', 'purok 1 to 6 irisan': 'Irisan',
    'purok 16,17,18 irisan': 'Irisan', 'purok 12 (irisan)': 'Irisan',
    'happy homes-old lucban': 'Happy Homes (Happy Homes-Lucban)', 'magsaysay': 'Magsaysay, Lower',
    'igorot park': 'Rizal Monument Area', 'pinget': 'Pinget', 'lower pinget': 'Pinget',
    'slu-svp': 'SLU-SVP Housing Village',
}


def clean(s):
    s = re.sub(r'\s+', ' ', s.strip().lower())
    s = re.sub(r'\s*\(\d{1,2}(?:am|pm|nn)\s*-\s*\d{1,2}(?:am|pm|nn)\)\s*', '', s)
    return s.strip().rstrip(',').strip()


def token_words(value):
    """Punctuation/case-insensitive words for name comparisons, not output."""
    value = repair_mojibake(str(value))
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(char for char in value if not unicodedata.combining(char))
    return re.findall(r'[a-z0-9]+', clean(value))


def repair_mojibake(value):
    """Repair common UTF-8-as-Latin-1 corruption for comparison only."""
    try:
        if 'â€' in value:
            return value.encode('cp1252').decode('utf-8')
        return value.encode('latin-1').decode('utf-8') if 'Ã' in value else value
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def find_barangay(barangay_name):
    if barangay_name in barangay_sites:
        return barangay_name
    target = token_words(barangay_name)
    for actual_name in barangay_sites:
        if token_words(actual_name) == target:
            return actual_name
    return None


def get_sites(barangay_name):
    actual_name = find_barangay(barangay_name)
    return barangay_sites.get(actual_name, []) if actual_name else []


def is_corridor(area_str):
    words = set(token_words(area_str))
    return bool(words & {
        'to', 'road', 'rd', 'street', 'st', 'highway', 'hwy', 'drive',
        'bridge', 'overpass', 'junction', 'intersection', 'boundary',
        'limit', 'circle', 'corner', 'corridor', 'route', 'up', 'until', 'trail',
    })


def map_query(area_str):
    return 'https://www.google.com/maps/search/?api=1&query=' + quote_plus(
        f'{area_str}, Baguio City, Benguet'
    )


CITY_ROAD_MAP = 'https://www.istructe.org/sitefiles/handlers/downloadfile.ashx?productid=9277'
CITY_TRAFFIC_MAP = 'https://alternateroutes.baguio.gov.ph/'
SENATE_ROUTES = 'https://www.senate.gov.ph/lisdata/105719049%21.pdf'
PSA_BARANGAYS = 'https://psa.gov.ph/classification/psgc/barangays/1430300000'
BAKAKENG_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/bakakeng-north'
CAMP7_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/camp-7'
CAMP7_STREETS = 'https://philippines-streets.openalfa.com/camp-7_baguio-city'
PIAS_MAP = 'https://philippines.worldplaces.me/places-in-baguio-city/44507033-pias-rd-camp-7-baguio-city.html'
TETEP_MAP = 'https://www.waze.com/live-map/directions/ph/car/baguio/tetep-an-village?to=place.ChIJhVGICOCgkTMR-kbOHwu2E8o'
ASIN_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/asin'
IRISAN_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/irisan'
IRISAN_PUROK6_MAP = 'https://mapcarta.com/N10845878656'
IRISAN_PUROK12_MAP = 'https://mapcarta.com/N9220474705'
IRISAN_PUROK18_MAP = 'https://ph.geoview.info/add_road_purok_18%2C10682078009n'
LOAKAN_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/loakan-proper'
LIWANAG_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/liwanag-loakan'
SANTO_TOMAS_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/santo-tomas-proper'
LEGARDA_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio/legarda-burnham-kisad'
RIMANDO_MAP = 'https://mapcarta.com/W1073509840'
BWD_ROUTES = 'https://storage.googleapis.com/request-attachments/f1GbvBTR5EBdA7iQi8iqWciOP9hWzQvPgQ3bdjeJSO2ACTDOzECRFon11fJSMgZjUYSNCJe2ILtLc1MIcPb3xI4vUBQ15ghVxUGg/BWD%20Letter.Jaemar%20Reyes_request%20through%20foi%20website.02242021.pdf'
CITYWIDE_BIR = 'https://ren.ph/tools/zonal-value/benguet/baguio'

ROAD_CONTEXTS = [
    (('camp 7', 'youngland', 'pias', 'woodsgate', 'amistad', 'lexber', 'parisas'),
     'Kennon Road; Pias Road; Middle Youngland Road; Ticuan Road; Woodsgate/Richgate access roads',
     [CAMP7_BIR, CAMP7_STREETS, PIAS_MAP]),
    (('tetep', 'ciudad grande', 'bakakeng norte', 'bakakeng north'),
     'Bakakeng Sur Road; Ticuan Road; Marcos/Ben Palispis Highway and the named subdivision roads',
     [BAKAKENG_BIR, TETEP_MAP, SENATE_ROUTES]),
    (('overpass slu', 'rimando bridge', 'kalkalan', 'rimando road'),
     'Lower Bonifacio Road; Rimando Road; the SLU/overpass approach',
     [RIMANDO_MAP, SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('ric 2', 'bokawkan', 'lower bonifacio', 'upper bonifacio', 'magsaysay'),
     'Bokawkan Road; Lower/Upper Bonifacio Street; Magsaysay Avenue; Claro M. Recto Street where named',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, SENATE_ROUTES]),
    (('ric 1', 'military cut-off', 'teacher', 'pacdal', 'leonard wood', 'south drive', 'ymca'),
     'Military Cut-Off Road; Leonard Wood Road; South Drive; Teacher’s Camp internal access; Pacdal Circle',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, SENATE_ROUTES]),
    (('market 1', 'market 2', 'market 3', 'cbd', 'session road', 'abanao', 'kayang', 'otek', 'kisad'),
     'Magsaysay Avenue; Abanao Street; Kayang Street; Session Road; Harrison Road; Otek/Kisad streets as named',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, LEGARDA_BIR]),
    (('purok 12 (irisan)',),
     'Legarda Road; Naguilian Road; Quirino Highway to Purok 12; Purok 12 local access roads',
     [LEGARDA_BIR, IRISAN_BIR, IRISAN_PUROK12_MAP, BWD_ROUTES, CITY_TRAFFIC_MAP]),
    (('legarda', 'burnham', 'naguilian', 'naguillan', 'paraan', 'fairview'),
     'Legarda Road; Naguilian Road; Kisad Road; route-specific connector streets named in the schedule',
     [LEGARDA_BIR, CITY_ROAD_MAP, CITY_TRAFFIC_MAP]),
    (('asin', 'munoz', 'smith drive'),
     'Asin Road National Highway; Joaquin Smith Road; named Munoz/Smith drives',
     [ASIN_BIR, CITY_TRAFFIC_MAP]),
    (('purok 1 to 6 irisan',),
     'Quirino/Naguilian Highway approach; Purok 1–3 via Blist Getcha, La Chesa, Mang-os Road and Tadiangan/Tuba approaches; Purok 4–6 via Apugan Canon Road, Luna Street and Postal Ville Osio Road',
     [IRISAN_BIR, BWD_ROUTES, IRISAN_PUROK6_MAP, CITY_TRAFFIC_MAP]),
    (('purok 16,17,18 irisan',),
     'Quirino Highway; Agro Loop; Add Road; Purok 18 access; San Luis Extension and Saguid Road approaches',
     [IRISAN_BIR, BWD_ROUTES, IRISAN_PUROK18_MAP, CITY_TRAFFIC_MAP]),
    (('irisan', 'agro', 'philsci', 'naguilian'),
     'Naguilian Road; Agro Loop/Add Road and the named Irisan purok roads',
     [IRISAN_BIR, CITY_TRAFFIC_MAP]),
    (('loakan', 'fort del pilar', 'marcos highway', 'suello', 'bakbakan'),
     'Loakan Road; Ben Palispis/Marcos Highway; Pidawan–Maridit Road; feeder roads named in the schedule',
     [LOAKAN_BIR, LIWANAG_BIR, SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('pinsao', 'tam-awan', 'aguinalde'),
     'Tam-Awan Road; Pinsao Pilot/Proper access roads; named highway boundary route',
     [SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('quirino hill', 'quezon hill', 'lamug', 'pldt-naguilian'),
     'Quezon Hill Road; Lamug Street; Quirino Highway/Naguilian Road',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('aurora hill', 'sanitary camp', 'malvar', 'yap st', 'trancoville', 'tabora'),
     'Rimando Road; Malvar Street; Yap Street; Sgt. Floresca Street; Magsaysay Avenue',
     [BWD_ROUTES, SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('camp 8', 'kenn(on)', 'kias'),
     'Kennon Road; Camp 8 and Kias barangay access roads',
     [CAMP7_BIR, CITY_TRAFFIC_MAP]),
    (('country club', 'lucnab', 'lualhati', 'mines view', 'gibraltar', 'pucsusan', 'outlook drive'),
     'Outlook Drive; South Drive; Loakan Road; Gibraltar/Mines View local access roads',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('sto. tomas', 'dontogan', 'balacbac', 'greenwater', 'crystal dale', 'bengao'),
     'Ben Palispis/Marcos Highway and the named barangay/subdivision connector roads',
     [SANTO_TOMAS_BIR, CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('guisad', 'bokawkan', 'andres bonifacio', 'pucay', 'easter'),
     'Bokawkan Road; Easter Road; Pucay Street; Lower Bonifacio connectors',
     [SENATE_ROUTES, CITY_ROAD_MAP, CITY_TRAFFIC_MAP]),
    (('ambiong', 'kias'),
     'Ambiong Road and Loakan Road; use the named barangay connector streets for the final approach',
     ['https://legacy.senate.gov.ph/lisdata/1191810531%21.pdf', CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('dominican', 'mirador', 'st. theresa'),
     'Dominican Road; St. Theresa Street; Marcos/Ben Palispis Highway approach',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('campo filipino', 'camp allen', 'ferguson', 'kayang extension'),
     'Ferguson Road; Kayang Extension; Camp Allen and Campo Filipino local streets',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('padre burgos', 'p. burgos', 'p. zamora', 'zamora'),
     'Padre Burgos Street; Padre Zamora Street; Lower Bonifacio/Bokawkan approach',
     [CITY_ROAD_MAP, SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('rock quarry', 'palma-urbano', 'carino'),
     'Palma-Urbano/Cariño streets; Kisad Road and the Rock Quarry access road',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('modernsite', 'guevarra', 'upper malvar'),
     'Guevarra Street; Upper Malvar Street; Rimando Road approach',
     [BWD_ROUTES, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('quezon hill', 'lamug', 'quirino highway'),
     'Quezon Hill Road; Lamug Street; Quirino Highway/Naguilian Road',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('bayan park', 'brookside', 'brookspoint', 'trancoville', 'tabora'),
     'Rimando Road; Magsaysay Avenue; Trancoville and barangay connector streets',
     [BWD_ROUTES, SENATE_ROUTES, CITY_TRAFFIC_MAP]),
    (('ambuklao', 'doclas cerio', 'summerville'),
     'Ambuklao Road and the named Doclas Cerio/Summerville subdivision approaches',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('balsigan', 'lower pinget', 'dreamland pinget', 'central pinget'),
     'Balsigan Road; Pinget local roads; Magsaysay Avenue is the town-side approach for Pinget routes',
     [CITY_TRAFFIC_MAP, CITYWIDE_BIR, 'https://philippines-streets.openalfa.com/baguio-city']),
    (('city camp',),
     'City Camp Road; Kisad Road; Naguilian Road approach',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, 'https://www.scribd.com/doc/161140459/map']),
    (('crystal cave', 'turning point'),
     'Crystal Cave Road; Ben Palispis/Marcos Highway approach',
     ['https://mapcarta.com/N3529908068', 'https://www.waze.com/live-map/directions/ph/car/baguio/crystal-cave%2C-old-turning-point?to=place.ChIJ9Wl9N0ahkTMRBIplEZPAUEs', CITY_TRAFFIC_MAP]),
    (('engineers hill', 'marcoville'),
     'Engineers’ Hill and Marcoville local roads; Calderon Street and Session Road are town-side approaches',
     [CITY_ROAD_MAP, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('gabriela silang', 'lower dagsian', 'hillside'),
     'Gabriela Silang Road; Hillside Road; Lower Dagsian local roads; Loakan Road approach',
     ['https://philippines-streets.openalfa.com/streets/hillside-road-hillside-gabriela-silang-baguio-city', 'https://ltfrb.gov.ph/wp-content/uploads/2024/05/RESO-053-S-2024-1.pdf', CITY_TRAFFIC_MAP]),
    (('honeymoon', 'holyghost', 'holy ghost'),
     'Honeymoon Road; Holy Ghost Extension Road; Governor Pack Road town-side approach',
     ['https://www.scribd.com/document/943402208/Open-RDO-No-8-Baguio-City', 'https://www.waze.com/live-map/directions/ph/car/baguio/holy-ghost-road-extension?to=place.Ei9Ib2x5IEdob3N0IFJkIEV4dCwgQmFndWlvLCBCZW5ndWV0LCBQaGlsaXBwaW5lcyIuKiwKFAoSCUde5SBZoZEzEbTSmZGnvxQaEhQKEgk_8d55aKGRMxHAdTq-NPXejg', CITY_TRAFFIC_MAP]),
    (('food waste', 'iec/qrt'),
     'The schedule names an operational collection (Food Waste/IEC/QRT), not a geographic route or road; no truck-access road can be identified from this label.',
     [CITY_TRAFFIC_MAP, PSA_BARANGAYS]),
    (('imelda marcos', 'phil-am', 'sto. rosario'),
     'Phil-Am Road; local Santo Rosario/Imelda Marcos streets; Naguilian Road approach',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('imelda village', 'm. roxas', 'sumulong'),
     'Manuel Roxas Street; Sumulong Street; Imelda Village Road',
     ['https://www.waze.com/live-map/directions/ph/car/baguio/65-m.-roxas-st?to=place.ChIJ_XtBkFmhkTMRZBRrkmImshk', 'https://philippines-streets.openalfa.com/streets/imelda-village-road-east-modern-site-holy-ghost-extension-baguio-city', CITY_TRAFFIC_MAP]),
    (('lourdes proper', 'lower lourdes', 'queen of peace', 'sn roque ext'),
     'Queen of Peace Road; MRR/Queen of Peace connectors; Dominican Road and City Camp Road approaches',
     ['https://ldr.senate.gov.ph/sites/default/files/2023-03/1191810531%21.pdf', BWD_ROUTES, CITY_TRAFFIC_MAP]),
    (('new lucban',),
     'New Lucban Road; Magsaysay Avenue; Rimando Road connector',
     ['https://ren.ph/tools/zonal-value/benguet/baguio/new-lucban', 'https://ldr.senate.gov.ph/sites/default/files/2023-03/1191810531%21.pdf', CITY_TRAFFIC_MAP]),
    (('upper san carlos',),
     'San Carlos Heights Road; local Upper San Carlos Heights access roads',
     ['https://www.waze.com/en-GB/live-map/directions/ph/car/baguio/san-carlos-heights-road?to=place.EjBTYW4gQ2FybG9zIEhlaWdodHMsIEJhZ3VpbywgQmVuZ3VldCwgUGhpbGlwcGluZXMiLiosChQKEgknrY4-maGRMxEy8fssmMS5BRIUChIJP_HeeWihkTMRwHU6vjT13o4', 'https://mapcarta.com/N9143386726', CITY_TRAFFIC_MAP]),
    (('san carlos', 'idogan', 'sariling sikap'),
     'Cordillera Road; Idogan Village and Sariling Sikap local access streets; Asin Road approach',
     [BWD_ROUTES, ASIN_BIR, CITY_TRAFFIC_MAP]),
    (('san luis', 'san roque', 'shangrila', 'recoletos'),
     'San Luis Village Extension Road; San Roque Village Subdivision Road; Shangrila Subdivision Road; Quirino Highway approach',
     ['https://legacy.senate.gov.ph/lisdata/1191810531%21.pdf', CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('san vicente', 'sarok', 'woodsville'),
     'Loakan Road; Woodsville and San Vicente local roads; Marcos/Ben Palispis Highway approach',
     [CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
    (('spring hills', 'kadaclan', 'cudirao'),
     'Cudirao Road; Spring Hills/Kadaclan local roads; Loakan Road approach',
     [LOAKAN_BIR, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('st. joseph', 'navy base', 'siapno', 'amsing', 'liteng'),
     'Navy Base Road; Siapno Road; Liteng access road; Leonard Wood Road town-side approach',
     ['https://ldr.senate.gov.ph/sites/default/files/2023-03/1191810531%21.pdf', CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('st. patrick', 'cypress', 'up village', 'balenben'),
     'St. Patrick Road; Cypress and UP Village access roads; Loakan Road approach',
     [LOAKAN_BIR, CITY_TRAFFIC_MAP, CITYWIDE_BIR]),
    (('sta. escolastica', 'santa escolastica', 'upper dagsian', 'scout barrio'),
     'Santa Escolastica Drive; Upper Dagsian Road; Scout Barrio Road; Loakan Road',
     ['https://philippines-streets.openalfa.com/streets/santa-escolastica-drive-purok-7-upper-dagsian-dagsian-lower-baguio-city', 'https://whereisit.altervista.org/zonal-value-barangay-scout-barrio-baguio-city-89467/', CITY_TRAFFIC_MAP]),
    (('upper/lower qm', 'gefa-aguinaldo'),
     'Quirino-Magsaysay Road I/II; Jose Felipe Street; Aguinaldo/Lower QM connectors',
     ['https://ldr.senate.gov.ph/sites/default/files/2023-03/1191810531%21.pdf', CITYWIDE_BIR, CITY_TRAFFIC_MAP]),
]


def research_for_area(area_str):
    lower = clean(area_str)
    roads = ''
    sources = [map_query(area_str)]
    for keys, road_text, refs in ROAD_CONTEXTS:
        if any(key in lower for key in keys):
            roads = road_text
            sources.extend(refs)
            break
    if not roads:
        roads = 'No truck road is named in this collection label; use the exact locality map query to verify the barangay access road.'
        sources.extend([CITYWIDE_BIR, CITY_TRAFFIC_MAP])
    if not any(url.startswith('https://ren.ph/') for url in sources):
        sources.append(CITYWIDE_BIR)
    sources.append(PSA_BARANGAYS)
    research_confidence = 'Medium' if roads and 'no truck-access road' not in roads.lower() and not roads.startswith('No truck road') else 'Low'
    likely_location = f'{area_str}, Baguio City, Benguet (exact subdivision boundary not specified in schedule)'
    research_note = 'The map link locates the exact schedule wording; cited road and locality references support the likely route. These sources do not establish that every subdivision lane is truck-accessible.'
    if 'purok 1 to 6 irisan' in lower:
        likely_location = 'Irisan Puroks 1–6, Baguio City; the route spans several purok groups and needs a boundary check against source coordinates.'
        research_note = 'The BWD route schedule identifies separate Purok 1–3 and Purok 4–7 road groups. The SWMD CSV has no per-site purok field, so the coordinate envelope is approximate and requires review.'
    elif 'purok 16,17,18 irisan' in lower:
        likely_location = 'Irisan Puroks 16–18, Baguio City, around the Agro Loop and Purok 18 access roads.'
        research_note = 'BWD/BIR road listings support the named Agro, Quirino Highway, and Purok 18 approaches. The SWMD CSV has no per-site purok field; the coordinate envelope is approximate and requires review.'
    elif 'purok 12 (irisan)' in lower:
        likely_location = 'Purok 12, Irisan, Baguio City, combined in the schedule with Legarda, Naguilian Road, and PHILSCI.'
        research_note = 'Mapcarta locates Purok 12 and the BWD road list gives nearby Irisan route context. The SWMD CSV has no per-site purok field, so the radius is approximate and requires review.'
    return {
        'area_name_exact': area_str,
        'likely_location': likely_location,
        'truck_accessible_roads': roads,
        'map_lookup_url': map_query(area_str),
        'research_source_urls': '; '.join(dict.fromkeys(sources)),
        'research_confidence': research_confidence,
        'human_review_required': 'Yes' if research_confidence == 'Low' or is_corridor(area_str) or 'purok ' in lower else 'No',
        'research_note': research_note,
    }


def resolve_barangays(area_str):
    """Return the CSV barangays explicitly tied to a route by the existing alias table."""
    key = clean(area_str)
    mapped = []
    unknown = []
    if key in FULL_ALIASES:
        for barangay, raw in FULL_ALIASES[key]:
            if barangay:
                mapped.append((barangay, raw, 'curated whole-area route alias'))
            else:
                unknown.append(raw)
    else:
        # Punctuation and case normalization are used for comparison only.
        parts = [p.strip() for p in area_str.split(',') if p.strip()]
        for part in parts:
            pk = clean(part)
            if pk in PART_ALIASES:
                mapped.append((PART_ALIASES[pk], part, 'curated word-level route alias'))
            elif token_words(part) == token_words('Purok 1 North Sanitary Camp'):
                mapped.append(('Sanitary Camp, North', part, 'word-order and qualifier match: Purok 1 is the north sanitary-camp SWMD row'))
            elif find_barangay(part):
                mapped.append((find_barangay(part), part, 'schedule wording matches SWMD barangay name after punctuation/case/encoding normalization'))
            else:
                unknown.append(part)
    return mapped, unknown


def distance_m(lat1, lon1, lat2, lon2):
    from math import cos, radians, sqrt
    dy = (lat1 - lat2) * 111_320
    dx = (lon1 - lon2) * 111_320 * cos(radians((lat1 + lat2) / 2))
    return sqrt(dx * dx + dy * dy)


CAMP7_AREA_NAMES = {
    'camp 7 (woodsgate/ richgate/ monticello)': 'Camp 7 (Woodsgate/ Richgate/ Monticello)',
    'camp 7 (amistad, peters ville, lexber hts, parisas': 'Camp 7 (Amistad,Peters Ville, Lexber Hts, Parisas',
    'camp 7, pias, youngland': 'Camp 7, Pias, Youngland',
}
CAMP7_ANCHORS = {
    'camp 7 (woodsgate/ richgate/ monticello)': [(16.39015, 120.60368), (16.38005, 120.60408)],
    'camp 7 (amistad, peters ville, lexber hts, parisas': [(16.3834, 120.6019)],
    'camp 7, pias, youngland': [(16.38409, 120.60551)],
}
IRISAN_ROUTE_AREAS = {
    'purok 1 to 6 irisan': 'Purok 1 to 6 Irisan',
    'legarda, naguillan, philsci, purok 12 (irisan)':
        'Legarda, Naguillan, PHILSCI, Purok 12 (Irisan) (3am-12nn)',
    'purok 16,17,18 irisan': 'Purok 16,17,18 Irisan',
}
IRISAN_ROUTE_ANCHORS = {
    'purok 1 to 6 irisan': (16.42077, 120.55291, 1800),       # Purok 6 map point; BWD lists P1–3/P4–7 road groups.
    'legarda, naguillan, philsci, purok 12 (irisan)': (16.41747, 120.56073, 650),
    'purok 16,17,18 irisan': (16.41160, 120.56193, 1500),     # Add Road Purok 18 OSM point.
}


def fallback_marker(area_str):
    marker_name = 'firingline' if is_corridor(area_str) else ''
    return {'site_name': marker_name, 'latitude': None, 'longitude': None}


def site_object(site_row):
    site = {
        'site_name': site_row['site_name'],
        'latitude': site_row['latitude'],
        'longitude': site_row['longitude'],
    }
    if site_row.get('coordinates_valid'):
        site.update({
            'source_purok': site_row.get('purok', ''),
            'purok_candidate': site_row.get('purok_candidate', ''),
            'purok_check': site_row.get('purok_check', ''),
            'street_or_road': site_row.get('street_or_road', ''),
            'map_label': site_row.get('map_label', ''),
            'map_lookup_status': site_row.get('map_lookup_status', ''),
            'map_lookup_url': site_row.get('map_lookup_url', ''),
            'google_maps_url': site_row.get('google_maps_url', ''),
        })
    return site


def split_schedule_components(area_str):
    """Split comma-separated schedule fragments, preserving their exact text."""
    parts = []
    start = 0
    paren_depth = 0
    for index, char in enumerate(area_str):
        if char == '(':
            paren_depth += 1
        elif char == ')' and paren_depth:
            paren_depth -= 1
        elif char == ',' and paren_depth == 0:
            part = area_str[start:index]
            if part.strip():
                parts.append(part)
            start = index + 1
    final_part = area_str[start:]
    if final_part.strip():
        parts.append(final_part)
    return parts or [area_str]


def component_barangays(area_str, component):
    """Return source barangay groups explicitly associated with one fragment."""
    area_key = clean(area_str)
    component_key = clean(component)
    targets = []

    def add_target(name):
        actual_name = find_barangay(name) or name
        if actual_name not in targets:
            targets.append(actual_name)

    # Whole-label aliases retain the exact schedule fragment in their raw field.
    # For aliases written against the whole label, associate a source group with
    # a fragment only when its meaningful name words occur in that fragment.
    for barangay, raw in FULL_ALIASES.get(area_key, []):
        if not barangay:
            continue
        if clean(raw) == component_key:
            add_target(barangay)
            continue
        if clean(raw) == area_key:
            generic = {'area', 'barangay', 'brgy', 'village', 'subdivision', 'compound'}
            target_words = set(token_words(barangay)) - generic
            component_words = set(token_words(component))
            if target_words and target_words.issubset(component_words):
                add_target(barangay)

    if component_key in PART_ALIASES:
        add_target(PART_ALIASES[component_key])
    elif token_words(component) == token_words('Purok 1 North Sanitary Camp'):
        add_target('Sanitary Camp, North')
    elif find_barangay(component):
        add_target(find_barangay(component))
    return targets


def pickup_time_for_component(driver_name, day_name, component, target_barangays):
    """Reuse an old per-area pickup window only when its area is identifiable."""
    legacy_areas = legacy_schedule_by_driver_day.get((driver_name, day_name), [])
    component_words = token_words(component)
    exact = [
        area for area in legacy_areas
        if token_words(area.get('barangay', '')) == component_words
    ]
    matches = exact
    if not matches and target_barangays:
        target_names = {find_barangay(name) or name for name in target_barangays}
        matches = [
            area for area in legacy_areas
            if (find_barangay(area.get('barangay', '')) or area.get('barangay', '')) in target_names
        ]
    values = {str(area.get('pick up time', '') or '').strip() for area in matches}
    return values.pop() if len(values) == 1 else ''


def component_index_for_site(site_row, components):
    """Place an already-matched source point under its closest schedule fragment."""
    site_barangay = find_barangay(site_row['barangay']) or site_row['barangay']
    direct = [
        index for index, component in enumerate(components)
        if site_barangay in component['target_barangays']
    ]
    site_words = set(token_words(site_row['barangay'])) - {
        'area', 'barangay', 'brgy', 'village', 'subdivision', 'compound', 'purok',
    }

    def score(index):
        component = components[index]
        words = set(token_words(component['area_name']))
        for target in component['target_barangays']:
            words.update(token_words(target))
        words -= {'area', 'barangay', 'brgy', 'village', 'subdivision', 'compound', 'purok'}
        return len(site_words & words)

    if direct:
        return max(direct, key=score)
    if len(components) == 1:
        return 0
    best = max(range(len(components)), key=score)
    if score(best) > 0:
        return best
    return 0


def format_schedule_areas(area_str, resolved_areas, driver_name, day_name):
    """Emit one per-day area object per exact schedule fragment."""
    components = []
    for component_name in split_schedule_components(area_str):
        targets = component_barangays(area_str, component_name)
        components.append({
            'area_name': component_name,
            'target_barangays': targets,
            'site_rows': [],
        })

    for source_id in sorted(area_to_row_ids.get(area_str, set())):
        site_row = source_site_by_row[source_id]
        component_index = component_index_for_site(site_row, components)
        components[component_index]['site_rows'].append(site_row)

    # Keep the aggregate resolver's fallback count and text unchanged, attaching
    # its marker to the first fragment still lacking a confirmed source point.
    aggregate_sites = resolved_areas[0]['sites'] if resolved_areas else []
    markers = [
        site for site in aggregate_sites
        if site['latitude'] is None and site['longitude'] is None
    ]
    marker_index = next(
        (index for index, component in enumerate(components) if not component['site_rows']),
        next((index for index, component in enumerate(components) if is_corridor(component['area_name'])), 0),
    )

    area_objects = []
    for index, component in enumerate(components):
        sites = [site_object(site) for site in component['site_rows']]
        if index == marker_index:
            sites.extend(markers)
        area_objects.append({
            'barangay': component['area_name'],
            'area_name': component['area_name'],
            'sites': sites,
            'pick up time': pickup_time_for_component(
                driver_name, day_name, component['area_name'], component['target_barangays'],
            ),
        })
    return area_objects


schedule_area_rows = {}
assignment_reasons = {}
assignment_confidence = {}
invalid_area_candidates = {}
irisan_unresolved_candidates = {}
area_metadata = {}
area_to_row_ids = {}


def resolve_area_sites(area_str):
    """Resolve source rows, add transparent route fallback, and retain exact label."""
    area_id = area_str
    meta = research_for_area(area_str)
    area_metadata[area_id] = meta
    mapped, unknown_parts = resolve_barangays(area_str)
    key = clean(area_str)
    irisan_route_key = key if key in IRISAN_ROUTE_AREAS else None
    selected = {}
    reasons = {}
    confidence = {}

    # Ordinary explicit barangay/alias matches. Invalid or missing coordinates
    # are not emitted as confirmed site objects.
    for barangay, raw_part, why in mapped:
        # The three Irisan labels name separate Purok groups. A full-barangay
        # alias would ignore those qualifiers, so route them through the
        # coordinate/anchor check below instead.
        if barangay == 'Irisan' and irisan_route_key:
            continue
        for site in get_sites(barangay):
            if not site['coordinates_valid']:
                invalid_area_candidates.setdefault(site['source_row'], set()).add(area_id)
                continue
            source_id = site['source_row']
            selected[source_id] = site
            reasons[source_id] = f'{why}; schedule fragment {raw_part!r} resolves to SWMD barangay {barangay!r}, with a valid source coordinate.'
            confidence[source_id] = 'High' if why.startswith('schedule wording') else 'Medium'

    # Camp 7 has several separate route labels and generic Site 1–20 records.
    # Use nearby named anchors to keep them from being copied to all three routes.

    def include_group(barangay, reason, certainty='Medium', predicate=None):
        for site in get_sites(barangay):
            if predicate and not predicate(site):
                continue
            source_id = site['source_row']
            if not site['coordinates_valid']:
                invalid_area_candidates.setdefault(source_id, set()).add(area_id)
                continue
            selected[source_id] = site
            reasons[source_id] = reason
            confidence[source_id] = certainty

    if irisan_route_key:
        max_distance = IRISAN_ROUTE_ANCHORS[irisan_route_key][2]
        for site in get_sites('Irisan'):
            source_id = site['source_row']
            if not site['coordinates_valid']:
                invalid_area_candidates.setdefault(source_id, set()).add(area_id)
                continue
            nearest_key, nearest_distance = min(
                [
                    (
                        route_key,
                        distance_m(site['latitude'], site['longitude'], anchor[0], anchor[1]),
                    )
                    for route_key, anchor in IRISAN_ROUTE_ANCHORS.items()
                ],
                key=lambda item: item[1],
            )
            if nearest_key != irisan_route_key:
                continue
            if nearest_distance > max_distance:
                irisan_unresolved_candidates.setdefault(source_id, set()).add(area_id)
                continue
            selected[source_id] = site
            reasons[source_id] = (
                f'The schedule names {IRISAN_ROUTE_AREAS[irisan_route_key]!r}; this Irisan coordinate is '
                f'{nearest_distance:.0f} m from its mapped Purok anchor and nearest to this route among the '
                'three named Irisan Purok groups. The SWMD row lacks a per-site Purok field, so this is an '
                'approximate location match requiring local boundary review.'
            )
            confidence[source_id] = 'Low'

    # Previously unmapped route phrases with direct word or location support.
    if any(label in key for label in ('market 1', 'market 2', 'market 3')):
        include_group(
            'Abanao-Zandueta-Kayong-Chugum-Otek (AZKCO)',
            'AZKCO is the SWMD barangay whose name includes Abanao, Kayong and Otek; the Market collection labels name Abanao/Kayang/Otek and its coordinates fall within the central market block range. The SWMD rows do not identify which market subroute serves each stop.',
            'Medium',
        )
    if 'market 1' in key:
        include_group(
            'Malcolm Square-Perfecto (Jose Abad Santos)',
            'The coordinates are in the Malcolm Square/Kilometer 0 block, explicitly included as Km.0 and Igorot Park in the Market 1 collection.',
            'Medium',
        )
    if 'market 3' in key:
        include_group(
            'Harrison-Claudio Carantes',
            'The SWMD coordinate is in the central Harrison/Kisad block; Market 3 explicitly names Kisad Street. This single point is a route-range match and should be checked on the map.',
            'Medium',
        )
    if 'cbd session road' in key:
        include_group(
            'Kabayanihan',
            'The BIR street index places Session Road in Kabayanihan, and the schedule names the CBD/Session Road corridor.',
            'Medium',
        )
        include_group(
            'Kagitingan',
            'These coordinates are in the central Session Road/Lower Gen. Luna block range covered by the CBD corridor; the barangay name is not in the route wording, so this is a low-confidence location match.',
            'Low',
        )
    if 'campo filipino to petron ferguson' in key:
        include_group(
            'Campo Filipino',
            'The collection explicitly names Campo Filipino and Petron/Ferguson Road; these SWMD rows have the exact Campo Filipino barangay and valid coordinates.',
            'High',
        )
    if 'purok 6 asin' in key:
        include_group(
            'Asin Road',
            'The schedule names Purok 6 Asin and Smith Drive. Valid Asin Road points follow the same road-side area; BIR lists Asin Road National Highway and Joaquin Smith Road toward the dump-site route.',
            'Medium',
        )
    if 'rimando bridge to aurora hill' in key:
        for barangay in ('Aurora Hill Proper (Malvar-Sgt. Floresca)', 'Aurora Hill, North Central'):
            include_group(
                barangay,
                f'{barangay} coordinates are within the named Rimando Road/Aurora Hill corridor; BWD road references list Rimando, Malvar, Sgt. Floresca and Yap Street connections. The corridor boundary needs review.',
                'Medium',
            )
        include_group(
            'Lopez Jaena',
            'The source point is in Aurora Hill near Lopez Jaena/Rimando Road. The schedule identifies the Rimando Bridge-to-Aurora Hill route; BWD road references include Lopez Jaena, Malvar, Sgt. Floresca and Rimando connections.',
            'Medium',
        )
    if 'lamug st.' in key:
        for barangay in ('Middle Quezon Hill Subdivision (Quezon Hill Middle)', 'Quezon Hill, Upper'):
            include_group(
                barangay,
                f'The schedule explicitly says Lamug Street and Upper/Middle Quezon Hill; the source barangay qualifier matches {barangay!r}.',
                'High',
            )
    if 'east/west modernsite' in key:
        for barangay in ('Modern Site, East', 'Modern Site, West'):
            include_group(
                barangay,
                f'The schedule explicitly names East/West Modern Site and Guevarra/Upper Malvar streets; the source barangay qualifier matches {barangay!r}.',
                'High',
            )
    if 'mid./lower rock quarry' in key:
        for barangay in ('Rock Quarry, Middle', 'Rock Quarry, Lower'):
            include_group(
                barangay,
                f'The route explicitly names Mid./Lower Rock Quarry; the SWMD qualifier matches {barangay!r}.',
                'High',
            )
    if 'quirino hill, (upper/mid' in key:
        for barangay in ('Quirino Hill, East', 'Quirino Hill, Middle', 'Quirino Hill, West'):
            include_group(
                barangay,
                f'The route explicitly includes East/West and Upper/Mid Quirino Hill; the SWMD qualifier matches {barangay!r}.',
                'Medium',
            )
    if 'sto. tomas central' in key:
        include_group(
            'Santo Tomas School Area',
            'Santo Tomas School Area is geographically within the named Sto. Tomas locality and its coordinates fall in the southern route range. The schedule does not name the school-area subdivision, so confirm the boundary.',
            'Low',
        )
    if 'ric 1 military cut-off' in key:
        include_group(
            'DPS Compound',
            'DPS Compound coordinates are near the named BGH/Leonard Wood/Teacher’s Camp route; this corridor association is approximate and needs route confirmation.',
            'Low',
        )
    if key.startswith('ric 2'):
        include_group(
            'Magsaysay Private Road',
            'The route explicitly runs from Bokawkan to the Magsaysay city limit; this source point is on Magsaysay Private Road and lies in the corridor range.',
            'Medium',
        )
    if 'fort del pilar' in key and 'loakan proper-ongasan' in key:
        include_group(
            'Liwanag-Loakan',
            'The SWMD points are in Liwanag-Loakan, whose BIR road list places Liwanag Road/Loakan Road and feeder connections in the route area. The schedule names Loakan Proper/Ongasan/Feeder Road but does not name Liwanag itself, so the route assignment is low-confidence and needs local confirmation.',
            'Low',
        )
    if 'purok 1 north sanitary camp' in key:
        include_group(
            'Sanitary Camp, North',
            'The schedule says Purok 1 North Sanitary Camp; the matching SWMD row is explicitly in Sanitary Camp, North, Purok 1.',
            'High',
            predicate=lambda site: token_words(site['purok']) == token_words('Purok 1'),
        )
    if key in CAMP7_AREA_NAMES:
        selected = {source_id: site for source_id, site in selected.items() if site['barangay'] != 'Camp 7'}
        reasons = {source_id: why for source_id, why in reasons.items() if source_id in selected}
        confidence = {source_id: value for source_id, value in confidence.items() if source_id in selected}
        for site in get_sites('Camp 7'):
            if not site['coordinates_valid']:
                continue
            anchor_distances = [distance_m(site['latitude'], site['longitude'], lat, lon)
                                for lat, lon in CAMP7_ANCHORS[key]]
            nearest_distance = min(anchor_distances)
            # A 900 m envelope allows a neighborhood route to cover several blocks.
            if nearest_distance <= 900:
                source_id = site['source_row']
                selected[source_id] = site
                reasons[source_id] = (
                    f'Camp 7 source coordinate is {nearest_distance:.0f} m from a named subdivision/road anchor '
                    f'for {CAMP7_AREA_NAMES[key]!r}; the CSV has generic site names and no subdivision field, '
                    'so subdivision attribution remains approximate.'
                )
                confidence[source_id] = 'Low'

    # Tetep-an is a road-side neighborhood in Bakakeng Sur. These two Bakakeng
    # North points are the closest SWMD candidates, but lack site-level labels.
    if 'tetep-an village' in key:
        for site in get_sites('Bakakeng North'):
            if site['site_name'] in {'Site 5', 'Site 6'} and site['coordinates_valid']:
                source_id = site['source_row']
                selected[source_id] = site
                reasons[source_id] = (
                    'Bakakeng North coordinate is in the nearby lower Bakakeng/Ticuan corridor; Waze locates '
                    'Tetep-an Village on Bakakeng Sur Road and BIR lists Tetep-an/Ticuan Road, but the SWMD '
                    'row has no purok/subdivision name. Human boundary check required.'
                )
                confidence[source_id] = 'Medium'

    # The Overpass-to-Rimando wording names Kalkalan (Pinget); the ABCR points
    # cluster around the bridge and are included as corridor stops.
    if 'overpass slu left side to rimando bridge' in key:
        for site in get_sites('A. Bonifacio-Caguioa-Rimando (ABCR)'):
            if site['coordinates_valid']:
                source_id = site['source_row']
                selected[source_id] = site
                reasons[source_id] = (
                    'ABCR site coordinates cluster around Rimando Bridge; route wording runs from the SLU overpass '
                    'to the bridge. This is a corridor assignment, not a claim that the sites are on the bridge itself.'
                )
                confidence[source_id] = 'Medium'

    # RIC 2 is a linear Bokawkan–Bonifacio–Magsaysay corridor; only the named
    # barangay anchors are included. Unlisted intervening blocks remain marked.
    if key.startswith('ric 2'):
        for barangay in (
            'Andres Bonifacio (Lower Bokawkan)',
            'Magsaysay, Lower',
            'Magsaysay, Upper',
        ):
            for site in get_sites(barangay):
                if site['coordinates_valid']:
                    source_id = site['source_row']
                    selected[source_id] = site
                    reasons[source_id] = (
                        f'{barangay} is an endpoint/road-side SWMD group named by the RIC 2 Bokawkan-to-Magsaysay '
                        'corridor; coordinates place it along the stated central route. Corridor extent needs review.'
                    )
                    confidence[source_id] = 'Medium'

    # The north/south route explicitly covers both sanitary-camp barangays.
    if 'south/north sanitary camp' in key:
        for barangay in ('Sanitary Camp, North', 'Sanitary Camp, South'):
            for site in get_sites(barangay):
                if site['coordinates_valid']:
                    source_id = site['source_row']
                    selected[source_id] = site
                    reasons[source_id] = (
                        'The schedule says South/North Sanitary Camp and names Yap Street/Malvar/Quisumbing; '
                        'the SWMD point lies in one of the two named sanitary-camp groups.'
                    )
                    confidence[source_id] = 'Medium'

    selected_ids = sorted(selected)
    area_to_row_ids.setdefault(area_id, set()).update(selected_ids)
    for source_id in selected_ids:
        assignment_reasons.setdefault(source_id, {})[area_id] = reasons[source_id]
        assignment_confidence.setdefault(source_id, {})[area_id] = confidence[source_id]

    # A source point is not a confirmed site object if its coordinates are
    # missing/out of range. Preserve an area marker for unresolved route pieces.
    invalid_candidates = any(
        not site['coordinates_valid']
        for barangay, _, _ in mapped
        for site in get_sites(barangay)
    )
    force_corridor_marker = any(token in key for token in (
        'overpass slu left side to rimando bridge', 'ric 2',
    ))
    needs_marker = bool(
        unknown_parts or invalid_candidates
        or any(area_id in area_ids for area_ids in invalid_area_candidates.values())
        or any(area_id in area_ids for area_ids in irisan_unresolved_candidates.values())
        or not selected or force_corridor_marker
    )
    site_values = [site_object(selected[source_id]) for source_id in selected_ids]
    if needs_marker:
        site_values.append(fallback_marker(area_str))

    # Preserve the current driver/schedule/area/sites shape; area_name is the
    # exact cleaned-schedule collection string. The barangay field remains that
    # exact same schedule text to avoid substituting a renamed locality.
    area_objects = [{
        'barangay': area_str,
        'area_name': area_str,
        'sites': site_values,
    }]
    schedule_area_rows[area_id] = area_objects
    return area_objects


# Build the versioned schedule and unique area-to-site mapping.
drivers = []
for name, group in df.groupby('Driver', sort=True):
    schedule = []
    for _, row in group.iterrows():
        area_str = str(row['collection']).strip()
        day_name = str(row['day']).strip()
        resolved_areas = [] if area_str.upper() == 'OFF' else resolve_area_sites(area_str)
        area_list = [] if area_str.upper() == 'OFF' else format_schedule_areas(
            area_str, resolved_areas, name, day_name,
        )
        schedule.append({
            'day': day_name,
            'area': area_list,
            'time': str(row['time']).strip() if pd.notna(row['time']) else '',
        })
    drivers.append({'driver': name, 'schedule': schedule})

output_path = base / 'jsons' / 'schedules' / 'driver_schedule_v3.json'
output_path.write_text(json.dumps(drivers, indent=2, ensure_ascii=False), encoding='utf-8')

# Area research log: one exact schedule label per row, including map links and
# locality-specific road references used to review the route.
research_rows = [area_metadata[name] for name in sorted(area_metadata)]
research_path = base / 'csvs' / 'mapping' / 'schedule_area_research_v3.csv'
pd.DataFrame(research_rows).to_csv(research_path, index=False, encoding='utf-8-sig')

# One audit row per SWMD source row. Unmatched rows are explicit: invalid or
# missing coordinates on a corridor get a firingline disposition; other rows
# without a defensible schedule match remain blank.
audit_rows = []
for site in source_site_rows:
    source_id = site['source_row']
    matched_areas = sorted(assignment_reasons.get(source_id, {}))
    review_candidates = []
    review_note = ''
    if matched_areas:
        status = 'matched'
        # A row assigned to more than one route should carry the least certain
        # confidence among those assignments, not the strongest one.
        best_confidence = min(
            (assignment_confidence[source_id][area] for area in matched_areas),
            key=lambda value: {'Low': 0, 'Medium': 1, 'High': 2}[value],
        )
        rationale = ' | '.join(
            f'{area}: {assignment_reasons[source_id][area]}' for area in matched_areas
        )
        if len(matched_areas) > 1:
            review_note = (
                'This source row is assigned to multiple schedule-area labels. Its SWMD barangay/site coordinate '
                'supports the listed locality or corridor matches, but the source map has no route ownership field; '
                'confirm which schedule route(s) serve this stop.'
            )
        source_urls = [site['coordinate_source']] if site['coordinate_source'] else []
        source_urls.append(map_query(site['barangay']))
        for area in matched_areas:
            area_research = area_metadata.get(area) or research_for_area(area)
            source_urls.extend(area_research['research_source_urls'].split('; '))
    else:
        # Rows with a direct text match but unusable coordinates are represented
        # by the schedule area's null-coordinate fallback marker.
        fallback_areas = sorted(invalid_area_candidates.get(source_id, set()))
        corridor_candidates = [area for area in fallback_areas if is_corridor(area)]
        if corridor_candidates:
            status = 'firingline'
            matched_areas = corridor_candidates
            best_confidence = 'Low'
            rationale = (
                'The source row has missing or out-of-range coordinates, so it cannot be emitted as a confirmed '
                'site object. It is retained as a null-coordinate firingline marker for the named corridor candidate(s).'
            )
        elif fallback_areas:
            status = 'blank'
            matched_areas = fallback_areas
            best_confidence = 'Low'
            rationale = (
                'The schedule wording identifies this source locality, but its coordinates are missing or invalid. '
                'A null-coordinate blank marker is used instead of inventing a point.'
            )
        else:
            status = 'blank'
            best_confidence = 'Low'
            rationale = (
                'No schedule area had a defensible word-level or route-coordinate match for this source row; '
                'it is left blank for manual review rather than assigned by loose keyword overlap.'
            )
            matched_areas = []
        source_urls = [site['coordinate_source']] if site['coordinate_source'] else []
        source_urls.append(map_query(site['barangay']))
        source_urls.extend([CITYWIDE_BIR, CITY_TRAFFIC_MAP])

        if site['barangay'] == 'General Luna, Upper':
            review_candidates = [
                'CBD Session Road Diego Silang, Lower Mabini, Lower Gen. Luna, Gov. Pack, Assumption, Calderon, Lakandula, Centermall'
            ]
            review_note = (
                'Coordinates are in the central road area, but the only schedule wording names Lower Gen. Luna. '
                'The Upper/Lower qualifier is meaningful, so these rows remain blank pending route confirmation.'
            )
            rationale = review_note
        elif site['barangay'] == 'Holy Ghost Proper':
            review_candidates = ['Honeymoon-Holyghost, Holyghost Ext.']
            review_note = (
                'The schedule mentions Honeymoon-Holyghost and Holyghost Extension, while the source is Holy Ghost Proper. '
                'The qualifier differs and no site-level road match confirms service, so the rows remain blank.'
            )
            rationale = review_note
        elif site['barangay'] == 'Camp 7' and site['coordinates_valid']:
            review_candidates = list(CAMP7_AREA_NAMES.values())
            review_note = (
                'This generic Camp 7 coordinate is outside the 900 m subdivision-anchor ranges used for the three named '
                'Camp 7 schedules. Its subdivision cannot be established from the SWMD row.'
            )
            rationale = review_note
        elif site['barangay'] == 'Irisan' and site['coordinates_valid']:
            review_candidates = sorted(irisan_unresolved_candidates.get(source_id, set()))
            review_note = (
                'This Irisan point fell outside the researched coordinate envelope for the named Purok groups. '
                'The source CSV does not give a per-site Purok, so it remains blank until the route boundary is confirmed.'
            )
            rationale = review_note
        elif fallback_areas:
            review_candidates = fallback_areas
            review_note = 'A direct schedule-area text match exists, but missing or invalid coordinates prevent a confirmed site point.'

    for area in review_candidates:
        area_research = area_metadata.get(area) or research_for_area(area)
        source_urls.extend(area_research['research_source_urls'].split('; '))

    audit_rows.append({
        'source_csv_row': source_id,
        'site_name': site['site_name'],
        'swmd_barangay': site['barangay'],
        'purok': site['purok'],
        'latitude': site['latitude'],
        'longitude': site['longitude'],
        'coordinate_status': 'valid' if site['coordinates_valid'] else 'missing_or_invalid',
        'status': status,
        'matched_schedule_area': '; '.join(matched_areas),
        'review_candidate_area': '; '.join(review_candidates),
        'review_note': review_note,
        'rationale': rationale,
        'confidence': best_confidence,
        'assignment_confidences': '; '.join(
            f'{area}: {assignment_confidence[source_id][area]}' for area in matched_areas
        ) if status == 'matched' else '',
        'research_source': '; '.join(dict.fromkeys(url for url in source_urls if url)),
        'human_review_required': (
            'Yes' if best_confidence != 'High' or status != 'matched' or len(matched_areas) > 1 else 'No'
        ),
    })

audit_path = base / 'csvs' / 'mapping' / 'mapping_audit_swmd_v3.csv'
pd.DataFrame(audit_rows).to_csv(audit_path, index=False, encoding='utf-8-sig')

print(f'{len(drivers)} drivers -> {output_path}')
print(f'{len(research_rows)} unique schedule areas researched -> {research_path}')
print(f'{len(audit_rows)} SWMD rows audited -> {audit_path}')
print('Audit dispositions:')
print(pd.Series([row['status'] for row in audit_rows]).value_counts().to_string())
