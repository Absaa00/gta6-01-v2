// Actors of Azura Bay: the player on foot and behind the wheel, traffic cars,
// pedestrians, police cars and foot officers, mission gunmen, bullets and pickups.
// All movement, collisions and wanted-level behaviour live here.
// SPDX-License-Identifier: MIT

import { WORLD, ROAD_X, ROAD_Y, CAR_MODELS, POLICE_COLORS, PED_SHIRTS, PED_SKINS, PLAYER, WANTED } from './config.js';
import { clamp, dist2, angleDiff, angleTo } from './random.js';
import { resolveCircleRect, onRoad, nearestRoadPoint } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.maxHealth, cash: 250, wanted: 0, wantedTimer: 0,
    car: null, ammo: PLAYER.magSize, reloading: 0, lastShot: 0,
    alive: true, invulnUntil: 0, sprinting: false,
  };
}

export function makeCar(modelIndex, x, y, angle, kind) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0, model, modelIndex,
    color: model.colors[Math.floor(Math.random() * model.colors.length)],
    kind, // 'player' | 'traffic' | 'police' | 'parked'
    hp: 100, driver: kind === 'parked' ? null : 'npc',
    target: null, targetTimer: 0, stuckTimer: 0, honkTimer: 0,
    sirenPhase: Math.random() * Math.PI * 2,
  };
}

export function makePoliceCar(x, y, angle) {
  const car = makeCar(2, x, y, angle, 'police');
  car.color = POLICE_COLORS[Math.floor(Math.random() * POLICE_COLORS.length)];
  car.hp = 120;
  return car;
}

export function makePed(x, y, rng) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(0.5, 1.1),
    shirt: rng.pick(PED_SHIRTS), skin: rng.pick(PED_SKINS),
    target: null, state: 'walk', // walk | flee | taxi | passenger | dead
    waitTimer: rng.range(0, 240), panic: 0, fare: null,
  };
}

export function makeCop(x, y) {
  return { x, y, angle: 0, health: 60, shootTimer: 40 + Math.random() * 60, speed: 2.2, state: 'chase' };
}

export function makeEnemy(x, y, hp) {
  return { x, y, angle: 0, health: hp || 60, shootTimer: 50 + Math.random() * 80, speed: 1.6, state: 'fight' };
}

export function makeBullet(x, y, angle, fromPlayer) {
  const speed = 16;
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: 30, fromPlayer, damage: fromPlayer ? PLAYER.pistolDamage : 9,
  };
}

function collideWorld(state, x, y, r) {
  let px = x;
  let py = y;
  let hit = false;
  for (const rect of state.city.colliders) {
    if (px + r < rect.x || px - r > rect.x + rect.w || py + r < rect.y || py - r > rect.y + rect.h) continue;
    const res = resolveCircleRect(px, py, r, rect);
    px = res.x;
    py = res.y;
    hit = hit || res.hit;
  }
  px = clamp(px, 20, WORLD.width - 20);
  py = clamp(py, 20, WORLD.height - 20);
  return { x: px, y: py, hit };
}

function carHitsBuilding(state, car) {
  const r = 16;
  for (const rect of state.city.colliders) {
    if (car.x + r < rect.x || car.x - r > rect.x + rect.w || car.y + r < rect.y || car.y - r > rect.y + rect.h) continue;
    return true;
  }
  return false;
}

export function addWanted(state, stars) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + stars, 0, WANTED.maxStars);
  p.wantedTimer = 0;
  if (p.wanted > before) state.sounds.wantedUp();
  state.hudFlash = 30;
}

export function nearestCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (const car of state.cars) {
    if (car.kind === 'player') continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  if (!car || car.kind === 'player') return false;
  if (car.kind === 'parked' || car.kind === 'traffic') {
    // Stealing a car in front of witnesses raises heat.
    if (car.kind === 'traffic') addWanted(state, 1);
    car.kind = 'player';
    car.driver = 'player';
    p.car = car;
    state.sounds.door();
    return true;
  }
  return false;
}

