// Curated North American game species: range by state, trail-cam tips, and seasonal peaks.
// Ranges are broad "occurs in the state" lists, not habitat maps; timing is typical, not legal guidance.
// `inat` lists iNaturalist taxon names used to confirm nearby sightings (a single word = whole genus).

export type Region = 'NE' | 'SE' | 'MW' | 'PL' | 'MTN' | 'SW' | 'PAC' | 'AK' | 'HI';

export const STATE_REGION: Record<string, Region> = {
  ME: 'NE', NH: 'NE', VT: 'NE', MA: 'NE', RI: 'NE', CT: 'NE', NY: 'NE', NJ: 'NE', PA: 'NE', DE: 'NE', MD: 'NE', DC: 'NE',
  VA: 'SE', WV: 'SE', NC: 'SE', SC: 'SE', GA: 'SE', FL: 'SE', AL: 'SE', MS: 'SE', TN: 'SE', KY: 'SE', AR: 'SE', LA: 'SE',
  OH: 'MW', MI: 'MW', IN: 'MW', IL: 'MW', WI: 'MW', MN: 'MW', IA: 'MW', MO: 'MW',
  ND: 'PL', SD: 'PL', NE: 'PL', KS: 'PL', OK: 'PL', TX: 'PL',
  MT: 'MTN', WY: 'MTN', CO: 'MTN', ID: 'MTN', UT: 'MTN', NV: 'MTN',
  AZ: 'SW', NM: 'SW',
  WA: 'PAC', OR: 'PAC', CA: 'PAC',
  AK: 'AK', HI: 'HI',
};

const ALL = Object.keys(STATE_REGION);
const except = (...s: string[]) => ALL.filter((k) => !s.includes(k));

export type CamTips = {
  where: string;
  height: string;
  angle: string;
  trigger: string;
  mode: string;
};

export type PeakEvent = {
  label: string;
  /** 1–12 */
  months: number[];
  /** Limit to these regions; omitted = everywhere the species occurs. */
  regions?: Region[];
};

export type GameSpecies = {
  id: string;
  name: string;
  group: 'big game' | 'predator' | 'birds' | 'small game';
  states: string[];
  inat: string[];
  /** Relative activity / visibility on camera, Jan → Dec, 0–3. */
  activity: number[];
  /** Regional overrides of `activity`. */
  activityByRegion?: Partial<Record<Region, number[]>>;
  events: PeakEvent[];
  tips: CamTips;
};

