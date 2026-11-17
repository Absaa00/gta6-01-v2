// Azura Bay — Getaway. Entry point: builds the world, runs the game loop, owns the
// screens (title / play / pause / game over), the camera, and the save file.
// SPDX-License-Identifier: MIT

import { WORLD, STORY } from './config.js';
import { makeRng, clamp, hashString } from './random.js';
import { buildCity } from './world.js';
import { SoundBank } from './audio.js';
import { createInput } from './input.js';
import {
  createPlayer, makeCar, makePed, updatePlayer, updateTraffic, updatePeds,
  updatePolice, updateEnemies, updateBullets,
} from './entities.js';
import {
  MISSIONS, startMission, currentStep, updateMission, missionHook, updateTaxi,
  spawnTaxiFare,
} from './missions.js';
import { createRenderer } from './render.js';
import { applyShot } from './shots.js';

const SAVE_KEY = 'azura-bay-save-v2';

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save.cash !== 'number' || typeof save.missionsDone !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    const save = {
      cash: state.player.cash,
      missionsDone: state.missionsDone,
      packages: state.packages,
      health: Math.max(1, Math.ceil(state.player.health)),
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    state.save = save;
    state.log.push('Progress saved.');
  } catch {
    state.log.push('Save failed — storage unavailable.');
  }
}

function buildState(seed, canvas) {
  const city = buildCity(seed);
  const rng = makeRng(seed ^ 0x9e3779b9);
  const sounds = new SoundBank();
  const input = createInput(canvas);
  const player = createPlayer(700, 1300);

  const state = {
    seed,
    city,
    rng,
    sounds,
    input,
    player,
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    floaters: [],
    sparks: [],
    explosions: [],
    mission: null,
    taxi: null,
    objective: '',
    storyCard: null,
    log: [],
    hudFlash: 0,
    shake: 0,
    muzzle: null,
    missionsDone: 0,
    packages: 0,
    freeRoam: false,
    lastPoliceSpawn: 0,
    lastCopSpawn: 0,
    screen: 'title',
    time: 0,
    lastFrame: 0,
    save: readSave(),
    missionTarget: null,
    taxiTimer: 0,
    camX: 700,
    camY: 1300,
    overAt: 0,
    startedAt: Date.now(),
  };
  state.missionHook = (event, payload) => missionHook(state, event, payload);

  // Traffic cars on the roads.
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const x = vertical
      ? [300, 700, 1100, 1500, 1900, 2300, 2700, 3100][rng.int(0, 7)]
      : rng.range(120, WORLD.width - 120);
    const y = vertical
      ? rng.range(120, WORLD.height - 120)
      : [250, 600, 950, 1300, 1650, 2000, 2350][rng.int(0, 6)];
    const car = makeCar(rng.int(0, 5), x, y, vertical ? Math.PI / 2 : 0, 'traffic');
    car.speed = car.model.max * 0.4;
    state.cars.push(car);
  }
  // Parked cars the player can steal, from the city's own spawn list.
  for (const spawn of city.carSpawns.slice(0, 44)) {
    const car = makeCar(rng.int(0, 5), spawn.x, spawn.y, spawn.angle, 'parked');
    state.cars.push(car);
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < 64; i++) {
    const spot = city.pedSpawns[rng.int(0, city.pedSpawns.length - 1)];
    state.peds.push(makePed(spot.x + rng.range(-30, 30), spot.y + rng.range(-30, 30), rng));
  }
  // Pickups: health, cash and hidden packages, seeded so every run agrees.
  const pickupSpots = [
    ['health', 1100, 950], ['health', 2300, 600], ['health', 700, 2000],
    ['cash', 1500, 250], ['cash', 2700, 1300], ['cash', 300, 600],
    ['package', 1900, 1650], ['package', 3100, 2350], ['package', 1100, 1650],
    ['package', 2300, 2000], ['package', 700, 250],
  ];
  for (const [kind, x, y] of pickupSpots) {
    state.pickups.push({ kind, x: x + rng.range(-20, 20), y: y + rng.range(-20, 20), amount: kind === 'cash' ? 100 : 0, taken: false });
  }
  return state;
}

