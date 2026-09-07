# Quarantine Zero

An original single-player, first-person, round-based zombie survival browser game set across six sectors of Blackwater flood-control station. Built with Three.js and Vite. No Call of Duty assets, characters, logos, sounds, or maps are used.

## Play locally

Requires Node.js 20.19+ or 22.12+ and a browser with WebGL 2 / hardware acceleration.

```sh
cd /Users/npuntanee/quarantine-zero
npm install
npm run dev -- --port 5173
```

Open http://localhost:5173. On a phone on the same Wi-Fi, open the Network URL printed by Vite (during development: http://192.168.1.38:5173). The computer must stay awake and its firewall must allow the connection. Landscape is recommended. The IP may change.

```sh
npm test          # game-rule tests
npm run build    # standalone static output in dist/
npm run preview  # serve the production build locally
```

Upload the contents of `dist/` to any static HTTPS host to play remotely. This project has not been published. All models, textures, fonts and audio generation are local; no Blender connection is needed to play the built game.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD | Drag and hold anywhere on the left |
| Look | Mouse | Swipe anywhere on the right |
| Fire | Hold left mouse | Hold Fire; drag it to aim while firing |
| Aim down sights | Hold right mouse | Tap to toggle aim |
| Reload | R | Reload button |
| Buy / interact | E near a station | Use button |
| Sprint | Shift | Drag farther on the left |
| Flashlight | F | Enabled by default |
| Pause / settings | Esc, P, or Menu | Menu |

Use Settings to select touch controls manually on hybrid devices. Pointer lock requires clicking Enter/Resume on desktop. Leaving the window, switching apps or unlocking the pointer pauses the game.

## Survival and economy

- Begin with an M9, 15/105 ammunition and 500 points.
- Hits award 10 points, kills 100, and headshot kills an additional 50.
- Clear a round for 200 points and an eight-second breather. Enemy count, health and speed escalate; at most 24 enemies are active at once.
- Wall carbine: 1,200 points. Ammunition: 250 points for a complete refill of the current weapon.
- Seven independently purchasable gates connect six sectors. Enemies approach through 12 fixed breach windows, two per sector, in connected sectors only. Four repairable boards delay entry; attackers visibly grip and wrench them free. Boards split, tumble and remain on the floor; rebuilding lifts and aligns them back into the frame. Attackers brace against the window and climb through with alternating legs. Hold E / Use while facing a window to rebuild one board every 0.95 seconds, awarding 10 points up to a 120-point repair reward cap per round. Restart resets gates and boards.
- Mystery cache: 950 points. Replaces your weapon with a carbine, shotgun, SMG or box-exclusive ARC-9 (25% each), including ammo. ARC-9 chains to up to four nearby enemies, with falloff and wall occlusion.
- Vital Surge: 2,000 points; raises health to 250. Quick Hands: 1,500; halves reload time. Second Wind: 1,500; accelerates regeneration.
- Health normally regenerates after five seconds without damage. Second Wind shortens the delay to 2.5 seconds and increases the rate.
- Emergency Purge: 400 points; damages and stuns every active infected, with a 25-second cooldown.
- Infected pathfind around obstacles and through the gate. Solid geometry blocks both movement and shots. Aim for the head.
- After every five cleared rounds, choose evacuation or continuation. Evacuation gives 45 seconds to reach the marked Arrival door and board for five uninterrupted seconds within 2.5 metres. Infected pursue during the attempt. Leaving the door resets boarding; timeout returns to survival. Successful extraction banks 100 salvage per five completed rounds plus two per kill. Death loses unbanked salvage. Salvage is a local career record, not a paid currency.
- Runners appear from round 3; a slower, tougher brute leads every fifth round.
- Pause → End run / Main menu and the results → Main menu button return home without reloading.
- Preferences, highest round and banked salvage are saved only in this browser. Runs themselves are not saved.

## Graphics

PBR concrete with scanned diffuse, normal, roughness and ambient-occlusion maps; image-based lighting; directional and local lighting; flashlight and muzzle flash; sealed ceilings and cross beams; fog; film grain; ACES tone mapping; cast shadows; GTAO; bloom; and soft-edged, rippling planar puddle reflections.

| Preset | Features |
| --- | --- |
| Performance | Pixel-ratio cap 1; no shadows, rain, AO or bloom |
| Balanced | Pixel-ratio cap 1; 1K shadows and bloom |
| High | Pixel-ratio cap 1.25; 1K shadows and bloom |
| Ultra | Pixel-ratio cap 1.5; 2K shadows, spotlight shadows, GTAO, bloom and planar reflections |

Mobile defaults to Balanced, desktop to High. Ultra is intended for a capable GPU. Performance depends on GPU, resolution and wave size; mobile input was verified in browser emulation, not on physical phones.

This is a playable prototype: one connected six-sector map, an original rigged enemy with a distance-driven walk cycle, synthesized audio, and five distinct original weapon meshes. It is not a AAA photorealistic asset pack or multiplayer game. There is no jumping, weapon inventory, matchmaking or persistent run save.

