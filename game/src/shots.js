// Screenshot presets for Azura Bay. Each shot arranges the live game state into one
// readable scene — a chase, a drive, a firefight, the title — so the screenshots
// show the systems working, not a menu alone. Only used through ?shot=<name>.
// SPDX-License-Identifier: MIT

import { makeCar, makePoliceCar, makeEnemy, makeBullet } from './entities.js';
import { startMission } from './missions.js';

function giveCar(state, modelIndex, x, y, angle, color) {
  const car = makeCar(modelIndex, x, y, angle, 'player');
  if (color) car.color = color;
  car.speed = 5.2;
  car.driver = 'player';
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.x = x;
  p.y = y;
  p.angle = angle;
  state.camX = x;
  state.camY = y;
  return car;
}

function spawnPoliceRing(state, cx, cy, count) {
  const spots = [
    [-260, 120, 0.3], [240, -140, -0.4], [-80, 300, 1.2],
    [300, 260, 2.6], [-320, -220, -2.4],
  ];
  for (let i = 0; i < count; i++) {
    const [dx, dy, da] = spots[i % spots.length];
    const car = makePoliceCar(cx + dx, cy + dy, da);
    car.speed = 6.5;
    state.cars.push(car);
  }
}

function spawnCrew(state) {
  const spots = [[260, 1600], [360, 1700], [300, 1560], [380, 1620]];
  spots.forEach(([x, y], i) => {
    const e = makeEnemy(x, y, 60);
    e.shootTimer = 150 + i * 40; // a beat before the first volley, for the player and the shot
    state.enemies.push(e);
  });
}

function clearCard(state) {
  state.storyCard = null;
}

export function applyShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    state.screen = 'title';
    state.camX = 1500;
    state.camY = 250;
    p.x = 1500;
    p.y = 600;
    return 'title';
  }

  state.screen = 'play';
  if (name === 'drive') {
    // Cruising Neon Row in the Coral GT, first job on the board.
    giveCar(state, 1, 1100, 230, 0, '#e8b23a');
    state.player.car.speed = 2.6;
    startMission(state, 0);
    state.mission.stepIndex = 2;
    state.objective = state.mission.def.steps[2].text;
    p.cash = 550;
    p.health = 100;
    // A little traffic to share the road with, in the other lane.
    const t1 = makeCar(0, 1500, 275, 0, 'traffic');
    t1.speed = 3.4;
    state.cars.push(t1);
    const t2 = makeCar(4, 900, 600, Math.PI / 2, 'traffic');
    t2.speed = 3.0;
    state.cars.push(t2);
    const t3 = makeCar(2, 1500, 950, 0, 'traffic');
    t3.speed = 3.8;
    state.cars.push(t3);
    clearCard(state);
    state.log.push('First Fare: drive the Coral GT to Neon Plaza.');
    return 'drive';
  }

  if (name === 'chase') {
    // Three stars, three cruisers on the tail, Harbor Heat on the board.
    giveCar(state, 2, 1300, 950, 0, '#b23a48');
    p.car.speed = 5.5;
    p.wanted = 3;
    p.health = 72;
    p.cash = 1250;
    spawnPoliceRing(state, 1300, 950, 3);
    startMission(state, 2);
    state.mission.stepIndex = 1;
    state.mission.kills = 1;
    spawnCrew(state);
    state.objective = "Clear out Kroll's crew (1/4)";
    state.missionsDone = 2;
    clearCard(state);
    state.log.push("Kroll's crew opened fire — the police are coming too.");
    state.log.push('Mission 3: Harbor Heat');
    return 'chase';
  }

  if (name === 'mission') {
    // On foot at the Old Harbor Docks, mid-firefight.
    p.x = 300;
    p.y = 1600;
    p.angle = 0.6;
    p.health = 88;
    p.ammo = 9;
    p.cash = 980;
    p.wanted = 2;
    state.camX = 300;
    state.camY = 1600;
    startMission(state, 2);
    state.mission.stepIndex = 1;
    state.mission.kills = 1;
    spawnCrew(state);
    state.objective = "Clear out Kroll's crew (1/4)";
    state.missionsDone = 2;
    // A shot already in the air and a blast going off at the docks.
    state.bullets.push(makeBullet(330, 1610, 0.6, true));
    state.explosions.push({ x: 380, y: 1620, t: 26, r: 10 });
    state.sparks.push({ x: 360, y: 1700, t: 8 });
    spawnPoliceRing(state, 300, 1600, 1);
    clearCard(state);
    state.log.push('Mission 3: Harbor Heat');
    return 'mission';
  }

  // Unknown shot name: just play from the start.
  state.screen = 'play';
  startMission(state, 0);
  clearCard(state);
  return 'play';
}
