// Canvas rendering for Azura Bay: the city, every actor, particles, the HUD with
// its minimap, and the title / pause / game-over screens. Pure drawing code — it
// reads state, never changes it.
// SPDX-License-Identifier: MIT

import { WORLD, ROAD_X, ROAD_Y, DISTRICTS, STORY, CONTROLS_TEXT, WANTED } from './config.js';
import { clamp } from './random.js';
import { districtAt } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 480 };

  function resize(w, h) {
    view.w = w;
    view.h = h;
    canvas.width = w;
    canvas.height = h;
  }

  function drawGround(state, cam) {
    const { x0, y0, x1, y1 } = cam;
    // Base ground: dry sun-baked concrete.
    ctx.fillStyle = '#a89a7c';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // District washes.
    for (const d of DISTRICTS) {
      if (d.x > x1 || d.x + d.w < x0 || d.y > y1 || d.y + d.h < y0) continue;
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = d.tint;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.globalAlpha = 1;
    }
    // Beach sand and the sea along the south edge.
    if (y1 > WORLD.beachTop) {
      ctx.fillStyle = '#e8c878';
      ctx.fillRect(x0, Math.max(y0, WORLD.beachTop), x1 - x0, y1 - Math.max(y0, WORLD.beachTop));
      ctx.fillStyle = '#3f8fbf';
      ctx.fillRect(x0, Math.max(y0, 2520), x1 - x0, y1 - Math.max(y0, 2520));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
        ctx.fillRect(x, 2520, 46, 4);
      }
    }
    // Parks: grass with a pond or a court.
    ctx.fillStyle = '#5a9a4a';
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      if (park.pond) {
        ctx.fillStyle = '#4a90d9';
        ctx.beginPath();
        ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, park.w / 4, park.h / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a9a4a';
      }
    }
    // Sidewalks, then asphalt, then lane dashes.
    const sw = WORLD.roadWidth / 2 + WORLD.sidewalk;
    ctx.fillStyle = '#b9b3a4';
    for (const rx of ROAD_X) ctx.fillRect(rx - sw, y0, sw * 2, y1 - y0);
    for (const ry of ROAD_Y) ctx.fillRect(x0, ry - sw, x1 - x0, sw * 2);
    ctx.fillStyle = '#33373f';
    for (const rx of ROAD_X) ctx.fillRect(rx - WORLD.roadWidth / 2, y0, WORLD.roadWidth, y1 - y0);
    for (const ry of ROAD_Y) ctx.fillRect(x0, ry - WORLD.roadWidth / 2, x1 - x0, WORLD.roadWidth);
    ctx.fillStyle = '#d8c95a';
    for (const rx of ROAD_X) {
      for (let y = Math.floor(y0 / 48) * 48; y < y1; y += 48) ctx.fillRect(rx - 2, y, 4, 24);
    }
    for (const ry of ROAD_Y) {
      for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) ctx.fillRect(x, ry - 2, 24, 4);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(240,240,230,0.75)';
    for (const rx of ROAD_X) {
      for (const ry of ROAD_Y) {
        if (rx < x0 - 60 || rx > x1 + 60 || ry < y0 - 60 || ry > y1 + 60) continue;
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(rx - WORLD.roadWidth / 2 + 6, ry + i * 11 - 3, WORLD.roadWidth - 12, 5);
        }
      }
    }
  }

  function drawBuildings(state, cam) {
    const { x0, y0, x1, y1 } = cam;
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Soft shadow to the south-east, then the block.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Roof inset.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Windows on the roof face.
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      for (let wx = 0; wx < b.windowsX; wx++) {
        for (let wy = 0; wy < b.windowsY; wy++) {
          ctx.fillRect(b.x + 10 + wx * ((b.w - 20) / b.windowsX), b.y + 10 + wy * ((b.h - 20) / b.windowsY), 7, 7);
        }
      }
      // Neon trim on Neon Row towers.
      if (b.neon) {
        ctx.strokeStyle = b.neonColor;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
      }
      // Height tag on tall towers.
      if (b.floors >= 6) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${b.floors}F`, b.x + 8, b.y + 18);
      }
    }
    // Trees and lamps.
    for (const t of state.city.trees) {
      if (t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.shade;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2c2c34';
    for (const lamp of state.city.lamps) {
      if (lamp.x < x0 - 10 || lamp.x > x1 + 10 || lamp.y < y0 - 10 || lamp.y > y1 + 10) continue;
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
    // Landmark labels on the map.
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(state.city.landmarks)) {
      const lm = state.city.landmarks[key];
      if (lm.x < x0 - 80 || lm.x > x1 + 80 || lm.y < y0 - 30 || lm.y > y1 + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(lm.label).width + 12;
      roundRect(ctx, lm.x - w / 2, lm.y - 26, w, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(lm.label, lm.x, lm.y - 14);
    }
    ctx.textAlign = 'left';
  }

  function drawCar(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -26, -13, 54, 28, 8);
    ctx.fill();
    ctx.translate(-2, -1);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -27, -14, 54, 28, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    roundRect(ctx, -8, -11, 18, 22, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(10, -10, 5, 20);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(25, -11, 3, 5);
    ctx.fillRect(25, 6, 3, 5);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-28, -11, 3, 5);
    ctx.fillRect(-28, 6, 3, 5);
    if (car.kind === 'police') {
      // Flashing light bar.
      const phase = Math.floor(time / 240) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-4, -13, 8, 5);
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-4, 8, 8, 5);
      ctx.fillStyle = '#f2f2f2';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
      ctx.textAlign = 'left';
    }
    if (car.model && car.model.name === 'Harbor Taxi') {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 4);
      ctx.textAlign = 'left';
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      roundRect(ctx, -30, -17, 60, 34, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body and head.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (opts.gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
      ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
      ctx.stroke();
    }
    if (opts.dead) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(state, cam, time) {
    drawGround(state, cam);
    drawBuildings(state, cam);
    // Pickups: health crosses, cash stacks, hidden packages.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (pk.x < cam.x0 - 30 || pk.x > cam.x1 + 30 || pk.y < cam.y0 - 30 || pk.y > cam.y1 + 30) continue;
      const bob = Math.sin(time / 300 + pk.x) * 2;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-3, -7, 6, 14);
        ctx.fillRect(-7, -3, 14, 6);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff9de2';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-8, -8, 16, 16);
      }
      ctx.restore();
    }
    // Parked and traffic cars first, police and player on top.
    for (const car of state.cars) {
      if (car.kind === 'traffic' || car.kind === 'parked') drawCar(car, false, time);
    }
    for (const car of state.cars) {
      if (car.kind === 'police') drawCar(car, false, time);
    }
    // Mission marker: a tall beam and a floating diamond over the objective.
    const target = state.missionTarget;
    if (target) {
      const pulse = 0.5 + Math.sin(time / 240) * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.25 + pulse * 0.2;
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(target.x - 3, target.y - 130, 6, 130);
      ctx.globalAlpha = 1;
      ctx.translate(target.x, target.y - 46 + Math.sin(time / 300) * 5);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.restore();
    }
    // Pedestrians, cops, enemies.
    for (const ped of state.peds) {
      if (ped.state === 'dead') {
        drawPerson(ped.x, ped.y, ped.angle, '#888', ped.skin, { dead: true });
      } else if (ped.state === 'taxi') {
        drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, {});
        ctx.fillStyle = '#ffe14d';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$ TAXI $', ped.x, ped.y - 20);
        ctx.textAlign = 'left';
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, {});
      }
    }
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#1d3557', '#f2c9a0', { gun: true });
    for (const e of state.enemies) {
      if (e.health > 0) {
        drawPerson(e.x, e.y, e.angle, '#b23a48', '#d9a06b', { gun: true });
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
        ctx.fillStyle = '#ff5e5e';
        ctx.fillRect(e.x - 14, e.y - 22, 28 * Math.max(0, e.health / 60), 4);
      }
    }
    // Player's car, then the player on foot.
    const p = state.player;
    if (p.car) drawCar(p.car, true, time);
    if (!p.car && p.alive) {
      drawPerson(p.x, p.y, p.angle, '#e05a8d', '#f2c9a0', { gun: true });
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Bullets, sparks, explosions, floaters.
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.7, b.y - b.vy * 0.7);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const s of state.sparks) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3 + s.t / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ex of state.explosions) {
      const prog = 1 - ex.t / 40;
      ctx.fillStyle = `rgba(255,${Math.floor(140 + 80 * prog)},40,${0.85 - prog * 0.5})`;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r + prog * 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(60,60,60,${0.5 - prog * 0.3})`;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y - 12, 10 + prog * 26, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.muzzle && state.muzzle.t > 0) {
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.arc(state.muzzle.x, state.muzzle.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = clamp(f.t / 40, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawMinimap(state) {
    const mw = 190;
    const mh = 138;
    const mx = 14;
    const my = view.h - mh - 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,26,0.78)';
    roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    // District washes.
    for (const d of DISTRICTS) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = d.tint;
      ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy);
      ctx.globalAlpha = 1;
    }
    // Roads.
    ctx.strokeStyle = '#cfd6de';
    ctx.lineWidth = 2;
    for (const rx of ROAD_X) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROAD_Y) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // Mission target.
    const target = state.missionTarget;
    if (target) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5b00';
      ctx.stroke();
    }
    // Police dots.
    ctx.fillStyle = '#4a90d9';
    for (const car of state.cars) {
      if (car.kind === 'police') {
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // District name above the map.
    const d = districtAt(p.x, p.y);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.name, mx, my - 8);
  }

  function drawHud(state, input) {
    const p = state.player;
    // Top-left cluster: stars, cash, health, ammo.
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,26,0.66)';
    roundRect(ctx, 12, 10, 250, 86, 10);
    ctx.fill();
    ctx.font = 'bold 22px sans-serif';
    for (let i = 0; i < WANTED.maxStars; i++) {
      ctx.fillStyle = i < p.wanted ? '#ffd21f' : 'rgba(255,255,255,0.28)';
      ctx.fillText('★', 24 + i * 26, 36);
    }
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#7dff5e';
    ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 24, 62);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(p.car ? p.car.model.name : 'On foot', 150, 62);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(24, 70, 150, 10);
    ctx.fillStyle = p.health > 35 ? '#7dff5e' : '#ff5e5e';
    ctx.fillRect(24, 70, 150 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${Math.max(0, Math.ceil(p.health))} HP`, 180, 79);
    // Ammo.
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(p.reloading > 0 ? 'RELOADING…' : `AMMO ${p.ammo}/12`, 24, 92);
    ctx.restore();

    // Objective bar, top centre.
    if (state.objective) {
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      const w = Math.min(view.w - 320, ctx.measureText(state.objective).width + 90);
      const x = (view.w - w) / 2;
      ctx.fillStyle = 'rgba(10,16,26,0.72)';
      roundRect(ctx, x, 10, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffe14d';
      ctx.textAlign = 'center';
      ctx.fillText(`◆ ${state.objective}`, view.w / 2, 30);
      ctx.restore();
    }
    // Mission counter.
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,26,0.66)';
    roundRect(ctx, view.w - 214, 10, 202, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    const missionLabel = state.mission ? `${state.mission.def.title} ${state.mission.stepIndex + 1}/${state.mission.def.steps.length}` : state.freeRoam ? 'Free roam' : 'No mission';
    ctx.fillText(`${missionLabel}  •  ${state.missionsDone}/5 done`, view.w - 24, 30);
    ctx.restore();

    // Speedometer when driving.
    if (p.car) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,16,26,0.66)';
      roundRect(ctx, view.w - 150, view.h - 64, 138, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 11)}`, view.w - 52, view.h - 28);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#9db8d9';
      ctx.fillText('mph', view.w - 24, view.h - 28);
      ctx.restore();
    }

    // Story card.
    if (state.storyCard && state.storyCard.t > 0) {
      const alpha = clamp(state.storyCard.t / 90, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      const w = Math.min(560, view.w - 80);
      const x = (view.w - w) / 2;
      const y = view.h * 0.32;
      ctx.fillStyle = 'rgba(10,16,26,0.88)';
      roundRect(ctx, x, y, w, 96, 12);
      ctx.fill();
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.storyCard.title, view.w / 2, y + 32);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      wrapText(state.storyCard.text, view.w / 2, y + 56, w - 40, 18);
      ctx.restore();
    }

    // Recent log lines, on a dark backing so they read over the road.
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const logLines = state.log.slice(-3);
    if (logLines.length > 0) {
      let maxW = 0;
      for (const line of logLines) maxW = Math.max(maxW, ctx.measureText(line).width);
      const ly0 = view.h - 170;
      ctx.fillStyle = 'rgba(10,16,26,0.55)';
      roundRect(ctx, 214, ly0 - 13, maxW + 12, logLines.length * 16 + 6, 6);
      ctx.fill();
      let ly = ly0;
      for (const line of logLines) {
        ctx.fillStyle = '#e8ecf2';
        ctx.fillText(line, 220, ly);
        ly += 16;
      }
    }
    ctx.restore();

    // Crosshair.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(input.mouseX, input.mouseY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mouseX - 13, input.mouseY);
    ctx.lineTo(input.mouseX - 5, input.mouseY);
    ctx.moveTo(input.mouseX + 5, input.mouseY);
    ctx.lineTo(input.mouseX + 13, input.mouseY);
    ctx.moveTo(input.mouseX, input.mouseY - 13);
    ctx.lineTo(input.mouseX, input.mouseY - 5);
    ctx.moveTo(input.mouseX, input.mouseY + 5);
    ctx.lineTo(input.mouseX, input.mouseY + 13);
    ctx.stroke();
    ctx.restore();

    drawMinimap(state);
  }

  function wrapText(text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (const l of lines) {
      ctx.fillText(l, cx, y);
      y += lineH;
    }
  }

  function drawTitle(state, cam) {
    drawWorld(state, cam, state.time);
    // Sunset gradient veil.
    const g = ctx.createLinearGradient(0, 0, 0, view.h);
    g.addColorStop(0, 'rgba(20,16,48,0.42)');
    g.addColorStop(0.6, 'rgba(224,90,141,0.22)');
    g.addColorStop(1, 'rgba(10,10,26,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(STORY.title, view.w / 2, 130);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic bold 28px sans-serif';
    ctx.fillText(STORY.subtitle, view.w / 2, 168);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(`${STORY.hero}, ${STORY.heroJob} of Azura Bay, takes one last job from fixer ${STORY.fixer} —`, view.w / 2, 200);
    ctx.fillText(`and ${STORY.villain} and ${STORY.gang} are not letting her walk away.`, view.w / 2, 220);
    const blink = Math.floor(state.time / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('PRESS ENTER TO START', view.w / 2, 272);
    }
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#dfe6ee';
    const saveNote = state.save ? `Save found: ${state.save.missionsDone}/5 missions, $${state.save.cash} — press C to continue` : 'No save yet — your progress saves after every mission.';
    ctx.fillText(saveNote, view.w / 2, 306);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#b9c4d4';
    for (let i = 0; i < CONTROLS_TEXT.length; i++) {
      ctx.fillText(CONTROLS_TEXT[i], view.w / 2, 338 + i * 20);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif';
    ctx.fillText('An original game. No assets, names or music from any commercial game. Built for make.fun — gta6-01.', view.w / 2, view.h - 18);
    ctx.textAlign = 'left';
  }

  function drawPause(state) {
    ctx.fillStyle = 'rgba(8,10,20,0.72)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 40);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#dfe6ee';
    ctx.fillText('P resume   •   S save   •   M mute   •   R restart from save', view.w / 2, view.h / 2);
    ctx.fillText(`Missions done: ${state.missionsDone}/5   •   Cash: $${state.player.cash}   •   Packages: ${state.packages}`, view.w / 2, view.h / 2 + 28);
    ctx.textAlign = 'left';
  }

  function drawGameOver(state) {
    ctx.fillStyle = 'rgba(20,4,8,0.78)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5e5e';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('BUSTED', view.w / 2, view.h / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Nia is down. The Azura Bay police tow the car and the story ends here — for now.', view.w / 2, view.h / 2 + 8);
    ctx.fillText(`Missions done: ${state.missionsDone}/5   •   Cash kept: $${state.player.cash}`, view.w / 2, view.h / 2 + 36);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Press R to restart from your last save', view.w / 2, view.h / 2 + 74);
    ctx.textAlign = 'left';
  }

  function render(state, cam, input) {
    ctx.save();
    ctx.clearRect(0, 0, view.w, view.h);
    // Camera shake.
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    if (state.screen === 'title') {
      drawTitle(state, cam);
    } else if (state.screen === 'play') {
      ctx.save();
      ctx.translate(-cam.x0 + shx, -cam.y0 + shy);
      drawWorld(state, cam, state.time);
      ctx.restore();
      drawHud(state, input);
    } else if (state.screen === 'pause') {
      ctx.save();
      ctx.translate(-cam.x0 + shx, -cam.y0 + shy);
      drawWorld(state, cam, state.time);
      ctx.restore();
      drawHud(state, input);
      drawPause(state);
    } else if (state.screen === 'over') {
      ctx.save();
      ctx.translate(-cam.x0, -cam.y0);
      drawWorld(state, cam, state.time);
      ctx.restore();
      drawGameOver(state);
    }
    // Wanted flash at the screen edges when the heat rises.
    if (state.hudFlash > 0 && state.screen === 'play') {
      ctx.fillStyle = `rgba(255,45,45,${state.hudFlash / 30 * 0.16})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    ctx.restore();
  }

  return { resize, render };
}