export const GAME: GameSpecies[] = [
  {
    id: 'whitetail',
    name: 'Whitetail deer',
    group: 'big game',
    states: except('AK', 'HI', 'CA', 'NV', 'UT'),
    inat: ['Odocoileus virginianus'],
    activity: [2, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 2],
    activityByRegion: { SE: [3, 2, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3] },
    events: [
      { label: 'Bachelor groups, velvet', months: [7, 8] },
      { label: 'Scrapes and rubs open', months: [10] },
      { label: 'Rut', months: [10, 11], regions: ['NE', 'MW', 'PL', 'MTN', 'PAC', 'SW'] },
      { label: 'Rut (late in the Deep South)', months: [11, 12, 1], regions: ['SE'] },
      { label: 'Fawning', months: [5, 6] },
    ],
    tips: {
      where: 'Field edges at an inside corner, pinch points between bedding and food, and active scrapes with a licking branch.',
      height: '3–4 ft, or 7–9 ft angled down to keep it out of reach and sight.',
      angle: '10–15 ft off the trail at about 45°, facing north or south so sunrise and sunset don’t wash out the frame.',
      trigger: 'High sensitivity, 3-shot burst, 30 s delay on trails; 5–10 s delay over scrapes.',
      mode: 'Photo bursts most of the year; 10–20 s video on scrapes in the rut to read buck behaviour.',
    },
  },
  {
    id: 'mule-deer',
    name: 'Mule deer',
    group: 'big game',
    states: ['WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'UT', 'CO', 'AZ', 'NM', 'ND', 'SD', 'NE', 'KS', 'OK', 'TX'],
    inat: ['Odocoileus hemionus'],
    activity: [1, 1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 2],
    events: [
      { label: 'Spring migration up to summer range', months: [4, 5] },
      { label: 'Fall migration to winter range', months: [10, 11] },
      { label: 'Rut', months: [11, 12] },
    ],
    tips: {
      where: 'Migration bottlenecks, saddles between drainages, and water in dry country (stock tanks, seeps).',
      height: '4–5 ft on a juniper or fence post; open country needs the camera tucked against cover.',
      angle: 'Quartering to the trail, sun behind the camera at the hours deer move.',
      trigger: 'Medium–high sensitivity, 3-shot burst, 1 min delay at water.',
      mode: 'Time-lapse over a basin to pattern movement, plus PIR on the trail itself.',
    },
  },
  {
    id: 'elk',
    name: 'Elk',
    group: 'big game',
    states: ['MT', 'WY', 'ID', 'CO', 'UT', 'NM', 'AZ', 'OR', 'WA', 'NV', 'CA', 'SD', 'ND', 'NE', 'KY', 'TN', 'NC', 'PA', 'MI', 'WI', 'AR', 'VA', 'WV', 'MO', 'MN', 'OK'],
    inat: ['Cervus canadensis'],
    activity: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 2, 1],
    events: [
      { label: 'Bugle and rut', months: [9, 10] },
      { label: 'Calving', months: [5, 6] },
      { label: 'Wallows busy', months: [7, 8, 9] },
    ],
    tips: {
      where: 'Wallows, dark-timber benches near water, and trails linking north-facing bedding to meadows.',
      height: '5–6 ft; elk are tall and a low camera crops the rack.',
      angle: 'Square-on to a wallow from 15–20 ft; quartering on trails.',
      trigger: 'High sensitivity, 3-shot burst, 30 s delay; elk often move in groups.',
      mode: 'Video in September to catch bugles; photos the rest of the year.',
    },
  },
  {
    id: 'pronghorn',
    name: 'Pronghorn',
    group: 'big game',
    states: ['MT', 'WY', 'CO', 'NM', 'AZ', 'UT', 'NV', 'ID', 'OR', 'CA', 'ND', 'SD', 'NE', 'KS', 'OK', 'TX'],
    inat: ['Antilocapra americana'],
    activity: [1, 1, 1, 2, 2, 2, 2, 3, 3, 2, 1, 1],
    events: [
      { label: 'Rut', months: [9] },
      { label: 'Fawning', months: [5, 6] },
    ],
    tips: {
      where: 'Water tanks and fence crossings, where pronghorn crawl under the bottom wire.',
      height: '3–4 ft on a T-post or tripod; there’s rarely a tree.',
      angle: 'Perpendicular to the crossing, 20 ft back, facing north.',
      trigger: 'Medium sensitivity (heat shimmer causes false triggers), 1 min delay at water.',
      mode: 'Photo bursts; midday heat makes time-lapse more reliable than PIR.',
    },
  },
  {
    id: 'black-bear',
    name: 'Black bear',
    group: 'big game',
    states: ['AK', 'WA', 'OR', 'CA', 'ID', 'MT', 'WY', 'CO', 'UT', 'NV', 'AZ', 'NM', 'TX', 'OK', 'AR', 'LA', 'MS', 'AL', 'GA', 'FL', 'SC', 'NC', 'TN', 'KY', 'VA', 'WV', 'MD', 'PA', 'NY', 'NJ', 'CT', 'MA', 'VT', 'NH', 'ME', 'MI', 'WI', 'MN', 'MO', 'OH'],
    inat: ['Ursus americanus'],
    activity: [0, 0, 1, 2, 3, 2, 2, 3, 3, 2, 1, 0],
    events: [
      { label: 'Spring emergence', months: [4, 5] },
      { label: 'Mating', months: [6, 7] },
      { label: 'Fall feeding (hyperphagia)', months: [8, 9, 10] },
      { label: 'Denning', months: [12, 1, 2] },
    ],
    tips: {
      where: 'Berry patches and oak flats with mast, creek crossings, and old logging roads.',
      height: '6–8 ft angled down, in a steel security box and cable-locked: bears chew cameras.',
      angle: 'Quartering away from the trail so the camera isn’t the first thing a bear smells.',
      trigger: 'Medium sensitivity, 3-shot burst, 1 min delay.',
      mode: 'Video; bear behaviour reads better in motion.',
    },
  },
  {
    id: 'moose',
    name: 'Moose',
    group: 'big game',
    states: ['AK', 'ME', 'NH', 'VT', 'NY', 'MA', 'CT', 'MN', 'MI', 'WI', 'ND', 'MT', 'ID', 'WY', 'WA', 'UT', 'CO'],
    inat: ['Alces alces'],
    activity: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 2, 1],
    events: [
      { label: 'Rut', months: [9, 10] },
      { label: 'Calving', months: [5, 6] },
      { label: 'Wetlands and ponds in summer', months: [6, 7, 8] },
    ],
    tips: {
      where: 'Willow bottoms, beaver ponds, and the edges of old burns or clear-cuts.',
      height: '6–7 ft; a bull’s shoulders are higher than most people expect.',
      angle: 'Wide and back 20–30 ft so a whole animal fits the frame.',
      trigger: 'Medium sensitivity, 3-shot burst, 1 min delay.',
      mode: 'Video in the rut; photos otherwise.',
    },
  },
  {
    id: 'turkey',
    name: 'Wild turkey',
    group: 'birds',
    states: except('AK'),
    inat: ['Meleagris gallopavo'],
    activity: [1, 1, 2, 3, 3, 2, 1, 1, 1, 2, 2, 1],
    activityByRegion: { SE: [1, 2, 3, 3, 2, 1, 1, 1, 1, 2, 2, 1] },
    events: [
      { label: 'Strut and gobble', months: [3, 4, 5], regions: ['NE', 'MW', 'PL', 'MTN', 'PAC', 'SW', 'HI'] },
      { label: 'Strut and gobble (early south)', months: [2, 3, 4], regions: ['SE'] },
      { label: 'Poults with hens', months: [6, 7] },
      { label: 'Winter flocks', months: [12, 1, 2] },
    ],
    tips: {
      where: 'Strut zones in open fields and ridge-top openings; roost trees near water.',
      height: '2–3 ft: a low angle shows beards and spurs.',
      angle: 'Facing along a field edge, not across it, so birds walk through the frame.',
      trigger: 'Daylight-only schedule, 5 s delay, 3-shot burst.',
      mode: 'Time-lapse every 30–60 s over an open field catches birds out of PIR range.',
    },
  },
  {
    id: 'feral-hog',
    name: 'Feral hog',
    group: 'big game',
    states: ['TX', 'OK', 'LA', 'AR', 'MS', 'AL', 'GA', 'FL', 'SC', 'NC', 'TN', 'CA', 'HI', 'NM', 'MO', 'VA'],
    inat: ['Sus scrofa'],
    activity: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 2],
    events: [
      { label: 'Night-shifted in summer heat', months: [6, 7, 8] },
      { label: 'Acorn drop', months: [10, 11] },
    ],
    tips: {
      where: 'Wallows, creek bottoms, and rooted ground at field edges.',
      height: '2–3 ft; hogs are low and a high camera shoots over them.',
      angle: 'Covering a wide approach to bait or a wallow from 15–20 ft.',
      trigger: 'High sensitivity, short 5–10 s delay: sounders arrive in waves.',
      mode: 'Night video to count the whole sounder before trapping.',
    },
  },
  {
    id: 'coyote',
    name: 'Coyote',
    group: 'predator',
    states: except('HI'),
    inat: ['Canis latrans'],
    activity: [3, 3, 2, 2, 2, 1, 1, 1, 2, 2, 2, 3],
    events: [
      { label: 'Breeding season', months: [1, 2] },
      { label: 'Pups at the den', months: [4, 5, 6] },
      { label: 'Young disperse', months: [10, 11] },
    ],
    tips: {
      where: 'Fence lines, field corners, and two-tracks: coyotes travel the easy routes.',
      height: '2–3 ft.',
      angle: 'Downwind of a likely approach, quartering.',
      trigger: 'High sensitivity, 3-shot burst, short delay.',
      mode: 'Night photos; many visits happen between 10 pm and 4 am.',
    },
  },
  {
    id: 'waterfowl',
    name: 'Ducks and geese',
    group: 'birds',
    states: ALL,
    inat: ['Anas', 'Mareca', 'Spatula', 'Aythya', 'Aix sponsa', 'Bucephala', 'Branta canadensis', 'Anser', 'Lophodytes cucullatus'],
    activity: [2, 2, 3, 2, 1, 1, 1, 1, 2, 3, 3, 2],
    events: [
      { label: 'Fall migration', months: [10, 11, 12] },
      { label: 'Spring migration', months: [3, 4] },
      { label: 'Early teal and goose seasons', months: [9] },
    ],
    tips: {
      where: 'Loafing banks, flooded timber edges, and field ponds birds return to.',
      height: '2–3 ft on a stake at the water’s edge.',
      angle: 'Along the shoreline, sun behind; water glare washes out frames.',
      trigger: 'Time-lapse every 1–5 min; PIR can’t see birds on cold water.',
      mode: 'Time-lapse from first light to mid-morning shows when the flights come in.',
    },
  },
  {
    id: 'upland',
    name: 'Grouse, pheasant and quail',
    group: 'birds',
    states: except('HI'),
    inat: ['Bonasa umbellus', 'Phasianus colchicus', 'Colinus virginianus', 'Callipepla', 'Dendragapus', 'Tympanuchus', 'Centrocercus', 'Alectoris chukar', 'Perdix perdix', 'Lagopus', 'Canachites canadensis', 'Oreortyx pictus'],
    activity: [1, 1, 2, 3, 3, 2, 2, 2, 2, 3, 2, 1],
    events: [
      { label: 'Drumming, booming, crowing', months: [4, 5] },
      { label: 'Broods', months: [6, 7, 8] },
      { label: 'Fall coveys', months: [10, 11] },
    ],
    tips: {
      where: 'Dusting spots, field-edge brush, young forest, and gravel on two-tracks.',
      height: '1–2 ft: ground birds are small.',
      angle: 'Close, 8–10 ft, along a known travel line.',
      trigger: 'High sensitivity, 3-shot burst, daylight schedule.',
      mode: 'Photos, or short video for drumming logs in spring.',
    },
  },
  {
    id: 'small-game',
    name: 'Rabbits and squirrels',
    group: 'small game',
    states: except('HI'),
    inat: ['Sylvilagus', 'Lepus americanus', 'Sciurus'],
    activity: [2, 2, 2, 2, 2, 2, 1, 2, 3, 3, 2, 2],
    events: [
      { label: 'Squirrels cutting mast', months: [9, 10] },
      { label: 'Rabbits in brush-pile cover', months: [12, 1, 2] },
    ],
    tips: {
      where: 'Hickory and oak edges for squirrels; brush piles and briars for rabbits.',
      height: '1–2 ft for rabbits; 3 ft aimed at a nut tree base for squirrels.',
      angle: 'Close and slightly down, 6–10 ft.',
      trigger: 'High sensitivity, 1-shot, 10 s delay.',
      mode: 'Photos; daylight schedule.',
    },
  },
];

