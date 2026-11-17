// City generation for Azura Bay. A seeded generator lays out the road grid, the
// buildings inside each block, parks, the beach and street props, and records the
// collision boxes the physics code uses. Same seed, same city.
// SPDX-License-Identifier: MIT

import { WORLD, ROAD_X, ROAD_Y, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function onRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of ROAD_X) if (Math.abs(x - rx) < half) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const colliders = [];
  const carSpawns = [];
  const pedSpawns = [];

  const blockColors = ['#b98a5e', '#8fa3b8', '#c9a86a', '#a87f6d', '#7d8ba0', '#b56a5e', '#6a8f7d', '#9a7fb0'];
  const roofColors = ['#5e4a3a', '#3f4a5a', '#6b4a4a', '#44503f'];

  // One block per cell between neighbouring roads.
  const xs = [0, ...ROAD_X, WORLD.width];
  const ys = [0, ...ROAD_Y, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx0 = xs[bi] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const bx1 = xs[bi + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      const by0 = ys[bj] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const by1 = ys[bj + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      // The strip below the last road is the beach, not blocks.
      if (by0 >= WORLD.beachTop) continue;
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      const district = districtAt(cx, cy);
      if (rng.chance(0.16)) {
        // Park block: grass, trees, a pond or a court.
        const park = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, pond: rng.chance(0.4) };
        parks.push(park);
        const treeCount = Math.floor(rng.range(6, 14));
        for (let t = 0; t < treeCount; t++) {
          trees.push({
            x: rng.range(bx0 + 14, bx1 - 14),
            y: rng.range(by0 + 14, by1 - 14),
            r: rng.range(9, 15),
            shade: rng.pick(['#3f7d44', '#4c8a3f', '#5a9a4a']),
          });
        }
        continue;
      }
      // Buildings: 1 to 4 per block, in a loose grid.
      const cols = (bx1 - bx0) > 260 ? 2 : 1;
      const rows = (by1 - by0) > 260 ? 2 : 1;
      const cellW = (bx1 - bx0) / cols;
      const cellH = (by1 - by0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.12)) continue; // empty lot: a parking patch
          const w = rng.range(cellW * 0.55, cellW * 0.85);
          const h = rng.range(cellH * 0.55, cellH * 0.85);
          const x = bx0 + c * cellW + (cellW - w) / 2 + rng.range(-8, 8);
          const y = by0 + r * cellH + (cellH - h) / 2 + rng.range(-8, 8);
          const tall = district.name === 'Neon Row' || district.name === 'Palm Heights';
          const building = {
            x, y, w, h,
            color: rng.pick(blockColors),
            roof: rng.pick(roofColors),
            floors: tall ? rng.int(4, 9) : rng.int(1, 4),
            neon: district.name === 'Neon Row' && rng.chance(0.6),
            neonColor: rng.pick(['#ff5ea8', '#3fd2ff', '#ffe14d', '#7dff5e']),
            windowsX: Math.max(2, Math.floor(w / 34)),
            windowsY: Math.max(2, Math.floor(h / 34)),
          };
          buildings.push(building);
          colliders.push({ x, y, w, h });
        }
      }
      // Street trees along the block edges.
      const edgeTrees = rng.int(2, 5);
      for (let t = 0; t < edgeTrees; t++) {
        trees.push({
          x: rng.range(bx0, bx1),
          y: rng.chance(0.5) ? by0 + 8 : by1 - 8,
          r: rng.range(8, 12),
          shade: rng.pick(['#3f7d44', '#4c8a3f']),
        });
      }
    }
  }

  // Lamps along every road, alternating sides.
  for (const rx of ROAD_X) {
    for (let y = 60; y < WORLD.height - 40; y += 260) {
      lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y, side: 1 });
      lamps.push({ x: rx - WORLD.roadWidth / 2 - 8, y: y + 130, side: -1 });
    }
  }
  for (const ry of ROAD_Y) {
    for (let x = 60; x < WORLD.width - 40; x += 260) {
      lamps.push({ x: x + 130, y: ry + WORLD.roadWidth / 2 + 8, side: 1 });
    }
  }

  // Parked cars along road edges.
  for (const rx of ROAD_X) {
    for (let y = 180; y < WORLD.height - 120; y += 340) {
      if (rng.chance(0.55)) {
        carSpawns.push({ x: rx + WORLD.roadWidth / 2 - 16, y, angle: Math.PI / 2, parked: true });
      }
    }
  }
  for (const ry of ROAD_Y) {
    for (let x = 180; x < WORLD.width - 120; x += 380) {
      if (rng.chance(0.45)) {
        carSpawns.push({ x, y: ry + WORLD.roadWidth / 2 - 16, angle: 0, parked: true });
      }
    }
  }

  // Pedestrian spawn points on sidewalks.
  for (let i = 0; i < 160; i++) {
    const rx = rng.pick(ROAD_X);
    const ry = rng.pick(ROAD_Y);
    if (rng.chance(0.5)) {
      pedSpawns.push({ x: rx + WORLD.roadWidth / 2 + WORLD.sidewalk / 2, y: rng.range(40, WORLD.height - 40) });
    } else {
      pedSpawns.push({ x: rng.range(40, WORLD.width - 40), y: ry + WORLD.roadWidth / 2 + WORLD.sidewalk / 2 });
    }
  }

  // Landmarks the story uses, placed on roads so missions can reach them.
  const landmarks = {
    safehouse: { x: 700, y: 1300, label: 'Safehouse' },
    garage: { x: 1500, y: 600, label: "Oz's Garage" },
    docks: { x: 300, y: 1650, label: 'Old Harbor Docks' },
    neonPlaza: { x: 1500, y: 250, label: 'Neon Plaza' },
    university: { x: 1100, y: 950, label: 'Coral University' },
    beach: { x: 2300, y: 2350, label: 'Sunset Beach' },
    bank: { x: 2300, y: 950, label: 'Azura Bay Bank' },
    krollTower: { x: 2700, y: 600, label: 'Kroll Tower' },
  };

  return {
    seed, buildings, trees, lamps, parks, colliders, carSpawns, pedSpawns, landmarks,
    bounds: { w: WORLD.width, h: WORLD.height },
  };
}

export function collideCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function resolveCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x: cx, y: cy, hit: false };
  if (d2 === 0) {
    // Centre inside the rect: push out along the smallest penetration axis.
    const left = cx - rect.x;
    const right = rect.x + rect.w - cx;
    const top = cy - rect.y;
    const bottom = rect.y + rect.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: rect.x - r, y: cy, hit: true };
    if (m === right) return { x: rect.x + rect.w + r, y: cy, hit: true };
    if (m === top) return { x: cx, y: rect.y - r, hit: true };
    return { x: cx, y: rect.y + rect.h + r, hit: true };
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  return { x: nx + dx * r, y: ny + dy * r, hit: true };
}
