// All copy and spec numbers live here. Every number is a placeholder: edit freely.

export const brand = {
  name: 'Rugged Lynx Trail Cam Co.',
  model: 'RL-1',
  tagline: 'Nothing Escapes the Lynx',
  logo: '/brand/rugged-lynx-logo-2-2-trimmed.svg',
  logoAlt: 'Rugged Lynx Trail Cam Co.',
};

export const hero = {
  eyebrow: 'RL-1 · 4K infrared trail camera',
  headline: 'Nothing escapes the Lynx',
  brief:
    'A bark-camo field camera that wakes in a tenth of a second, sees 30 metres into the dark without a visible glow, and runs for months on a tray of AAs.',
  stats: [
    { value: '0.1 s', label: 'trigger' },
    { value: '30 m', label: 'night range' },
    { value: '4K', label: 'video' },
  ],
  cue: 'Scroll to take it apart',
};

// The drag handle on the chapter rail that scrubs the teardown.
export const teardownSlider = {
  label: 'Take it apart: drag down the rail to step through the teardown',
  hint: 'Drag to take it apart',
  assembled: 'Assembled',
};

export const navLinks = { camera: 'The Camera', netlynx: 'NetLynx', team: 'Team' };

export const team = {
  docTitle: 'Team · Rugged Lynx',
  eyebrow: 'The crew',
  headline: 'The people behind the Lynx',
  intro: 'A small team building gear for people who spend their time outside.',
  members: [
    { name: 'Kyle', role: 'Co-founder & President' },
    { name: 'Ryan', role: 'Co-founder & COO' },
    { name: 'Thatcher', role: 'CEO' },
  ],
};

export const scoutCta = {
  eyebrow: 'NetLynx',
  title: 'Know the ground before you hang a camera',
  body: 'Live conditions, nearby birds, local game and terrain for any U.S. ZIP.',
  link: 'Scout your ground with NetLynx →',
};

export type Spec = { value: string; label: string };
export type Chapter = {
  id: string;
  rail: string;
  eyebrow: string;
  title: string;
  body: string;
  specs?: Spec[];
};

// Chapter 0 is the intro (uses `hero` above); chapter 7 is the closing line.
export const chapters: Chapter[] = [
  { id: 'intro', rail: 'Intro', eyebrow: '', title: '', body: '' },
  {
    id: 'shell',
    rail: 'Shell',
    eyebrow: '01 · The shell',
    title: 'Built to be left out there',
    body: 'Stainless-pinned hinges carry a full-face door. Two over-centre latches pull it down onto a continuous silicone gasket, and a lock tab takes a padlock or cable.',
    specs: [
      { value: 'IP66', label: 'sealed housing' },
      { value: '2 + 2', label: 'hinges · latches' },
      { value: '−20 to 60 °C', label: 'operating' },
    ],
  },
  {
    id: 'optics',
    rail: 'Optics',
    eyebrow: '02 · Optics',
    title: 'Fast glass, big pixels',
    body: 'A six-element f/1.6 lens focuses onto a back-side-illuminated sensor. A switching IR-cut filter gives true colour by day and full infrared sensitivity at night.',
    specs: [
      { value: 'f/1.6', label: '6-element glass' },
      { value: '1/1.8″', label: 'BSI CMOS' },
      { value: 'IR-cut', label: 'auto day / night' },
    ],
  },
  {
    id: 'night',
    rail: 'Night vision',
    eyebrow: '03 · Night vision',
    title: 'Sees in the dark. Invisibly.',
    body: 'Twenty-four 940 nm no-glow LEDs light the scene with infrared that animals and people can’t see, so the camera never gives itself away.',
    specs: [
      { value: '24 ×', label: '940 nm no-glow LEDs' },
      { value: '30 m', label: 'night range' },
    ],
  },
  {
    id: 'trigger',
    rail: 'Trigger',
    eyebrow: '04 · Trigger',
    title: 'Awake before it’s gone',
    body: 'A dual-element PIR sensor behind a Fresnel lens watches three detection zones. The camera fires in a tenth of a second and is ready again half a second later.',
    specs: [
      { value: '0.1 s', label: 'trigger speed' },
      { value: '0.5 s', label: 'recovery' },
      { value: '120°', label: 'detection angle' },
    ],
  },
  {
    id: 'board',
    rail: 'Main board',
    eyebrow: '05 · Main board',
    title: 'The brain sleeps light',
    body: 'A dedicated low-power MCU keeps watch while the image processor sleeps, waking it only when the PIR fires. Footage goes straight to microSD.',
    specs: [
      { value: '4 µA', label: 'sleep current' },
      { value: '512 GB', label: 'microSD max' },
    ],
  },
  {
    id: 'power',
    rail: 'Power',
    eyebrow: '06 · Power',
    title: 'Months on a single load',
    body: 'Eight AA cells slide out on a tray. For permanent sets, plug in a 12 V supply or a solar panel and leave it for the season.',
    specs: [
      { value: '8 × AA', label: 'battery tray' },
      { value: '~6 mo', label: 'standby' },
      { value: '12 V', label: 'DC / solar input' },
    ],
  },
  {
    id: 'reassembled',
    rail: 'Reassembled',
    eyebrow: '07 · Ready',
    title: 'Nothing escapes the Lynx',
    body: 'Close the door, flip the latches, strap it to a tree and walk away.',
  },
];