export function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  car.kind = car.driver === 'player' ? 'parked' : car.kind;
  car.driver = null;
  p.car = null;
  // Step out to the side of the car.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  const res = collideWorld(state, p.x, p.y, PLAYER.radius);
  p.x = res.x;
  p.y = res.y;
  state.sounds.door();
}

export function updatePlayer(state, input, dt, now) {
  const p = state.player;
  if (!p.alive) return;
  if (p.reloading > 0) p.reloading -= dt;

  if (p.car) {
    updatePlayerCar(state, input, dt);
    return;
  }

  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || my !== 0;
  p.sprinting = !!input.sprint && moving;
  const speed = p.sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const res = collideWorld(state, nx, ny, PLAYER.radius);
    p.x = res.x;
    p.y = res.y;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Face the mouse.
  p.angle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);

  // Shooting.
  if (input.shooting && now - p.lastShot >= PLAYER.pistolRateMs && p.ammo > 0 && p.reloading <= 0) {
    p.lastShot = now;
    p.ammo -= 1;
    const bx = p.x + Math.cos(p.angle) * 20;
    const by = p.y + Math.sin(p.angle) * 20;
    state.bullets.push(makeBullet(bx, by, p.angle + (Math.random() - 0.5) * 0.05, true));
    state.sounds.shoot();
    state.muzzle = { x: bx, y: by, t: 4 };
    if (p.wanted === 0) addWanted(state, 1);
    scareNearbyPeds(state, p.x, p.y, 500);
    if (p.ammo === 0) {
      p.reloading = PLAYER.reloadMs;
      p.ammo = PLAYER.magSize;
    }
  }

  // Enter / steal the nearest car.
  if (input.enterPressed) {
    const car = nearestCar(state, p.x, p.y, 70);
    if (car) {
      enterCar(state, car);
      state.missionHook('enterCar', car);
    } else {
      // Maybe hail a taxi fare instead.
      const fare = state.peds.find((ped) => ped.state === 'taxi' && dist2(p.x, p.y, ped.x, ped.y) < 60 * 60);
      if (fare) state.missionHook('hailTaxi', fare);
    }
    input.enterPressed = false;
  }

  // Pick up items.
  for (const pickup of state.pickups) {
    if (pickup.taken) continue;
    if (dist2(p.x, p.y, pickup.x, pickup.y) < 34 * 34) {
      pickup.taken = true;
      if (pickup.kind === 'health') {
        p.health = Math.min(PLAYER.maxHealth, p.health + 40);
        state.sounds.pickup();
        state.floaters.push({ x: p.x, y: p.y - 20, text: '+40 HP', color: '#7dff5e', t: 60 });
      } else if (pickup.kind === 'cash') {
        p.cash += pickup.amount;
        state.sounds.cash();
        state.floaters.push({ x: p.x, y: p.y - 20, text: `+$${pickup.amount}`, color: '#ffe14d', t: 60 });
      } else if (pickup.kind === 'package') {
        p.cash += 150;
        state.packages += 1;
        state.sounds.cash();
        state.floaters.push({ x: p.x, y: p.y - 20, text: 'Hidden package +$150', color: '#ff9de2', t: 60 });
      }
    }
  }

  // Wanted decay: stay clean and out of police sight and the heat fades.
  if (p.wanted > 0) {
    const policeNear = state.cars.some((c) => c.kind === 'police' && dist2(p.x, p.y, c.x, c.y) < 420 * 420)
      || state.cops.some((c) => dist2(p.x, p.y, c.x, c.y) < 380 * 380);
    if (!policeNear) {
      p.wantedTimer += dt * 16.7;
      if (p.wantedTimer > WANTED.decayMs) {
        p.wanted -= 1;
        p.wantedTimer = 0;
        state.floaters.push({ x: p.x, y: p.y - 26, text: 'Heat cooling off…', color: '#9db8d9', t: 70 });
      }
    } else {
      p.wantedTimer = 0;
    }
  }
}

