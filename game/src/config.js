// Static configuration for Azura Bay: world size, districts, vehicles, people and
// tuning numbers. No logic lives here, only data the other modules read.
// SPDX-License-Identifier: MIT

export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 92,
  sidewalk: 26,
  beachTop: 2360,
};

export const ROAD_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROAD_Y = [250, 600, 950, 1300, 1650, 2000, 2350];

// Sun-soaked coastal city, invented for this game. Districts are named after their
// landmarks, never after any real or commercial game map.
export const DISTRICTS = [
  { name: 'Old Harbor', x: 0, y: 0, w: 900, h: 800, tint: '#c98f5f' },
  { name: 'Neon Row', x: 900, y: 0, w: 1100, h: 800, tint: '#e05a8d' },
  { name: 'Palm Heights', x: 2000, y: 0, w: 1600, h: 800, tint: '#7fb069' },
  { name: 'Dockside', x: 0, y: 800, w: 900, h: 800, tint: '#5f7fa8' },
  { name: 'Coral University', x: 900, y: 800, w: 1100, h: 800, tint: '#d9a441' },
  { name: 'Sunset Beach', x: 0, y: 2300, w: 3600, h: 300, tint: '#e8c878' },
];

export const CAR_MODELS = [
  { name: 'Pipit', top: 3.4, accel: 0.22, max: 6.4, turn: 0.055, colors: ['#d8d3c8', '#7fa8c9', '#c95f5f'] },
  { name: 'Coral GT', top: 4.2, accel: 0.3, max: 8.2, turn: 0.06, colors: ['#e8b23a', '#2f6fb2', '#222831'] },
  { name: 'Marlin S', top: 4.6, accel: 0.34, max: 9.0, turn: 0.065, colors: ['#b23a48', '#f2f2f2', '#3a7d5d'] },
  { name: 'Tide Van', top: 5.2, accel: 0.16, max: 5.6, turn: 0.042, colors: ['#e8e4da', '#8a94a6'] },
  { name: 'Dune Buggy', top: 3.8, accel: 0.26, max: 7.0, turn: 0.07, colors: ['#e07840', '#4a7a5c'] },
  { name: 'Harbor Taxi', top: 4.0, accel: 0.24, max: 7.2, turn: 0.058, colors: ['#f2c230'] },
];

export const POLICE_COLORS = ['#1d3557', '#14263e'];
export const PED_SHIRTS = ['#e05a8d', '#4a90d9', '#f2c230', '#7fb069', '#b565d8', '#e07840', '#f2f2f2', '#3a3a3a'];
export const PED_SKINS = ['#f2c9a0', '#d9a06b', '#a06b3f', '#8a5a2b', '#f7d7b5'];

export const PLAYER = {
  walkSpeed: 3.1,
  runSpeed: 5.0,
  radius: 13,
  maxHealth: 100,
  pistolDamage: 26,
  pistolRateMs: 170,
  pistolRange: 420,
  magSize: 12,
  reloadMs: 900,
};

export const WANTED = {
  decayMs: 9000,
  maxStars: 5,
  // police cars chasing at each wanted level
  chaseCars: [0, 1, 2, 3, 4, 5],
  // on-foot officers shooting at each wanted level
  footCops: [0, 0, 1, 2, 3, 4],
};

export const STORY = {
  hero: 'Nia Reyes',
  heroJob: 'getaway driver',
  fixer: "Oz Bell",
  villain: 'Dante Kroll',
  gang: 'the Kroll crew',
  city: 'Azura Bay',
  title: 'AZURA BAY',
  subtitle: 'Getaway',
};

export const CONTROLS_TEXT = [
  'WASD move / drive',
  'Mouse aim, Click shoot',
  'E enter / steal car',
  'Shift sprint',
  'Space handbrake',
  'P pause, M mute',
];