## Expanded map

| Sector | Landmarks and rewards |
| --- | --- |
| Arrival Yard | Supply crates, emergency purge, AR-41 carbine, Quick Hands |
| Containment | Holding pens, mystery cache, two service shortcuts |
| Pump Hall | Blender-built pump skids, overhead pipes, Breacher shotgun |
| Foundry | Blender-built generators, furnace, Vector SMG |
| Medical Lab | Blender-built treatment beds, IV stands, Vital Surge, ammo |
| Relay Station | Blender-built relay mast, consoles, Second Wind, ammo |

Yard → Containment costs 1,000; Yard → Pump and Yard → Foundry cost 1,250 each; Pump → Medical and Foundry → Relay cost 1,500 each. Containment → Medical and Containment → Relay are 750-point service shortcuts. The HUD schematic shows the current sector, accessible sectors, the player's position and opened routes. The topology in `src/map.js` drives the walls/gates, purchases, navigation and spawning.

## Rebuilt weapons and machines

`scripts/build_station_assets.py` authors and exports five weapons (`weapon-pistol`, `weapon-carbine`, `weapon-shotgun`, `weapon-smg`, `weapon-arc`), three perk machines (`perk-vital`, `perk-speed`, `perk-regen`) and five environment modules (`map-pump`, `map-generator`, `map-medbay`, `map-gate-frame`, `map-relay`). All are original Blender geometry, with editable `.blend` sources in `art/` and game-ready GLBs in `public/assets/`.

Perk cabinets have rounded enamel bodies, analogue gauges, buttons, coin slots, dose dispensers, ventilation and service hoses. The map uses the original Blender modules as physical landmarks; its floor/wall layout is assembled in Three.js from the shared topology.

All five guns have authored `sight_rear`, `sight_front` and `muzzle` markers. At settled ADS, the rear notch and front-post tip project to the exact aim point; receiver/rail geometry remains below it. Bullets use that same center line (shotguns retain pellet spread), ADS removes hip-fire sway, and shoulder stocks remain visible in wall displays but are excluded from the first-person view to prevent near-camera obstruction.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build_station_assets.py
```

`scripts/expanded-check.mjs` verifies all seven gate purchases and collision transitions, navigation into all six sectors, five sight alignments and clear lines of sight, and the three perk-machine purchases. It captures representative ADS and sector screenshots under `art/`.

## Blender asset workflow

The connected Blender MCP server executed `scripts/generate_assets.py` for the original pistol, carbine, supply crate, barrel and an initial placeholder enemy. The original `infected-sculpted.glb` was authored through Blender with `scripts/sculpt_infected.py` and `scripts/rig_infected.py`. The game now loads its optimized derivative `infected-runtime.glb`, exported by `scripts/optimize_infected.py`. No third-party character model or character texture is used.

The replacement includes a shaped continuous head mesh, orbital recesses, eyelids, ears, nostrils, individual damaged teeth, scars, articulated anatomy, a worn station uniform, utility equipment and laced boots. Its skin/fabric diffuse and normal maps are generated from original procedural noise. The retained sculpt source has approximately 91,000 triangles and 15 materials. The runtime derivative has 18,128 triangles, five material groups and 17 deform bones. The export also welds the forehead/neck seams, reprojects facial UVs and narrows the fixed open-mouth expression. Blender exports a new 1.2-second gait with opposed leg strides, knee flexion, ankle motion and restrained torso motion. Playback follows actual travel; whole-body rocking is removed. Enemy instances have independent skeletons and mixers and are reused from a bounded pool.

- Editable studio scene: `art/blackwater-infected.blend`
- Studio render: `art/infected-full.png`
- In-game inspection: `art/infected-ingame.png`

Regenerate the character from the project directory (existing user geometry is preserved in a separate scene):

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/sculpt_infected.py --python scripts/rig_infected.py
```

The character build writes its GLB and editable `.blend` file. To regenerate the studio PNG, render the camera in the saved studio scene. The original prototype enemy remains as `infected.glb` for comparison but is not loaded by the game.