function updatePlayerCar(state, input, dt) {
  const p = state.player;
  const car = p.car;
  const model = car.model;
  const forward = input.up ? 1 : input.down ? -0.55 : 0;
  if (forward !== 0) {
    car.speed += model.accel * forward * dt;
  } else {
    car.speed *= Math.pow(0.985, dt);
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  if (input.handbrake) car.speed *= Math.pow(0.94, dt);
  car.speed = clamp(car.speed, -model.max * 0.45, model.max);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 0.2) {
    car.angle += steer * model.turn * (car.speed / model.max) * dt * (car.speed >= 0 ? 1 : -1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const prevX = car.x;
  const prevY = car.y;
  car.x = clamp(nx, 24, WORLD.width - 24);
  car.y = clamp(ny, 24, WORLD.height - 24);
  if (carHitsBuilding(state, car)) {
    car.x = prevX;
    car.y = prevY;
    if (Math.abs(car.speed) > 3) {
      state.sounds.crash();
      state.shake = 8;
      addWanted(state, 0); // a crash alone is not a crime; witnesses may still call it in
      if (Math.random() < 0.25) addWanted(state, 1);
    }
    car.speed *= -0.25;
  }
  // Soft collisions with other cars.
  for (const other of state.cars) {
    if (other === car) continue;
    const d2 = dist2(car.x, car.y, other.x, other.y);
    if (d2 < 52 * 52 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (52 - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      car.x += ux * push;
      car.y += uy * push;
      other.x -= ux * push;
      other.y -= uy * push;
      if (Math.abs(car.speed) > 4 && other.kind === 'traffic') {
        state.sounds.crash();
        state.shake = 6;
        addWanted(state, 1);
        other.speed = 0;
      }
    }
  }
  // Running over pedestrians is a crime, and the crowd notices.
  for (const ped of state.peds) {
    if (ped.state === 'dead' || ped.state === 'passenger') continue;
    if (dist2(car.x, car.y, ped.x, ped.y) < 34 * 34 && Math.abs(car.speed) > 1.5) {
      ped.state = 'dead';
      addWanted(state, 1);
      state.sounds.crash();
      state.floaters.push({ x: ped.x, y: ped.y - 18, text: 'Pedestrian down!', color: '#ff5e5e', t: 70 });
      scareNearbyPeds(state, ped.x, ped.y, 420);
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  state.sounds.engineStart(Math.abs(car.speed) / model.max);

  if (input.enterPressed) {
    input.enterPressed = false;
    state.sounds.engineStop();
    exitCar(state);
  }
}

export function scareNearbyPeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state === 'dead' || ped.state === 'passenger') continue;
    if (dist2(x, y, ped.x, ped.y) < radius * radius) {
      ped.state = 'flee';
      ped.panic = 300;
    }
  }
}

function pickRoadTarget(state, x, y) {
  // Pick a random intersection-ish point on a road near the actor.
  const rx = ROAD_X[Math.floor(Math.random() * ROAD_X.length)];
  const ry = ROAD_Y[Math.floor(Math.random() * ROAD_Y.length)];
  if (Math.random() < 0.5) return { x: rx, y: clamp(y + (Math.random() - 0.5) * 700, 60, WORLD.height - 60), vertical: true };
  return { x: clamp(x + (Math.random() - 0.5) * 700, 60, WORLD.width - 60), y: ry, vertical: false };
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    car.targetTimer -= dt;
    if (!car.target || car.targetTimer <= 0 || dist2(car.x, car.y, car.target.x, car.target.y) < 40 * 40) {
      car.target = pickRoadTarget(state, car.x, car.y);
      car.targetTimer = 900;
    }
    const want = angleTo(car.x, car.y, car.target.x, car.target.y);
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -0.045 * dt, 0.045 * dt);
    // Slow down for a car ahead.
    let ahead = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const d = dist2(car.x, car.y, other.x, other.y);
      if (d < 70 * 70) {
        const a = angleTo(car.x, car.y, other.x, other.y);
        if (Math.abs(angleDiff(car.angle, a)) < 0.6) { ahead = true; break; }
      }
    }
    const targetSpeed = ahead ? 0 : car.model.max * 0.45;
    car.speed += (targetSpeed - car.speed) * 0.02 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    if (carHitsBuilding(state, car)) {
      car.angle += Math.PI / 2;
      car.target = pickRoadTarget(state, car.x, car.y);
    }
    // Keep traffic on roads: nudge back if it drifted off.
    if (!onRoad(car.x, car.y)) {
      const near = nearestRoadPoint(car.x, car.y);
      if (near) {
        const pull = 0.06 * dt;
        car.x += (near.x - car.x) * pull;
        car.y += (near.y - car.y) * pull;
      }
    }
  }
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.state === 'dead' || ped.state === 'passenger') continue;
    ped.waitTimer -= dt;
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const p = state.player;
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 2.4 * dt;
      const ny = ped.y + Math.sin(away) * 2.4 * dt;
      const res = collideWorld(state, nx, ny, 10);
      ped.x = res.x;
      ped.y = res.y;
      if (ped.panic <= 0) { ped.state = 'walk'; ped.target = null; }
      continue;
    }
    if (ped.state === 'taxi') {
      // Waiting for a fare: stand still and wave.
      ped.waitTimer = 100;
      continue;
    }
    if (!ped.target || ped.waitTimer <= 0 && dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 12 * 12) {
      const spot = state.city.pedSpawns[Math.floor(Math.random() * state.city.pedSpawns.length)];
      ped.target = { x: spot.x + (Math.random() - 0.5) * 40, y: spot.y + (Math.random() - 0.5) * 40 };
      ped.waitTimer = 600;
    }
    if (ped.target) {
      const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * ped.speed * dt;
      const ny = ped.y + Math.sin(a) * ped.speed * dt;
      const res = collideWorld(state, nx, ny, 10);
      ped.x = res.x;
      ped.y = res.y;
    }
  }
}