function refreshMissionTarget(state) {
  const step = currentStep(state);
  if (step && step.target) {
    state.missionTarget = step.target;
    return;
  }
  if (state.taxi) {
    state.missionTarget = state.taxi.dest;
    return;
  }
  state.missionTarget = null;
}

function update(state, dt, now) {
  const p = state.player;
  // Mouse aim in world coordinates.
  const cam = computeCamera(state);
  state.input.mouseWorldX = cam.x0 + state.input.mouseX;
  state.input.mouseWorldY = cam.y0 + state.input.mouseY;

  updatePlayer(state, state.input, dt, now);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt, now);
  updateEnemies(state, dt);
  updateBullets(state, dt, now);
  updateMission(state, dt);
  updateTaxi(state);
  refreshMissionTarget(state);

  // A fresh taxi fare waves every so often.
  state.taxiTimer += dt;
  if (state.taxiTimer > 1500) {
    state.taxiTimer = 0;
    spawnTaxiFare(state);
  }

  for (const f of state.floaters) { f.t -= dt; f.y -= 0.4 * dt; }
  state.floaters = state.floaters.filter((f) => f.t > 0);
  for (const s of state.sparks) s.t -= dt;
  state.sparks = state.sparks.filter((s) => s.t > 0);
  for (const ex of state.explosions) ex.t -= dt;
  state.explosions = state.explosions.filter((ex) => ex.t > 0);
  if (state.muzzle) {
    state.muzzle.t -= dt;
    if (state.muzzle.t <= 0) state.muzzle = null;
  }
  if (state.storyCard) {
    state.storyCard.t -= dt;
    if (state.storyCard.t <= 0) state.storyCard = null;
  }
  if (state.hudFlash > 0) state.hudFlash -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 0.35);
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);

  // Death ends the run after a short beat.
  if (!p.alive && state.screen === 'play') {
    state.overAt += dt;
    if (state.overAt > 90) {
      state.screen = 'over';
      state.sounds.siren(false);
      state.sounds.engineStop();
    }
  }
}

function computeCamera(state) {
  const canvas = state.canvas;
  const vw = canvas.width;
  const vh = canvas.height;
  const p = state.player;
  // Smooth follow with a look-ahead in the driving direction.
  const lookX = p.car ? Math.cos(p.angle) * 60 : 0;
  const lookY = p.car ? Math.sin(p.angle) * 60 : 0;
  state.camX += ((p.x + lookX) - state.camX) * 0.12;
  state.camY += ((p.y + lookY) - state.camY) * 0.12;
  const x0 = clamp(state.camX - vw / 2, 0, Math.max(0, WORLD.width - vw));
  const y0 = clamp(state.camY - vh / 2, 0, Math.max(0, WORLD.height - vh));
  return { x0, y0, x1: x0 + vw, y1: y0 + vh };
}

function startNewGame(state) {
  const p = state.player;
  p.x = 700;
  p.y = 1300;
  p.health = 100;
  p.cash = 250;
  p.wanted = 0;
  p.alive = true;
  p.car = null;
  p.ammo = 12;
  p.invulnUntil = 0;
  state.missionsDone = 0;
  state.packages = 0;
  state.freeRoam = false;
  state.bullets = [];
  state.enemies = [];
  state.cops = [];
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.camX = p.x;
  state.camY = p.y;
  state.overAt = 0;
  state.log = [`${STORY.hero} is back in ${STORY.city}.`];
  state.screen = 'play';
  startMission(state, 0);
}

