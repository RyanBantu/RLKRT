// All copy and spec numbers live here. Every number is a placeholder: edit freely.

export const brand = {
  name: 'Rugged Lynx Trail Cam Co.',
  model: 'RL-1',
  tagline: 'Nothing Escapes the Lynx',
  logo: '/brand/rugged-lynx-logo-2-2-trimmed.svg',
  logoAlt: 'Rugged Lynx Trail Cam Co.',
};

export const hero = {
  eyebrow: 'RL-1 · True 4K infrared trail camera',
  headline: 'Nothing escapes the Lynx',
  brief:
    'A bark-camo field camera that wakes in a tenth of a second, sees 30 meters into the dark without a visible glow, and runs for months on a tray of AAs.',
  stats: [
    { value: '0.1 s', label: 'trigger' },
    { value: '30 m', label: 'night range' },
    { value: 'True 4K', label: 'video' },
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
export const menuLabels = { open: 'Open menu', close: 'Close menu' };

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
    body: 'Stainless-pinned hinges carry a full-face door. Two over-center latches pull it down onto a continuous silicone gasket, and a lock tab takes a padlock or cable.',
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
    body: 'A six-element f/2.0 lens with a 133° field of view focuses onto a Sony back-side-illuminated sensor. A switching infrared-cut filter gives true color by day and full infrared sensitivity at night.',
    specs: [
      { value: 'f/2.0', label: '6-element glass' },
      { value: '1/1.8″', label: 'BSI CMOS' },
      { value: 'Infrared-cut', label: 'auto day / night' },
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
  lift?: 'up' | 'down'; // which way the leader bends, to keep neighboring labels apart
};

// `id` must match an <Anchor id> inside the 3D model.
export const callouts: Callout[] = [
  { id: 'hinge', chapter: 1, label: 'Stainless hinge pins', side: 'left' },
  { id: 'gasket', chapter: 1, label: 'IP66 silicone gasket', side: 'right' },
  { id: 'latch', chapter: 1, label: 'Over-center latches', side: 'right', lift: 'down' },
  { id: 'housing', chapter: 1, label: 'Bark-camo housing', side: 'left', lift: 'down' },
  { id: 'lens', chapter: 2, label: 'Lens', value: 'f/2.0 · 6 elements', side: 'right' },
  { id: 'irCut', chapter: 2, label: 'Infrared-cut filter', value: 'auto switching', side: 'left' },
  { id: 'sensor', chapter: 2, label: 'Image sensor', value: '1/1.8″ BSI CMOS', side: 'right', lift: 'down' },
  { id: 'leds', chapter: 3, label: 'Infrared array', value: '24 × 940 nm', side: 'left' },
  { id: 'range', chapter: 3, label: 'Night range', value: '30 m', side: 'right', lift: 'down' },
  { id: 'fresnel', chapter: 4, label: 'Fresnel lens', value: '120° · 3 zones', side: 'right' },
  { id: 'pirCan', chapter: 4, label: 'Dual-element PIR', value: '0.1 s trigger', side: 'left', lift: 'down' },
  { id: 'isp', chapter: 5, label: 'Image processor', value: 'True 4K30 ISP', side: 'left' },
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

// ---------------------------------------------------------------- True 4K explainer
// RL-1 imaging hardware. Source: SincereFirst SF3X678BA V1.0 module spec, 2023-08-16
// (Sony IMX678-AAQR1-C, 1/1.8", pixel array 3856 × 2200).
// TODO: these must match the production RL-1 hardware before launch.
export const SENSOR_MODEL: string = 'Sony'; // shown as the brand only, no part number. TODO: confirm against the production RL-1 before launch
export const SENSOR_MP: number | null = 8.3; // TODO: confirm against the production RL-1 before launch (null hides the number)
export const NATIVE_VIDEO_RES = '3840 × 2160'; // TODO: confirm against the production RL-1 before launch
export const STILL_RES_NATIVE = '3840 × 2160'; // TODO: confirm against the production RL-1 before launch
/** Every stills resolution the site quotes. Each must be at or below STILL_RES_NATIVE, or it is interpolated. */
export const STILL_RES_SHOWN: string[] = [];

export const trueFourK = {
  open: 'True 4K?',
  openLabel: 'What true 4K means: open the explainer',
  dialogLabel: 'True 4K explained',
  title: 'True 4K?',
  close: 'Close',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  stepOf: (k: number, n: number) => `Step ${k} of ${n}`,
  sensorLabel: 'Sensor',
  sensors: [
    { mp: 2, label: '2 MP' },
    { mp: 5, label: '5 MP' },
    { mp: 8.3, label: '8.3 MP' },
  ],
  dividerLabel: 'Comparison divider',
  real: 'Real',
  guessed: 'Guessed',
  guessedShare: 'guessed',
  readout: (res: string) => `REC · ${res}`,
  steps: [
    {
      title: 'This is true 4K',
      body: 'A true 4K frame is 3840 × 2160. A native 4K sensor has a photosite for every one of those pixels, so each pixel is its own measurement of the light.',
      counter: 'pixels measured',
      canvas: 'A trail camera frame zooming in on an amber ear tag. Every pixel is sharp and the tag’s small print is readable.',
    },
    {
      title: 'This is a 2 MP sensor',
      body: 'Many cameras sold as 4K use a 1920 × 1080 sensor. Zoom into the same tag and there are only a quarter as many real measurements behind it.',
      counter: 'pixels measured',
      canvas: 'The same frame from a 2 megapixel sensor. Zoomed in, the pixels are twice as large and the tag’s small print breaks up.',
    },
    {
      title: 'So where do the other pixels come from?',
      body: 'To save a “4K” file, the camera splits each real pixel into four and fills three of them in by averaging the neighbors. Three in every four pixels are guesses.',
      counter: '',
      canvas: 'Each 2 megapixel pixel splits into four. One keeps its real value, outlined in cream. Three are guessed from neighboring pixels, outlined in dashed amber.',
    },
    {
      title: 'Guesses aren’t detail',
      body: 'Drag the divider. The left side is a 4K file upscaled from the sensor you pick; the right side is true 4K. Fine print, thin twigs and tight line pairs are where guessing fails.',
      counter: '',
      canvas: 'A split comparison. Left of the divider is an interpolated 4K image from the selected sensor, right is true 4K. A magnifier shows the area under the pointer at four times zoom.',
    },
    {
      title: 'Read the tag',
      body: '', // built from the hardware constants, see trueFourKVerdict()
      counter: '',
      canvas: 'Side-by-side close-ups of the ear tag. On the interpolated 2 megapixel side NETLYNX 2026 is a smear; on the true 4K side it is crisp.',
    },
  ],
  checkTitle: 'Before you buy any “4K” trail cam',
  check: [
    'Find the sensor’s megapixels, not just the video setting. True 4K needs at least 8.3 MP.',
    'Look for the sensor model on the spec sheet. If it isn’t listed, ask.',
    'Stills quoted above the sensor’s resolution are interpolated too.',
    'Judge a zoomed-in crop, not the whole frame on a phone screen.',
  ],
  tradeoff:
    'The fair tradeoff: a lower-resolution sensor of the same size has bigger pixels, and bigger pixels gather more light, which can mean cleaner night shots. Upscaling that image to “4K” still doesn’t add detail.',
  closeLeft: 'Interpolated · 2 MP',
  closeRight: 'True 4K · RL-1',
  teaser: {
    eyebrow: 'True 4K',
    title: 'Most “4K” trail cams aren’t',
    body: 'Many record from a 2 MP sensor and guess three of every four pixels. See what that does to the detail you’re hanging a camera for.',
  },
};

export function trueFourKVerdict() {
  return SENSOR_MP
    ? `Rugged Lynx RL-1 records ${NATIVE_VIDEO_RES} from ${/^(8|11|18)/.test(String(SENSOR_MP)) ? 'an' : 'a'} ${SENSOR_MP} MP native sensor. Every pixel is real.`
    : `Rugged Lynx RL-1 records ${NATIVE_VIDEO_RES} from a native sensor. Every pixel is real.`;
}