export function updatePolice(state, dt, now) {
  const p = state.player;
  if (!p.alive) return;
  // Spawn police cars up to the wanted level's quota.
  const wantCars = WANTED.chaseCars[p.wanted] || 0;
  const haveCars = state.cars.filter((c) => c.kind === 'police').length;
  if (haveCars < wantCars && now - (state.lastPoliceSpawn || 0) > 1400) {
    state.lastPoliceSpawn = now;
    const angle = Math.random() * Math.PI * 2;
    const r = 620;
    const sx = clamp(p.x + Math.cos(angle) * r, 60, WORLD.width - 60);
    const sy = clamp(p.y + Math.sin(angle) * r, 60, WORLD.height - 60);
    const near = nearestRoadPoint(sx, sy);
    const car = makePoliceCar(near ? near.x : sx, near ? near.y : sy, angleTo(sx, sy, p.x, p.y));
    state.cars.push(car);
  }
  // Foot officers at higher heat.
  const wantCops = WANTED.footCops[p.wanted] || 0;
  if (state.cops.length < wantCops && now - (state.lastCopSpawn || 0) > 2200) {
    state.lastCopSpawn = now;
    const angle = Math.random() * Math.PI * 2;
    state.cops.push(makeCop(
      clamp(p.x + Math.cos(angle) * 320, 40, WORLD.width - 40),
      clamp(p.y + Math.sin(angle) * 320, 40, WORLD.height - 40),
    ));
  }
  // Despawn police when the heat is gone.
  if (p.wanted === 0) {
    for (const car of state.cars) {
      if (car.kind === 'police') car.kind = 'traffic';
    }
    state.cops.length = 0;
    state.sounds.siren(false);
    return;
  }
  state.sounds.siren(true);

  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const want = angleTo(car.x, car.y, p.x, p.y);
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -0.07 * dt, 0.07 * dt);
    const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
    const targetSpeed = d > 90 ? car.model.max * 0.95 : car.model.max * 0.55;
    car.speed += (targetSpeed - car.speed) * 0.03 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const prevX = car.x;
    const prevY = car.y;
    car.x = clamp(nx, 24, WORLD.width - 24);
    car.y = clamp(ny, 24, WORLD.height - 24);
    if (carHitsBuilding(state, car)) {
      car.x = prevX;
      car.y = prevY;
      car.angle += 0.6;
      car.speed *= 0.4;
    }
    // Ram the player: on foot it hurts, in a car it shoves.
    if (d < 46) {
      if (p.car) {
        p.car.x += Math.cos(car.angle) * 6;
        p.car.y += Math.sin(car.angle) * 6;
        state.shake = Math.max(state.shake, 5);
        if (Math.random() < 0.02) state.sounds.crash();
      } else if (now - p.invulnUntil > 0 || true) {
        if (now > p.invulnUntil) {
          p.health -= 6;
          p.invulnUntil = now + 700;
          state.shake = Math.max(state.shake, 6);
          state.floaters.push({ x: p.x, y: p.y - 24, text: '-6 HP', color: '#ff5e5e', t: 50 });
          if (p.health <= 0) state.missionHook('playerDown');
        }
      }
    }
  }

  for (const cop of state.cops) {
    const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = want;
    if (d > 260) {
      const nx = cop.x + Math.cos(want) * cop.speed * dt;
      const ny = cop.y + Math.sin(want) * cop.speed * dt;
      const res = collideWorld(state, nx, ny, 11);
      cop.x = res.x;
      cop.y = res.y;
    } else {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 55 + Math.random() * 55;
        state.bullets.push(makeBullet(cop.x, cop.y, want + (Math.random() - 0.5) * 0.22, false));
        state.sounds.enemyShoot();
      }
    }
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    const want = angleTo(e.x, e.y, p.x, p.y);
    e.angle = want;
    if (d > 300) {
      const nx = e.x + Math.cos(want) * e.speed * dt;
      const ny = e.y + Math.sin(want) * e.speed * dt;
      const res = collideWorld(state, nx, ny, 11);
      e.x = res.x;
      e.y = res.y;
    } else if (d < 480) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 70 + Math.random() * 70;
        state.bullets.push(makeBullet(e.x, e.y, want + (Math.random() - 0.5) * 0.18, false));
        state.sounds.enemyShoot();
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.health > 0);
}