Regenerate the original props and weapons from the project directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/generate_assets.py
```

Or execute through Blender MCP:

```python
path = '/Users/npuntanee/quarantine-zero/scripts/generate_assets.py'
exec(compile(open(path).read(), path, 'exec'), {'__file__': path})
```

The Poly Haven material was searched and downloaded through Blender MCP, then its packed 1K JPEG maps were exported into `public/assets/`.

## Credits and references

- Original game, procedural models, interface, environment composition and synthesized sounds created for this project.
- [Concrete Floor Worn 001 — Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001), CC0 scanned material.
- [Three.js](https://threejs.org/) (MIT), including [GTAOPass](https://threejs.org/docs/pages/GTAOPass.html), [UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html), and Reflector.
- Barlow and Barlow Condensed, bundled via Fontsource under the SIL Open Font License.

## Verification

`npm test` covers economy invariants, gate/perk duplicate purchases, mystery-cache outcomes, safe regeneration, ammunition conservation, purge cooldown, escalation and collision boundaries.

`scripts/browser-check.mjs` connects to an isolated browser session's CDP URL. It uses development-only state access to arrange reproducible combat scenarios, then verifies actual game raycasts, progression, purchase effects, keyboard input, simultaneous touch pointers and Ultra rendering. The `window.__qz` diagnostic handle is excluded from production builds.

```sh
./node_modules/.bin/agent-browser --session qz open http://localhost:5173
./node_modules/.bin/agent-browser --session qz get cdp-url
node scripts/browser-check.mjs '<CDP URL printed above>'
```

## Performance and regression verification (September 2026)

Combat uses analytic head/body hit volumes and obstacle slabs instead of raycasting animated sculpt triangles. Shotgun pellet damage is aggregated per enemy, hit audio is coalesced, and transient effects are capped at 40. Static structure/prop geometry is merged per material and sector, and four nearby local lights replace the unbounded scene-wide local light set. Indoor rain is disabled. High no longer runs GTAO.

`npm test` covers combat occlusion, headshots, repairs, economy, progression and map topology. With the dev server running, `node scripts/revision-check.mjs` launches installed Chrome and verifies actual game methods plus real touch input, all gates/windows, break-in, pursuit, ARC chaining, extraction/continuation/timeout and menu reset. It saves evidence in `art/revision-check.json` and `art/revision-*.png`. `node scripts/performance-check.mjs` measures six seconds of High at 1440×900 (pixel ratio 1.25), with 24 enemies and shotgun fire, using Chrome Metal; results are in `art/performance-check.json`.

The initial 24-enemy lined-up shotgun stress test took 1.75–2.25 seconds per shot with triangle raycasts. After the change, a 30-shot browser run measured a 1.2 ms p95 (4.6 ms cold maximum). This is CPU shot-processing time, not a claim of equivalent improvement in overall FPS. A separate six-second Chrome Metal test on Apple M2 averaged 55–60 FPS across two runs with 24 active enemies and continuous shotgun fire at High, 1440×900, capped pixel ratio 1.25 (latest median frame 16.7 ms, p95 17.8 ms). Device resolution, GPU backend, thermals and browser all affect sustained frame rate.

Rebuild the optimized Blender source/export:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -t 2 -P scripts/optimize_infected.py
```

The original high-detail sculpt remains in `art/blackwater-infected.blend`; the optimized editable source is `art/blackwater-infected-runtime.blend`.

## Barricade and horde action revision

- Hold E (desktop) or Use (touch) while facing a damaged window to rebuild boards 1→2→3→4. The HUD shows per-board progress. Release, turn away, move out of reach, fire, reload or pause to cancel the unfinished board. Only completed boards earn points.
- Board pulls, break contact and repair share a per-window reservation so simultaneous enemies and repairs cannot duplicate or lose boards. Broken pieces reuse the existing board geometry; debris never accumulates without a bound.
- Zombies have skeletal reach/pull, supported climb and alternating melee swipe actions. Damage occurs once at the swipe contact, with a fresh range, facing and wall check. Moving away can dodge the swing; stun interrupts it. Entering zombies cannot attack through the barricade.
- Arrival has opposing breach windows, so early-round attacks can approach from both front and rear. The interior window retains a solid sill and does not bypass the purchasable gate.
- Pursuit combines individual flank targets, periodic decisions, neighbour separation, passing behaviour and smoothed velocity. The shared navigation field remains for obstacle routing, with segment sweeps to prevent corner cutting. Narrow doorways still constrain movement naturally.
- `node scripts/actions-check.mjs` verifies real keyboard and touch holds, board motion, cancellation, break/climb sequence, articulated attacks, damage timing, dodging, stun and horde spreading. Evidence is saved in `art/actions-check.json` and `art/action-*.png`.

## Mobile gesture layout

The visible joysticks are replaced by two large touch areas. A left-side drag sets movement direction and speed; hold the displaced finger to keep moving, drag farther to sprint, and release to stop. Right-side swipes turn the camera by finger displacement; resting the finger does not continue turning. A gesture retains its original side when crossing the screen. Fire supports simultaneous drag-to-aim, so movement and aimed shooting work with two thumbs. Aim stays a toggle; Reload and Use remain buttons, and holding Use rebuilds windows.

The HUD uses separate portrait and landscape layouts, safe-area insets, and buttons at least 54 pixels wide. Short-screen menus scroll. `node scripts/mobile-check.mjs` verifies simultaneous gestures, cancellation, pause/reset, firing while aiming, five phone viewport sizes (360×640 through 932×430), and menu reachability. Screenshots and measurements are in `art/mobile-*.png` and `art/mobile-check.json`. Tests use touch emulation in Chrome; physical phone testing is still separate.
