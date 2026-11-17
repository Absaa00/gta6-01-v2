// Story missions for Azura Bay. Five jobs take Nia Reyes from a first fare for Oz
// Bell to a final run against Dante Kroll's crew, then the city opens into free
// roam with taxi fares and hidden packages. All names and places are invented.
// SPDX-License-Identifier: MIT

import { makeCar, makeEnemy, addWanted } from './entities.js';
import { dist2 } from './random.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    briefing: "Oz Bell needs a driver he can trust. Pick up his Coral GT at the garage, then collect the client waiting at Neon Plaza.",
    reward: 300,
    steps: [
      { type: 'goto', text: "Head to Oz's Garage", target: { x: 1500, y: 600, label: "Oz's Garage" } },
      { type: 'enterCar', text: 'Get in the Coral GT', target: { x: 1500, y: 600, label: "Oz's Garage" } },
      { type: 'goto', text: 'Drive to Neon Plaza and pick up the client', target: { x: 1500, y: 250, label: 'Neon Plaza' }, inCar: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: "A Marlin S is parked up in Palm Heights with the keys in it. Take it, and bring it to Oz's garage. The owner may call it in — drive clean.",
    reward: 500,
    steps: [
      { type: 'goto', text: 'Find the Marlin S in Palm Heights', target: { x: 2300, y: 1300, label: 'Marlin S' } },
      { type: 'stealCar', text: 'Steal the Marlin S (press E)', target: { x: 2300, y: 1300, label: 'Marlin S' } },
      { type: 'deliver', text: "Deliver the Marlin S to Oz's Garage", target: { x: 1500, y: 600, label: "Oz's Garage" }, inCar: true },
    ],
  },
  {
    id: 'harbor-heat',
    title: 'Harbor Heat',
    briefing: "Kroll's crew is unloading something at the Old Harbor Docks that was never meant to reach Azura Bay. Clear them out, then lose the heat at the safehouse.",
    reward: 800,
    steps: [
      { type: 'goto', text: 'Reach the Old Harbor Docks', target: { x: 300, y: 1650, label: 'Old Harbor Docks' } },
      { type: 'kill', text: "Clear out Kroll's crew (0/4)", target: { x: 300, y: 1650, label: 'Old Harbor Docks' }, count: 4 },
      { type: 'escape', text: 'Escape to the safehouse and lose the police', target: { x: 700, y: 1300, label: 'Safehouse' } },
    ],
  },
  {
    id: 'neon-payback',
    title: 'Neon Payback',
    briefing: "Dante Kroll's courier is running protection money through Neon Row in a black Marlin S. Stop the car — shoot it or ram it — and take the cash it drops.",
    reward: 1000,
    steps: [
      { type: 'goto', text: 'Find the courier in Neon Row', target: { x: 1900, y: 250, label: 'Neon Row' } },
      { type: 'chase', text: "Stop the courier's car", target: { x: 1900, y: 250, label: 'Courier' } },
      { type: 'collect', text: 'Grab the dropped cash', target: { x: 1900, y: 250, label: 'Dropped cash' } },
    ],
  },
  {
    id: 'bay-finale',
    title: 'Bay Finale',
    briefing: "One last job: the Kroll cash van leaves the Azura Bay Bank at dusk. Take the van, shake a three-star response, and bring it home to the safehouse. Then Azura Bay is yours.",
    reward: 2000,
    steps: [
      { type: 'goto', text: 'Reach the Azura Bay Bank', target: { x: 2300, y: 950, label: 'Azura Bay Bank' } },
      { type: 'stealCar', text: 'Steal the cash van (press E)', target: { x: 2300, y: 950, label: 'Cash van' } },
      { type: 'deliver', text: 'Bring the van to the safehouse — lose the police first', target: { x: 700, y: 1300, label: 'Safehouse' }, inCar: true, needClean: true },
    ],
  },
];

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) {
    state.mission = null;
    state.freeRoam = true;
    state.objective = 'Free roam — taxi fares and hidden packages pay. Press M for the map.';
    return;
  }
  state.mission = {
    index,
    def,
    stepIndex: 0,
    kills: 0,
    courierCar: null,
    missionCar: null,
    cashPickup: null,
    done: false,
  };
  state.objective = def.steps[0].text;
  state.storyCard = { title: def.title, text: def.briefing, t: 420 };
  state.sounds.missionDone();
  state.log.push(`Mission ${index + 1}: ${def.title}`);
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.def.steps[state.mission.stepIndex] || null;
}