export function updateBullets(state, dt, now) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Hit a building.
    for (const rect of state.city.colliders) {
      if (b.x >= rect.x && b.x <= rect.x + rect.w && b.y >= rect.y && b.y <= rect.y + rect.h) {
        b.life = 0;
        state.sparks.push({ x: b.x, y: b.y, t: 8 });
        break;
      }
    }
    if (b.life <= 0) continue;
    if (b.fromPlayer) {
      for (const e of state.enemies) {
        if (e.health > 0 && dist2(b.x, b.y, e.x, e.y) < 16 * 16) {
          e.health -= b.damage;
          b.life = 0;
          state.sparks.push({ x: b.x, y: b.y, t: 8 });
          if (e.health <= 0) {
            state.floaters.push({ x: e.x, y: e.y - 20, text: 'Target down', color: '#ffe14d', t: 60 });
            state.missionHook('enemyDown', e);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of state.cops) {
        if (dist2(b.x, b.y, cop.x, cop.y) < 16 * 16) {
          cop.health -= b.damage;
          b.life = 0;
          state.sparks.push({ x: b.x, y: b.y, t: 8 });
          if (cop.health <= 0) {
            state.cops.splice(state.cops.indexOf(cop), 1);
            addWanted(state, 1);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const ca = Math.cos(-car.angle);
        const sa = Math.sin(-car.angle);
        const lx = dx * ca - dy * sa;
        const ly = dx * sa + dy * ca;
        if (Math.abs(lx) < 34 && Math.abs(ly) < 17) {
          car.hp -= b.damage;
          b.life = 0;
          state.sparks.push({ x: b.x, y: b.y, t: 8 });
          if (car.hp <= 0) {
            state.explosions.push({ x: car.x, y: car.y, t: 40, r: 10 });
            state.sounds.crash();
            state.shake = 10;
            car.kind = 'parked';
            car.speed = 0;
            addWanted(state, 1);
            scareNearbyPeds(state, car.x, car.y, 420);
          }
          break;
        }
      }
    } else if (p.alive && now > p.invulnUntil) {
      const radius = p.car ? 30 : 14;
      if (dist2(b.x, b.y, p.x, p.y) < radius * radius) {
        p.health -= b.damage;
        b.life = 0;
        p.invulnUntil = now + 350;
        state.shake = Math.max(state.shake, 4);
        if (p.health <= 0) state.missionHook('playerDown');
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
}
