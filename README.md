[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Absaa00/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Absaa00/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01)

# Azura Bay — Getaway

An original open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). No assets, names, characters, map, art or music from any commercial game — the city, the people and the story are invented here.

**Nia Reyes**, getaway driver of Azura Bay, takes one last job from fixer **Oz Bell** — and **Dante Kroll** and his crew are not letting her walk away. Five story missions run from a first fare at Oz's Garage to a final run against Kroll Tower, then the city opens into free roam: taxi fares, hidden packages, and the whole coast to steal.

## What is in the game

- A sun-soaked coastal city to explore on foot and by car: six districts, a neon strip, a university, a beach and a harbor, all generated from one seed
- Traffic and pedestrians, parked cars to steal, six car models from the Pipit to the Marlin S
- A wanted level (0–5 stars) with police cars and foot officers who chase, ram and shoot — and heat that cools off if you stay out of sight
- Five story missions plus taxi fares and hidden packages, with cash, health and ammo pickups
- Combat on foot (mouse aim, pistol, reload), car chases, crashes and explosions
- HUD with wanted stars, health, cash, ammo, mission objective, speedometer and a live minimap
- Title screen, pause, game-over screen and a save file (localStorage) that keeps cash, missions and position
- Synthesized sound: engine hum, sirens, gunfire, crashes and a sunset groove — all made with the Web Audio API, no audio files

## How to play

Serve the game folder with any static server — `node serve.ts`, then open http://localhost:8080 — and play in desktop Chrome. No network request is made; everything runs from local files.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim, shoot |
| E | Enter / steal the nearest car |
| Shift | Sprint |
| Space | Handbrake |
| P | Pause |
| M | Mute |
| S (while paused) | Save |
| R (paused / game over) | Restart from save |

`?seed=N` in the URL picks a different city layout. `?shot=chase|drive|mission|start` opens a staged scene used for the screenshots.

## Layout

- `game/index.html` — the page
- `game/src/main.js` — game loop, screens, camera, save/load
- `game/src/render.js` — canvas drawing: city, actors, HUD, minimap, menus
- `game/src/world.js` — seeded city generation and collision
- `game/src/entities.js` — player, cars, traffic, pedestrians, police, bullets
- `game/src/missions.js` — the five story missions, taxi fares
- `game/src/config.js` — world, vehicle and tuning data
- `game/src/random.js` — seeded RNG and math helpers
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized sound and music
- `game/src/shots.js` — screenshot scene presets
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`

## License

MIT — see [LICENSE](LICENSE).