function advanceStep(state) {
  const m = state.mission;
  if (!m) return;
  m.stepIndex += 1;
  const step = currentStep(state);
  if (!step) {
    completeMission(state);
    return;
  }
  state.objective = step.text;
  setupStep(state, step);
}

function setupStep(state, step) {
  const m = state.mission;
  const L = state.city.landmarks;
  if (m.def.id === 'first-fare' && step.type === 'enterCar') {
    const car = makeCar(1, 1500, 660, -Math.PI / 2, 'parked');
    car.color = '#e8b23a';
    state.cars.push(car);
    m.missionCar = car;
  }
  if (m.def.id === 'hot-wheels' && step.type === 'goto') {
    const car = makeCar(2, 2300, 1300, Math.PI / 2, 'parked');
    car.color = '#b23a48';
    state.cars.push(car);
    m.missionCar = car;
  }
  if (m.def.id === 'harbor-heat' && step.type === 'kill') {
    const spots = [[260, 1600], [360, 1700], [300, 1560], [380, 1620]];
    for (const [x, y] of spots) state.enemies.push(makeEnemy(x, y, 60));
    addWanted(state, 2);
    state.log.push("Kroll's crew opened fire — the police are coming too.");
  }
  if (m.def.id === 'neon-payback' && step.type === 'chase') {
    const car = makeCar(2, 1900, 250, 0, 'traffic');
    car.color = '#222831';
    car.hp = 160;
    state.cars.push(car);
    m.courierCar = car;
    car.target = { x: 2700, y: 250, vertical: false };
    car.targetTimer = 900;
  }
  if (m.def.id === 'bay-finale' && step.type === 'goto') {
    const car = makeCar(3, 2300, 1010, Math.PI / 2, 'parked');
    car.color = '#e8e4da';
    state.cars.push(car);
    m.missionCar = car;
  }
  if (m.def.id === 'bay-finale' && step.type === 'stealCar') {
    addWanted(state, 2);
  }
}

function completeMission(state) {
  const m = state.mission;
  const p = state.player;
  p.cash += m.def.reward;
  state.sounds.missionDone();
  state.storyCard = { title: `${m.def.title} — DONE`, text: `Oz wires you $${m.def.reward}. ${m.index + 1 < MISSIONS.length ? 'Next job is on the map.' : 'Azura Bay is yours now. Free roam: taxi fares, packages, and the whole city.'}`, t: 480 };
  state.log.push(`Mission complete: ${m.def.title} (+$${m.def.reward})`);
  state.missionsDone += 1;
  const next = m.index + 1;
  state.mission = null;
  setTimeout(() => {}, 0);
  startMission(state, next);
}

