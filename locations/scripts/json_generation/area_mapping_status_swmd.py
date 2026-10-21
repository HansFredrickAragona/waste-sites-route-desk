import re
from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parents[2] / 'data'

# Areas from cleaned dataset
df = pd.read_csv(base / 'csvs' / 'cleaned' / 'cleaned_drivers_dataset.csv')
areas = sorted(df['collection'].unique())

# Barangays from SWMD MAP CSV
swmd = pd.read_csv(base / 'csvs' / 'raw' / 'SWMD MAP - Baguio_SWMD_Google_MyMaps.csv')
barangay_list = sorted(swmd['Barangay'].dropna().unique())
barangay_names = {b.lower(): b for b in barangay_list}

# Full-area aliases (matched BEFORE splitting by comma)
FULL_ALIASES = {
    'overpass slu left side to rimando bridge, kalkalan (pinget)': ['Pinget'],
    'dreamland pinget, central pinget': ['Pinget', 'Pinget'],
    'camp 7 (woodsgate/ richgate/ monticello)': ['Camp 7'],
    'camp 7 (amistad, peters ville, lexber hts, parisas': ['Camp 7'],
    'camp 7, pias, youngland': ['Camp 7'],
    'loakan proper (pidawan-maridit rd., moog/nfa/bsp)': ['Loakan Proper'],
    'loakan proper (brgy hall/welcome arc)': ['Loakan Proper'],
    'purok 16,17,18 irisan': ['Irisan'],
    'purok 1 to 6 irisan': ['Irisan'],
    'purok 12 (irisan)': ['Irisan'],
    'purok 27, 28 upper san carlos hts.': [],
    'pinsao proper (monol/tam-awan up to hway boundary lt)': ['Pinsao Proper'],
    'pinsao pilot, pinsao proper-crusher/hway before aguinalde hrdwre': ['Pinsao Pilot Project', 'Pinsao Proper'],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca': [
        'Military Cut-off', 'BGH Compound', None, "Cabinet Hill-Teacher's Camp", 'Pacdal', None,
    ],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca, ma. basa, regidor st.': [
        'Military Cut-off', 'BGH Compound', None, "Cabinet Hill-Teacher's Camp", 'Pacdal', None, None, None,
    ],
    'ric 1 military cut-off, bgh hospital, leonard wood rd., teacher\'s camp, pacdal circle, ymca, salud mitra': [
        'Military Cut-off', 'BGH Compound', None, "Cabinet Hill-Teacher's Camp", 'Pacdal', None, 'Salud Mitra',
    ],
    'ric 2 (3am-12nn) bokawkan to magsaysay city limit, slu, lower bonifacio, claro m. recto st.': [
        None, None, None, None,
    ],
    'ric 2 bokawkan to magsaysay city limit, slu, lower bonifacio': [None, None, None],
    'ric 2 bokawkan to magsaysay city limit, slu, lower bonifacio, upper bonifacio': [None, None, None, None],
    'cbd session road diego silang, lower mabini, lower gen. luna, gov. pack, assumption, calderon, lakandula, centermall': [
        'Session Road Area', None, 'General Luna, Lower', None, None, None, None, None,
    ],
    'market 1 (magsaysay, abanao, kayang hilltop, baguio central school, lower mabini calderon, upper session rd., north drive, km.0, igorot park': [
        None, None, 'Kayang-Hilltop', None, None, None, None, None, 'Rizal Monument Area',
    ],
    'market 2 hangar, upper magsaysay, maharlika abanao, empire, veniz hotel': [
        None, 'Upper Magsaysay', None, None, None,
    ],
    'market 3 dian huat, otek st., kisad st.': [None, None, 'Legarda-Burnham-Kisad'],
    'market 3 dian huat, otek st., kisad st., montinola st.': [None, None, 'Legarda-Burnham-Kisad', None],
    'market 3 dian huat, otek st., kisad st., san antonio village': [None, None, 'Legarda-Burnham-Kisad', 'San Antonio Village'],
    'gibraltar main road except cuneta compound and good shepherd': ['Gibraltar'],
    'fort del pilar, pyramid, loakan proper-ongasan/feeder rd./caap': ['Fort del Pilar', None, 'Loakan Proper'],
    'phase 3 bakakeng norte, eagle crest-phase 1,2, bouganvilla st.': ['Bakakeng North', None, None, None],
    'a. tabora, trancoville, new lucban -interior': ['Alfonso Tabora', 'Trancoville', 'New Lucban'],
    'agpaoa rd., poliwes, youngland to lions head, city limit': [None, 'Poliwes', None, None],
    'bakakeng norte (purok 6,7), summer ville (bakakeng)': ['Bakakeng North', None],
    'san luis ,san roque village, shangrila village,recoletos': ['San Luis Village', 'San Roque Village', None, None],
    'south/north sanitary camp-yap st., lower malvar/quisumbing': ['Sanitary Camp, North', None],
    'outlook drive (highway and interior), magsaysay drive (tesda), happy hallow': [None, None, 'Happy Hollow'],
    'campo filipino to petron ferguson rd., upper market, camp allen, kayang extn. (labsan) (3am-12nn)': [
        None, 'Market Subdivision, Upper', 'Camp Allen', 'Kayang Extension',
    ],
    'quirino hill, (upper/mid, east/ west)': [],
    'quirino higway,pldt-naguilian rd.': [],
    'lamug st.-upper/middle quezon hill': [],
    'st peter\'s /teachers village/ marcos highway cor. suello-tuba highway boundary': [],
    'bakbakan (joaquin smith nhs) to city limit': [],
    'crystal cave waiting shed intersection up to turning point,': [],
    'apts. ambuklao rd., doclas cerio village, summerville (ambuklao rd.)': [],
    'balacbac, lexber subdivision': [],
    'celestial to belshang, suello junction, pacday junction': [],
    'ciudad grande-phase 1/2, tetep-an village': [],
    'east/west modernsite,guevarra st., upper malvar st.': [],
    'food waste collection, iec/qrt (2pm-11pm)': [],
    'iec/qrt, food waste collection (8am-5pm)': [],
    'iec/qrt (8am-5pm)': [],
    'kitma, chapis, justice/pucay village, moldex box, hollywood': [],
    'purok 15-agro, add rd., purok 6/7 (boundary)-harvester': [],
    'purok 6 asin, munoz drive, smith drive (3am-12nn)': [],
    'san carlos, idogan village, sariling sikap': [],
    'spring hills, kadaclan, cudirao rd. (in front of baptist school)': [],
    'st. patrick rd., upper/lower cypress, up village, balenben': [],
    'east/west bayan park, leonila hill': ['Bayan Park West (Bayan Park, Leonila Hill)'],
    'east/west modernsite': [],
    'east/west modernsite, guevarra st., upper malvar st.': [],
    'east/west bayan park': ['Bayan Park East', 'Bayan Park West (Bayan Park, Leonila Hill)'],
    'san vicente, sarok, woodsville (3am-12nn)': ['San Vicente', None, None],
    'st. joseph brgy. (navy base), siapno rd.,amsing, liteng (3am-12nn)': ['Saint Joseph Village', None, None, None],
    'victoria village, quezon hill, (road 1 to 3), mercury/ silver/ copper/ ponce st.': [
        'Victoria Village', 'Quezon Hill Proper', None, None,
    ],
    'upper/lower qm, gefa-aguinaldo': ['Quirino-Magsaysay, Upper (Upper QM)'],
    'upper rock quarry, palma-urbano, dr. cari\u00f1o st.': ['Rock Quarry, Upper', None, None],
    'legarda, naguilian road, paraan, avelino fairview,': ['Legarda-Burnham-Kisad', None, None, None],
    'legarda, naguilian road, t. alonzo, cuneta and good sheperd': ['Legarda-Burnham-Kisad', None, 'Teodora Alonzo', None],
    'legarda, naguilian, lourdes extension': ['Legarda-Burnham-Kisad', None, 'Lourdes Subdivision Extension'],
    'legarda, naguillan, philsci, purok 12 (irisan) (3am-12nn)': ['Legarda-Burnham-Kisad', None, None, 'Irisan'],
    'naguilian, legarda': [None, 'Legarda-Burnham-Kisad'],
    'burnham (3am-12nn), naguilian, legarda': ['Legarda-Burnham-Kisad', None, 'Legarda-Burnham-Kisad'],
    'burnham, naguillan, legarda , suello village, sta. lucia (3am-12nn)': [
        'Legarda-Burnham-Kisad', None, 'Legarda-Burnham-Kisad', None, None,
    ],
    'burnham, rimando bridge to aurora hill (rimando road) (3am-12nn)': ['Legarda-Burnham-Kisad', None],
    'burnham-legarda, ferdinand brgy. happy homes': ['Legarda-Burnham-Kisad', 'Ferdinand (Happy Homes-Campo Sioco)'],
    'burnham (3am-12nn)': ['Legarda-Burnham-Kisad'],
    'burnham': ['Legarda-Burnham-Kisad'],
    'guisad surong, cresencia, andres bonifacio': ['Guisad Sorong', 'Cresencia Village', 'Andres Bonifacio (Lower Bokawkan)'],
    'guisad central, easter, pucay st.,richwood square, manzanillo subdivision': ['Guisad Central', None, None, None, None],
    'imelda marcos, phil-am, sto. rosario': ['Imelda R. Marcos (La Salle)', 'Phil-Am', 'Santo Rosario'],
    'imelda village, m. roxas, sumulong': ['Imelda Village', 'Manuel A. Roxas', None],
    'lourdes proper, lower lourdes, sn roque extn.mrr-queen of peace': [
        'Lourdes Subdivision, Proper', 'Lourdes Subdivision, Lower', 'MRR-Queen of Peace',
    ],
    'lower/upper brookside, east modernsite': ['Brookside', 'Modern Site, East'],
    'mines view, gibraltar interior, pucsusan': ['Mines View Park', 'Gibraltar', 'Pucsusan'],
    'p. burgos, p. zamora': ['Padre Burgos', None],
    'balsigan, lower pinget': ['Balsigan', 'Pinget'],
    'atok trail, loakan-apugan': ['Atok Trail', 'Apugan-Loakan'],
    'engineers hill, marcoville': ["Engineers' Hill", 'Bal-Marcoville (Marcoville)'],
    'gabriela silang, lower dagsian, hillside': ['Gabriela Silang', 'Dagsian, Lower', 'Hillside'],
    'honeymoon-holyghost, holyghost ext.': ['Honeymoon (Honeymoon-Holy Ghost)', 'Holy Ghost Extension'],
    'city camp proper, city camp central': ['City Camp Proper', 'City Camp Central'],
    'country club, lucnab': ['Country Club Village', 'Lucnab'],
    'dominican/mirador hill (st. theresa st.)': ['Dominican Hill-Mirador'],
    'fairview,sunny side - tacay rd.': ['Fairview Village', None],
    'south central aurora hill,west bayan park village': ['Aurora Hill, South Central', 'Bayan Park Village'],
    'sta. escolastica,upper dagsian, scout barrio': ['Santa Escolastica', 'Dagsian, Upper', 'Scout Barrio'],
    'sto. tomas central, dontogan': ['Santo Tomas Proper', 'Dontogan'],
    'cabinet hill, south drive, green water': ["Cabinet Hill-Teacher's Camp", 'South Drive', 'Greenwater Village'],
    'sto. ni\u00f1o-slaughter, lower p. burgos, andres bonifacio,incld. bpi compd.': [
        'Slaughter House Area (Santo Ni\u00f1o Slaughter)', 'Padre Burgos', 'Andres Bonifacio (Lower Bokawkan)', None,
    ],
    'dizon subdv., camdas, lower quirino hill, happy homes-old lucban, pines hospital': [
        'Dizon Subdivision', 'Camdas Subdivision', 'Quirino Hill, Lower', 'Happy Homes (Happy Homes-Lucban)', None,
    ],
    'crystal dale subdivision, sto. ni\u00f1o, bengao, greenvalley': [None, None, None, 'Greenwater Village'],
    'camp 8, sta escolastica, milton-highway, genesis': ['Camp 8', 'Santa Escolastica', None, None],
    'mid./lower rock quarry': ['Rock Quarry, Middle'],
    'brookspoint, purok 1 north sanitary camp': ['Brookspoint', None],
    'slu-svp, bakakeng old site, richview square, purok 8-bakakeng norte': [
        'SLU-SVP Housing Village', 'Bakakeng Central', None, 'Bakakeng North',
    ],
    'lualhati, minesview/j. felipe st.': ['Lualhati', None],
}

