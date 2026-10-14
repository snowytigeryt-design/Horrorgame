# The Hollow Ward (co-op)

First-person horror. Find five fuses, restore the power, leave through the east door. Solo, or 2 to 4 players
in a room. Everything is one small Node server plus one HTML file.

## Run it locally

    npm install
    npm start

Open http://localhost:3000. Open it in a second window to test a room.

## Deploy on Render

1. Push this folder to a GitHub repo.
2. Render dashboard: New > Web Service > pick the repo.
3. Runtime `Node`, Build Command `npm install`, Start Command `npm start`.
4. Health Check Path `/healthz`.
5. Deploy. Render sets `PORT` for you, and WebSockets work on the same URL with no extra setup.

Or use the included `render.yaml` as a Blueprint.

### Keeping player records

NeDB stores data in two files (`players.db`, `games.db`) inside `DATA_DIR` (default `./data`).
On Render the normal filesystem is erased on every deploy and restart, so records reset.
To keep them: add a Persistent Disk (paid instances), mount it at `/var/data`, and set the environment
variable `DATA_DIR=/var/data`.

Rooms live in memory only. Run a single instance (do not scale to several), because both the rooms and the
NeDB files belong to one process. On the free plan the service sleeps after about 15 minutes idle, which
ends any open rooms.

## If something looks wrong on Render

- **Pinned to Node 22.** The original `nedb` package breaks on Node 23 and newer, so `package.json` asks for
  `22.x`. If you ever see database errors in the Render logs, check the Node version first. A maintained
  drop-in alternative is `@seald-io/nedb`.
- **The server survives a database failure.** Players can still join, start and play. Records and the
  leaderboard are just empty until the database works again. Errors are printed as `[db]` or `[uncaught]`.
- **three.js is served by the server** from the `three` package (`/vendor/three.min.js`), with the cdnjs copy
  as a fallback only. That avoids browser "Tracking Prevention" warnings about the CDN.
- A `502` for a few seconds after a deploy, or after the free plan wakes up, is Render starting the app.

## How multiplayer works

- **Player id:** the browser makes a random UUID on first visit and keeps it in localStorage. The server
  keys a player record on it (name, escapes, deaths, fuses, best time). There are no accounts. The UUID is
  the only credential, so it is never sent to other players; they get a short per-room id instead. Clearing
  site data makes you a new player.
- **Rooms:** Create room gives a 4 letter code. Quick match drops you into any open public room. Anyone can
  join a run in progress with the code.
- **Same world:** the server picks a seed when the host starts, and every browser builds the same maze,
  fuses and lockers from it.
- **Shared:** fuses (one player takes it, it is gone for everyone), the main stalker, and player positions.
  The room host's browser runs the stalker's AI and the server relays it. If the host leaves, or their tab
  goes to the background and stops updating for 4 seconds, the role passes to another player automatically.
- **Personal:** the jumpscares, crawlers, brutes and wall scares are rolled per player, so each player is
  haunted separately.
- **Death:** a caught player can "Rise again" at the entrance. Fuses already taken stay taken.
- **Quick calls:** keys 1, 2, 3 send "Over here!", "Run!", "Stay quiet...".
- **No pausing** in co-op, because the world keeps running for everyone.

## Server messages

All JSON over `/ws`. Client to server: `hello create quick join leave start p mon fuse kill died respawn
escaped say ping`. Server to client: `welcome room start p mon fuse kill died respawn escaped say left end
error pong`. Moves, fuses and escapes are checked for shape and sanity, but a determined cheater can still
lie about their own position. This is a friends game, not a competitive one.

## Endpoints

- `GET /` the game
- `GET /healthz` returns `ok`
- `GET /api/leaderboard` top 10 by escapes

## Connection drops and reconnecting

- If a player's connection drops, the server keeps their seat in the room for 60 seconds. The game client
  automatically reconnects (retrying for about 45 seconds) and picks up where it left off, including any
  fuses taken in the meantime. Only after that does the player go back to the title screen.
- Heartbeat: the server pings every 20 seconds and only drops a socket after 2 missed pings.
- If the same player id joins from a second tab while in a room, the session moves to the new tab and the
  old tab is told it was signed in elsewhere (it does not fight to reconnect).

## Level 2: Ward 9 (the maze)

Escaping through the east door no longer ends the game. You step through into **Ward 9**, a maze of living flesh where
the patients who never got out are awake, crazed, and hunting you. It is a separate level (files `public/level2a.js` to
`level2e.js`) that hooks into the main game through `window.HW`. If those files are missing, the game falls back to the
original ending.

- **Goal:** escape. The maze is new every run. Find the **three ward keys** (each is in one of the cabinets along the
  walls, spread far apart, and the arrow points at the nearest one), then run to the **rift** at the far corner. Each key
  you find echoes through the maze and brings more of them.
- **Cabinets** can also hold bandages (+40 health, and they ease the sickness), batteries, scrap metal, wire, or a nasty
  surprise. Searching is loud.
- **Side quest (optional):** with 4 scrap metal and 3 wire, hold still and press **R** to forge a blade, then **click** to
  stab. It lets you put the small ones down. You never need it to get out.
- **The crazed:** *Patients* (shamble, then sprint), *Maniacs* (fast, cackling, cleavers), *Howlers* (fast, frail, their scream
  calls everyone), *Lurchers* (huge, hit very hard). New ones keep arriving. Break line of sight and they lose you.
- **The Keeper** (boss): a clock chimes, then it sometimes manifests and hunts you. If it sees you it **mind flays**: slows
  you, drags you toward it, drains health. Break line of sight to interrupt. It can be killed with a blade; it comes back stronger.
- **Health:** you have 100, no regeneration. Bandages from cabinets are the only healing.
- **Co-op:** each player plays Ward 9 on their own copy of the level after they escape.

## Changes in this version

- **Sprint lasts about twice as long** and recovers faster, in both levels.
- **The Saint's medal (level 1):** one per run, hidden in the farthest dead end of the maze. Nothing points to it. It glows
  faintly and chimes when you are close. Take it with **E**. The next time you would die, from anything (the stalker,
  the spider, the big one, a locker), the medal burns up, you survive, and whatever had you is thrown far away. In
  co-op it only saves the player holding it.
- **The spider is a little slower**, so a clean run can outpace it.
- **Fake safety:** a calm "Game saved" icon appears in the corner. A moment after it fades, something is sprung on you
  (a creature bursts from the floor or wall in level 1, a pack lunges out of the next corridor in level 2). It happens
  a handful of times a run, never while you are already being chased or hiding.
- **Sickness (both levels), file `public/dread.js`:** it builds through the run in waves. First your view sways and
  blurs. Then you cough up blood: the screen spatters, drops hit the floor and stay there, the cough is loud (enemies hear
  it) and slows you. Paranoia adds footsteps behind you, whispers at your ear and a figure that is gone when you look.
  Past a point the lights cycle through every colour. Hiding in a locker eases it, and bandages in level 2 ease it.
  The "Reduce flashing and shake" box halves all of it and slows the colour change.