export function updateMission(state, dt) {
  const m = state.mission;
  const p = state.player;
  if (!m || !p.alive) return;
  const step = currentStep(state);
  if (!step) return;
  const target = step.target;
  const d = target ? Math.sqrt(dist2(p.x, p.y, target.x, target.y)) : Infinity;

  if (step.type === 'goto') {
    if (d < 70) advanceStep(state);
  } else if (step.type === 'enterCar') {
    if (p.car && m.missionCar && p.car === m.missionCar) advanceStep(state);
    else if (p.car && m.def.id === 'first-fare') advanceStep(state);
  } else if (step.type === 'stealCar') {
    if (p.car && m.missionCar && p.car === m.missionCar) advanceStep(state);
  } else if (step.type === 'deliver') {
    if (p.car && m.missionCar && p.car === m.missionCar && d < 80) {
      if (step.needClean && p.wanted > 0) {
        state.objective = 'Lose the police first, then deliver the van';
        return;
      }
      advanceStep(state);
    }
  } else if (step.type === 'kill') {
    step.text = `Clear out Kroll's crew (${m.kills}/${step.count})`;
    state.objective = step.text;
    if (m.kills >= step.count) advanceStep(state);
  } else if (step.type === 'chase') {
    const courier = m.courierCar;
    if (courier) {
      // The courier flees along Neon Row; keep its marker on it.
      step.target = { x: courier.x, y: courier.y, label: 'Courier' };
      if (courier.hp <= 60) {
        state.explosions.push({ x: courier.x, y: courier.y, t: 30, r: 8 });
        courier.speed = 0;
        courier.kind = 'parked';
        const pickup = { kind: 'cash', x: courier.x + 30, y: courier.y, amount: 400, taken: false };
        state.pickups.push(pickup);
        m.cashPickup = pickup;
        addWanted(state, 1);
        advanceStep(state);
      }
    }
  } else if (step.type === 'collect') {
    if (m.cashPickup && m.cashPickup.taken) advanceStep(state);
  } else if (step.type === 'escape') {
    if (d < 80 && p.wanted === 0) advanceStep(state);
    else if (d < 80 && p.wanted > 0) {
      state.objective = 'At the safehouse — stay out of sight until the heat fades';
    }
  }

  // Courier AI: keep fleeing from the player while the chase runs.
  if (m.courierCar && step.type === 'chase') {
    const c = m.courierCar;
    if (c.kind === 'traffic') {
      const away = Math.atan2(c.y - p.y, c.x - p.x);
      c.angle += ((away - c.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.05 * dt;
      c.speed += (c.model.max * 0.7 - c.speed) * 0.02 * dt;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = Math.max(40, Math.min(3560, c.x));
      c.y = Math.max(40, Math.min(2560, c.y));
    }
  }
}

export function missionHook(state, event, payload) {
  const p = state.player;
  if (event === 'playerDown') {
    p.alive = false;
    state.sounds.siren(false);
    state.sounds.engineStop();
    return;
  }
  if (event === 'enemyDown') {
    const m = state.mission;
    if (m && m.def.id === 'harbor-heat') m.kills += 1;
    return;
  }
  if (event === 'enterCar') {
    const m = state.mission;
    if (m && currentStep(state) && currentStep(state).type === 'enterCar') {
      // handled by updateMission
    }
    return;
  }
  if (event === 'hailTaxi') {
    if (state.taxi) return;
    const fare = payload;
    const dests = [
      { x: 1500, y: 250, label: 'Neon Plaza' },
      { x: 2300, y: 2350, label: 'Sunset Beach' },
      { x: 1100, y: 950, label: 'Coral University' },
      { x: 700, y: 1300, label: 'Safehouse' },
    ];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    fare.state = 'passenger';
    state.taxi = { fare, dest, paid: false };
    state.objective = `Taxi fare: drive to ${dest.label} ($120)`;
    state.log.push(`Taxi fare picked up — destination ${dest.label}.`);
  }
}

export function updateTaxi(state) {
  const t = state.taxi;
  if (!t) return;
  const p = state.player;
  const d = Math.sqrt(dist2(p.x, p.y, t.dest.x, t.dest.y));
  if (d < 80 && p.car) {
    p.cash += 120;
    state.sounds.cash();
    state.floaters.push({ x: p.x, y: p.y - 24, text: 'Fare paid +$120', color: '#ffe14d', t: 70 });
    state.log.push('Taxi fare complete (+$120).');
    t.fare.state = 'walk';
    t.fare.x = p.x + 40;
    t.fare.y = p.y + 40;
    t.fare.target = null;
    state.taxi = null;
    if (!state.mission) state.objective = 'Free roam — taxi fares and hidden packages pay.';
    else state.objective = currentStep(state) ? currentStep(state).text : state.objective;
  }
  // Fare cancelled if the player walks away on foot.
  if (!p.car && t.paid === false && Math.sqrt(dist2(p.x, p.y, t.fare.x, t.fare.y)) > 400) {
    // passenger is inside the car conceptually; only cancel if player abandoned the car
  }
}

export function spawnTaxiFare(state) {
  if (state.taxi) return;
  const cands = state.peds.filter((ped) => ped.state === 'walk');
  if (cands.length === 0) return;
  const ped = cands[Math.floor(Math.random() * cands.length)];
  ped.state = 'taxi';
}