# Per-part aliases (exact match after cleaning)
PART_ALIASES = {
    'ambiong': 'Ambiong', 'kias': 'Kias', 'new lucban': 'New Lucban', 'poliwes': 'Poliwes',
    'balsigan': 'Balsigan', 'pucsusan': 'Pucsusan', 'lucnab': 'Lucnab', 'dontogan': 'Dontogan',
    'south drive': 'South Drive', 'hillside': 'Hillside', 'camp 7': 'Camp 7', 'camp 8': 'Camp 8',
    'phil-am': 'Phil-Am', 'brookspoint': 'Brookspoint', 'san vicente': 'San Vicente',
    'lualhati': 'Lualhati', 'green water': 'Greenwater Village', 'greenvalley': 'Greenwater Village',
    'guisad surong': 'Guisad Sorong', 'guisad central': 'Guisad Central',
    'cresencia': 'Cresencia Village', 'cresencia village': 'Cresencia Village',
    'atok trail': 'Atok Trail', 'loakan-apugan': 'Apugan-Loakan', 'loakan proper': 'Loakan Proper',
    'fort del pilar': 'Fort del Pilar', 'dizon subdv.': 'Dizon Subdivision', 'camdas': 'Camdas Subdivision',
    'imelda village': 'Imelda Village', 'imelda marcos': 'Imelda R. Marcos (La Salle)',
    'm. roxas': 'Manuel A. Roxas', 'sto. rosario': 'Santo Rosario',
    'andres bonifacio': 'Andres Bonifacio (Lower Bokawkan)',
    'lower p. burgos': 'Padre Burgos', 'p. burgos': 'Padre Burgos', 'padre burgos': 'Padre Burgos',
    'sto. ni\u00f1o-slaughter': 'Slaughter House Area (Santo Ni\u00f1o Slaughter)',
    'sto. nino-slaughter': 'Slaughter House Area (Santo Ni\u00f1o Slaughter)',
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
    'santo tomas proper': 'Santo Tomas Proper', 'pinsao pilot': 'Pinsao Pilot Project',
    'pinsao proper': 'Pinsao Proper', 'city camp proper': 'City Camp Proper',
    'city camp central': 'City Camp Central', 'bakakeng norte': 'Bakakeng North',
    'bakakeng old site': 'Bakakeng Central', 'dominican/mirador hill (st. theresa st.)': 'Dominican Hill-Mirador',
    'a. tabora': 'Alfonso Tabora', 'trancoville': 'Trancoville', 'victoria village': 'Victoria Village',
    'quezon hill': 'Quezon Hill Proper', 'upper qm': 'Quirino-Magsaysay, Upper (Upper QM)',
    'lower qm': 'General Emilio F. Aguinaldo (Quirino\u2011Magsaysay, Lower)',
    'gefa-aguinaldo': 'General Emilio F. Aguinaldo (Quirino\u2011Magsaysay, Lower)',
    'upper rock quarry': 'Rock Quarry, Upper', 'lower rock quarry': 'Rock Quarry, Lower',
    'middle rock quarry': 'Rock Quarry, Middle', 'mid./lower rock quarry': 'Rock Quarry, Middle',
    'palma-urbano, dr. cari\u00f1o st.': 'Palma-Urbano (Cari\u00f1o-Palma)',
    'palma-urbano': 'Palma-Urbano (Cari\u00f1o-Palma)',
    'san roque village': 'San Roque Village', 'san luis': 'San Luis Village', 'san luis village': 'San Luis Village',
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

SKIP = {
    'incld. bpi compd.', 'bpi compd.', 'p. zamora', 'youngland', 'lions head', 'city limit',
    'agpaoa rd.', 'summer ville (bakakeng)', 'naguilian', 'naguillan', 'naguilian road',
    'paraan', 'avelino fairview', 'cuneta', 'cuneta and good sheperd', 'good sheperd', 'good shepherd',
    'suello village', 'sta. lucia (3am-12nn)', 'sta. lucia',
    'rimando bridge to aurora hill (rimando road) (3am-12nn)', 'rimando bridge to aurora hill (rimando road)',
    'lower mabini', 'gov. pack', 'assumption', 'calderon', 'lakandula', 'centermall',
    'peters ville', 'lexber hts', 'parisas', 'milton-highway', 'genesis', 'pines hospital',
    'pyramid', 'easter', 'pucay st.', 'richwood square', 'manzanillo subdivision', 'sumulong',
    'st. patrick rd.', 'upper/lower cypress', 'up village', 'balenben', 'minesview/j. felipe st.',
    'magsaysay drive (tesda)', 'o tek st.', 'otek st.', 'montinola st.', 'maharlika abanao',
    'empire', 'veniz hotel', 'market 1', 'market 1 (magsaysay', 'market 2 hangar', 'market 3 dian huat',
    'abanao', 'baguio central school', 'lower mabini calderon', 'upper session rd.', 'north drive',
    'km.0', 'diego silang', 'leonard wood rd.', 'ymca', 'ma. basa', 'regidor st.',
    'slu', 'lower bonifacio', 'upper bonifacio', 'claro m. recto st.', 'richview square',
    'shangrila village', 'recoletos', 'sarok', 'woodsville (3am-12nn)', 'woodsville',
    'siapno rd.', 'amsing', 'liteng (3am-12nn)', 'liteng', 'philsci', 'lower malvar/quisumbing',
    'spring hills', 'kadaclan', 'cudirao rd. (in front of baptist school)',
    'balacbac', 'lexber subdivision', 'san carlos', 'idogan village', 'sariling sikap',
    'quirino higway', 'pldt-naguilian rd.', 'kitma', 'chapis', 'justice/pucay village',
    'moldex box', 'hollywood', 'apts. ambuklao rd.', 'doclas cerio village', 'summerville (ambuklao rd.)',
    'crystal dale subdivision', 'sto. ni\u00f1o', 'bengao', 'eagle crest-phase 1', 'eagle crest',
    'bouganvilla st.', 'purok 15-agro', 'add rd.', 'purok 6/7 (boundary)-harvester',
    'purok 27', '28 upper san carlos hts.', 'purok 6 asin', 'munoz drive',
    'smith drive (3am-12nn)', 'smith drive', 'mercury/ silver/ copper/ ponce st.',
    'celestial to belshang', 'suello junction', 'pacday junction', 'ciudad grande-phase 1/2',
    'tetep-an village', 'crystal cave waiting shed intersection up to turning point',
    'guevarra st.', 'upper malvar st.', 'iec/qrt', 'iec/qrt (8am-5pm)', 'iec/qrt (2pm-11pm)',
    'food waste collection', 'food waste collection (8am-5pm)', 'food waste collection, iec/qrt (2pm-11pm)',
    'quirino hill', '(upper/mid', 'east/ west)', 'bakbakan (joaquin smith nhs) to city limit',
    "st peter's /teachers village/ marcos highway cor. suello-tuba highway boundary",
    'lamug st.-upper/middle quezon hill', 'quirino hill, (upper/mid, east/ west)',
    'east/west modernsite', 'east/west modernsite, guevarra st., upper malvar st.',
    'phase 3 bakakeng norte', 'purok 16', 'purok 1 north sanitary camp',
    'dreamland pinget', 'central pinget', 'overpass slu left side to rimando bridge', 'kalkalan (pinget)',
    'sunny side - tacay rd.', 'purok 12 (irisan)', 'purok 16,17,18 irisan',
    'camp 7 (amistad', 'ric 1 military cut-off', 'ric 2 (3am-12nn) bokawkan to magsaysay city limit',
    'ric 2 bokawkan to magsaysay city limit', 'bokawkan to magsaysay city limit',
    'upper/lower qm', 'purok 1 to 6 irisan', 'loakan proper-ongasan/feeder rd./caap',
    'purok 8-bakakeng norte', 'san luis ,san roque village', 'south/north sanitary camp-yap st.',
    'south/north sanitary camp', 'yap st.', 'camp 7 (woodsgate/ richgate/ monticello)',
    'woodsgate/ richgate/ monticello', 'monol/tam-awan up to hway boundary lt',
    'crusher/hway before aguinalde hrdwre', 'east/west bayan park',
}


def clean(s):
    s = re.sub(r'\s+', ' ', s.strip().lower())
    s = re.sub(r'\s*\(\d{1,2}(?:am|pm|nn)\s*-\s*\d{1,2}(?:am|pm|nn)\)\s*', '', s)
    return s.strip().rstrip(',').strip()


def match_part(phrase):
    key = clean(phrase)
    if not key or key in SKIP:
        return None
    if key in PART_ALIASES:
        return PART_ALIASES[key]
    if key in barangay_names:
        return barangay_names[key]
    return None


results = []
for area in areas:
    if area.upper() == 'OFF':
        results.append({'area': area, 'status': 'OFF', 'mapped': '', 'unmapped': ''})
        continue

    key = clean(area)
    if key in FULL_ALIASES:
        mapped_list = FULL_ALIASES[key]
        mapped = [m for m in mapped_list if m]
        parts = [p.strip() for p in area.split(',') if p.strip()]
        unmapped_parts = []
        mi = 0
        for p in parts:
            pk = clean(p)
            if pk in SKIP:
                unmapped_parts.append(p)
            elif mi < len(mapped_list) and mapped_list[mi] is None:
                unmapped_parts.append(p)
                mi += 1
            elif mi < len(mapped_list):
                mi += 1
            else:
                unmapped_parts.append(p)
        if not unmapped_parts:
            status = 'FULLY MAPPED'
        elif mapped:
            status = 'PARTIALLY MAPPED'
        else:
            status = 'UNMAPPED'
        results.append({
            'area': area, 'status': status,
            'mapped': '; '.join(mapped), 'unmapped': '; '.join(unmapped_parts),
        })
        continue

    parts = [p.strip() for p in area.split(',') if p.strip()]
    mapped = []
    unmapped_parts = []
    for p in parts:
        m = match_part(p)
        if m:
            mapped.append(m)
        else:
            unmapped_parts.append(p)

    if not unmapped_parts:
        status = 'FULLY MAPPED'
    elif mapped:
        status = 'PARTIALLY MAPPED'
    else:
        status = 'UNMAPPED'

    results.append({
        'area': area, 'status': status,
        'mapped': '; '.join(mapped), 'unmapped': '; '.join(unmapped_parts),
    })

out = pd.DataFrame(results)
out_path = base / 'csvs' / 'mapping' / 'area_mapping_status_swmd.csv'
out.to_csv(out_path, index=False)

counts = out['status'].value_counts()
print("Summary (using SWMD MAP CSV):")
for s, c in counts.items():
    print(f"  {s}: {c}")
print(f"\nBarangays in SWMD MAP CSV: {len(barangay_list)}")
print(f"Saved to: {out_path}")