export const activityFor = (s: GameSpecies, r: Region) => s.activityByRegion?.[r] ?? s.activity;
export const eventsFor = (s: GameSpecies, r: Region) => s.events.filter((e) => !e.regions || e.regions.includes(r));

/** Sum iNaturalist counts whose taxon matches one of the species' names (genus or binomial). */
export function inatMatches(s: GameSpecies, counts: { name: string; count: number }[]) {
  let n = 0;
  for (const c of counts) {
    if (s.inat.some((t) => (t.includes(' ') ? c.name === t || c.name.startsWith(`${t} `) : c.name.split(' ')[0] === t))) n += c.count;
  }
  return n;
}

// State wildlife agencies (hunting regulations). DC has no hunting season; it links to its wildlife office.
export const STATE_AGENCIES: Record<string, { name: string; url: string }> = {
  AL: { name: 'Alabama Wildlife and Freshwater Fisheries', url: 'https://www.outdooralabama.com' },
  AK: { name: 'Alaska Department of Fish and Game', url: 'https://www.adfg.alaska.gov' },
  AZ: { name: 'Arizona Game and Fish Department', url: 'https://www.azgfd.com' },
  AR: { name: 'Arkansas Game and Fish Commission', url: 'https://www.agfc.com' },
  CA: { name: 'California Department of Fish and Wildlife', url: 'https://wildlife.ca.gov' },
  CO: { name: 'Colorado Parks and Wildlife', url: 'https://cpw.state.co.us' },
  CT: { name: 'Connecticut DEEP Wildlife Division', url: 'https://portal.ct.gov/deep/hunting/hunting' },
  DE: { name: 'Delaware Division of Fish and Wildlife', url: 'https://dnrec.delaware.gov/fish-wildlife/' },
  DC: { name: 'DC Department of Energy and Environment', url: 'https://doee.dc.gov' },
  FL: { name: 'Florida Fish and Wildlife Conservation Commission', url: 'https://myfwc.com' },
  GA: { name: 'Georgia Wildlife Resources Division', url: 'https://georgiawildlife.com' },
  HI: { name: 'Hawaiʻi Division of Forestry and Wildlife', url: 'https://dlnr.hawaii.gov/dofaw/' },
  ID: { name: 'Idaho Fish and Game', url: 'https://idfg.idaho.gov' },
  IL: { name: 'Illinois Department of Natural Resources', url: 'https://dnr.illinois.gov' },
  IN: { name: 'Indiana DNR Fish and Wildlife', url: 'https://www.in.gov/dnr/fish-and-wildlife/' },
  IA: { name: 'Iowa Department of Natural Resources', url: 'https://www.iowadnr.gov' },
  KS: { name: 'Kansas Department of Wildlife and Parks', url: 'https://ksoutdoors.com' },
  KY: { name: 'Kentucky Department of Fish and Wildlife', url: 'https://fw.ky.gov' },
  LA: { name: 'Louisiana Department of Wildlife and Fisheries', url: 'https://www.wlf.louisiana.gov' },
  ME: { name: 'Maine Inland Fisheries and Wildlife', url: 'https://www.maine.gov/ifw/' },
  MD: { name: 'Maryland DNR Wildlife and Heritage', url: 'https://dnr.maryland.gov/wildlife/' },
  MA: { name: 'MassWildlife', url: 'https://www.mass.gov/orgs/division-of-fisheries-and-wildlife' },
  MI: { name: 'Michigan Department of Natural Resources', url: 'https://www.michigan.gov/dnr' },
  MN: { name: 'Minnesota Department of Natural Resources', url: 'https://www.dnr.state.mn.us' },
  MS: { name: 'Mississippi Dept. of Wildlife, Fisheries, and Parks', url: 'https://www.mdwfp.com' },
  MO: { name: 'Missouri Department of Conservation', url: 'https://mdc.mo.gov' },
  MT: { name: 'Montana Fish, Wildlife & Parks', url: 'https://fwp.mt.gov' },
  NE: { name: 'Nebraska Game and Parks', url: 'https://outdoornebraska.gov' },
  NV: { name: 'Nevada Department of Wildlife', url: 'https://www.ndow.org' },
  NH: { name: 'New Hampshire Fish and Game', url: 'https://www.wildlife.nh.gov' },
  NJ: { name: 'NJ Fish and Wildlife', url: 'https://dep.nj.gov/njfw/' },
  NM: { name: 'New Mexico Department of Game and Fish', url: 'https://wildlife.dgf.nm.gov' },
  NY: { name: 'New York DEC', url: 'https://dec.ny.gov/things-to-do/hunting' },
  NC: { name: 'NC Wildlife Resources Commission', url: 'https://www.ncwildlife.org' },
  ND: { name: 'North Dakota Game and Fish', url: 'https://gf.nd.gov' },
  OH: { name: 'Ohio DNR Division of Wildlife', url: 'https://ohiodnr.gov/discover-and-learn/safety-conservation/about-odnr/wildlife' },
  OK: { name: 'Oklahoma Department of Wildlife Conservation', url: 'https://www.wildlifedepartment.com' },
  OR: { name: 'Oregon Department of Fish and Wildlife', url: 'https://myodfw.com' },
  PA: { name: 'Pennsylvania Game Commission', url: 'https://www.pgc.pa.gov' },
  RI: { name: 'Rhode Island DEM Fish and Wildlife', url: 'https://dem.ri.gov/natural-resources-bureau/fish-wildlife' },
  SC: { name: 'South Carolina DNR', url: 'https://www.dnr.sc.gov' },
  SD: { name: 'South Dakota Game, Fish and Parks', url: 'https://gfp.sd.gov' },
  TN: { name: 'Tennessee Wildlife Resources Agency', url: 'https://www.tn.gov/twra.html' },
  TX: { name: 'Texas Parks and Wildlife', url: 'https://tpwd.texas.gov' },
  UT: { name: 'Utah Division of Wildlife Resources', url: 'https://wildlife.utah.gov' },
  VT: { name: 'Vermont Fish and Wildlife', url: 'https://vtfishandwildlife.com' },
  VA: { name: 'Virginia Department of Wildlife Resources', url: 'https://dwr.virginia.gov' },
  WA: { name: 'Washington Department of Fish and Wildlife', url: 'https://wdfw.wa.gov' },
  WV: { name: 'West Virginia DNR', url: 'https://wvdnr.gov' },
  WI: { name: 'Wisconsin Department of Natural Resources', url: 'https://dnr.wisconsin.gov' },
  WY: { name: 'Wyoming Game and Fish Department', url: 'https://wgfd.wyo.gov' },
};