function continueFromSave(state) {
  const save = state.save;
  if (!save) return false;
  startNewGame(state);
  state.player.cash = save.cash;
  state.player.health = save.health;
  state.player.x = clamp(save.x, 20, WORLD.width - 20);
  state.player.y = clamp(save.y, 20, WORLD.height - 20);
  state.missionsDone = save.missionsDone;
  state.packages = save.packages || 0;
  state.camX = state.player.x;
  state.camY = state.player.y;
  if (save.missionsDone >= MISSIONS.length) {
    state.mission = null;
    state.freeRoam = true;
    state.objective = 'Free roam — taxi fares and hidden packages pay.';
  } else {
    startMission(state, save.missionsDone);
  }
  state.log.push('Save loaded — welcome back to Azura Bay.');
  return true;
}

function handleKeys(state) {
  const input = state.input;
  if (input.pausePressed) {
    input.pausePressed = false;
    if (state.screen === 'play') {
      state.screen = 'pause';
      state.sounds.engineStop();
      state.sounds.siren(false);
    } else if (state.screen === 'pause') {
      state.screen = 'play';
    }
  }
  if (input.mutePressed) {
    input.mutePressed = false;
    state.sounds.setMuted(!state.sounds.muted);
    state.log.push(state.sounds.muted ? 'Sound muted.' : 'Sound on.');
  }
  if (state.screen === 'title') {
    if (input.anyKey) {
      input.anyKey = false;
      state.sounds.unlock();
      startNewGame(state);
    }
  } else if (state.screen === 'pause') {
    if (input.anyKey) {
      // S saves, R restarts from the save; any other key resumes.
      input.anyKey = false;
    }
  } else if (state.screen === 'over') {
    if (input.anyKey) {
      input.anyKey = false;
      if (state.save) continueFromSave(state);
      else startNewGame(state);
    }
  }
}

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seedText = params.get('seed');
  const seed = seedText ? (hashString(seedText) ^ 0x51ab) >>> 0 : 20261117;
  const shot = params.get('shot');
  const canvas = document.getElementById('game');
  const renderer = createRenderer(canvas);

  function fit() {
    renderer.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', fit);
  fit();

  const state = buildState(seed, canvas);
  state.canvas = canvas;
  // Expose a small handle for playtests and screenshots.
  window.__azura = { state, startNewGame, continueFromSave, writeSave };

  if (shot) {
    applyShot(state, shot);
  }

  // Keyboard shortcuts that live outside the input map.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && state.screen === 'title') {
      state.input.anyKey = true;
    }
    if (e.code === 'KeyC' && state.screen === 'title' && state.save) {
      state.sounds.unlock();
      state.input.anyKey = false; // keep handleKeys from starting a new game instead
      continueFromSave(state);
    }
    if (e.code === 'KeyS' && state.screen === 'pause') {
      writeSave(state);
    }
    if (e.code === 'KeyR' && (state.screen === 'pause' || state.screen === 'over')) {
      if (state.save) continueFromSave(state);
      else startNewGame(state);
    }
    if (e.code === 'Enter' && state.screen === 'over') {
      state.input.anyKey = true;
    }
  });
  canvas.addEventListener('mousedown', () => state.sounds.unlock());

  let last = performance.now();
  function frame(now) {
    const dtMs = Math.min(50, now - last);
    last = now;
    const dt = dtMs / 16.7;
    state.time = now;
    try {
      handleKeys(state);
      if (state.screen === 'play') {
        update(state, dt, now);
      } else if (state.screen === 'title') {
        // Idle drift behind the title so the city feels alive.
        state.camX = 1500 + Math.sin(now / 9000) * 350;
        state.camY = 600 + Math.cos(now / 11000) * 250;
        updateTraffic(state, dt);
        updatePeds(state, dt);
      }
      const cam = computeCamera(state);
      renderer.render(state, cam, state.input);
    } catch (err) {
      // One bad frame must never freeze the game: log it and keep going.
      console.error('Azura Bay frame error:', err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('DOMContentLoaded', boot);