export type Callout = {
  id: string;
  chapter: number;
  label: string;
  value?: string;
  side?: 'left' | 'right';
  lift?: 'up' | 'down'; // which way the leader bends, to keep neighbouring labels apart
};

// `id` must match an <Anchor id> inside the 3D model.
export const callouts: Callout[] = [
  { id: 'hinge', chapter: 1, label: 'Stainless hinge pins', side: 'left' },
  { id: 'gasket', chapter: 1, label: 'IP66 silicone gasket', side: 'right' },
  { id: 'latch', chapter: 1, label: 'Over-centre latches', side: 'right', lift: 'down' },
  { id: 'housing', chapter: 1, label: 'Bark-camo housing', side: 'left', lift: 'down' },
  { id: 'lens', chapter: 2, label: 'Lens', value: 'f/1.6 · 6 elements', side: 'right' },
  { id: 'irCut', chapter: 2, label: 'IR-cut filter', value: 'auto switching', side: 'left' },
  { id: 'sensor', chapter: 2, label: 'Image sensor', value: '1/1.8″ BSI CMOS', side: 'right', lift: 'down' },
  { id: 'leds', chapter: 3, label: 'IR array', value: '24 × 940 nm', side: 'left' },
  { id: 'range', chapter: 3, label: 'Night range', value: '30 m', side: 'right', lift: 'down' },
  { id: 'fresnel', chapter: 4, label: 'Fresnel lens', value: '120° · 3 zones', side: 'right' },
  { id: 'pirCan', chapter: 4, label: 'Dual-element PIR', value: '0.1 s trigger', side: 'left', lift: 'down' },
  { id: 'isp', chapter: 5, label: 'Image processor', value: '4K30 ISP', side: 'left' },
  { id: 'mcu', chapter: 5, label: 'Wake MCU', value: '4 µA sleep', side: 'right', lift: 'down' },
  { id: 'pmic', chapter: 5, label: 'PMIC', value: '12 V / AA', side: 'left', lift: 'down' },
  { id: 'sd', chapter: 5, label: 'microSD', value: 'up to 512 GB', side: 'right', lift: 'down' },
  { id: 'cells', chapter: 6, label: 'Battery tray', value: '8 × AA', side: 'left' },
  { id: 'standby', chapter: 6, label: 'Standby', value: '~6 months', side: 'right', lift: 'down' },
  { id: 'dc', chapter: 6, label: 'DC / solar in', value: '12 V', side: 'right', lift: 'down' },
];

export const stamp = {
  prefix: 'RUGGED LYNX',
  cam: 'CAM 01',
  tempC: 14,
};

export const footer = {
  line: 'Nothing Escapes the Lynx',
  note: 'All specifications are preliminary.',
};
