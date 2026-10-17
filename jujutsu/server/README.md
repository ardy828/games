# Jujutsu Arena public server

This folder is the game's public server: a small Cloudflare Worker (`worker.js`) with one Durable
Object per public room (`pub-1` to `pub-4`, 8 players each). It does not run the match. The match runs
in one player's browser, as in a private party, and the server only relays messages between the
players. When that player leaves, or their tab stops answering for 3 seconds, the server hands the room
to the next player, so a room lives as long as anyone is in it.

The game finds the server through the `SERVER` constant near the top of the multiplayer section in
`../index.html`. While it is empty, PLAY ONLINE says the server is not set up yet. Private parties
(PeerJS) work without it.

## Deploy from GitHub (no terminal needed)

1. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and open **Workers & Pages**.
   If you have never made a Worker, Cloudflare asks you to pick your `workers.dev` subdomain first.
2. Click **Create**, then **Import a repository** (it may be called *Connect to Git*), and connect
   GitHub if asked. Pick the `ardy828/games` repository.
3. Set these, then click **Deploy**:
   - **Project name:** `jujutsu-arena` (it must match `name` in `wrangler.toml`)
   - **Production branch:** `main`
   - **Root directory** (under *Advanced* / *Build settings*): `jujutsu/server`
   - **Build command:** leave empty
   - **Deploy command:** `npx wrangler deploy` (the default)
4. When it finishes, the Worker's address is shown, like
   `https://jujutsu-arena.YOUR-SUBDOMAIN.workers.dev`. Opening it in a browser should say
   *Jujutsu Arena server is up.*
5. Put that address in `SERVER` in `../index.html` (or send it to whoever maintains the game), and
   push. PLAY ONLINE then connects.

From then on Cloudflare redeploys the server by itself whenever a push to `main` changes it. To stop
it rebuilding for changes elsewhere in the repository, set **Settings → Build → Build watch paths**
to `jujutsu/server/*`.

If you would rather use a terminal: install Node, then in this folder run `npx wrangler login` and
`npx wrangler deploy`.

## The admin page

`/admin` on the server (e.g. `https://jujutsu-arena.NAME.workers.dev/admin`) is a control panel for
the public rooms:

- **Who's on**: every room's players, who is hosting, the scoreboard and the round clock, updated every
  few seconds, with a button to kick someone.
- **Rules** for every public room: rounds on or off (off is one endless free-for-all), points to win,
  round time limit, break between rounds, respawn time, how many cursed spirits roam each room and
  how good they are, damage, health, speed, cooldown and ultimate-charge multipliers, which fighters
  can be picked, and whether ultimates work at all. A few presets (Chaos, Tanks, Curse swarm…) fill them
  in. Private parties and practice keep their usual rules.
- **Broadcast**: a message shown as a banner in every room, or in one.
- **Events**: heal everyone, fill every ultimate, reset every cooldown, drop a wild Mahoraga that
  attacks anyone until it is killed, end the round now, restart the round.

It needs a password, which you set once in Cloudflare:

1. In the Cloudflare dashboard, open **Workers & Pages → jujutsu-arena → Settings → Variables and
   Secrets**.
2. Click **Add**, choose type **Secret**, name it `ADMIN_KEY`, and give it a long password only you
   know. Click **Deploy** (or **Save**).
3. Open `/admin` on the server and type that password. The browser remembers it until you press
   LOG OUT.

The secret stays when the server redeploys from GitHub. Until it is set, the admin page says so and
does nothing.

Add the secret only once the latest build has finished (its **Deployments** entry says Ready).
Adding it makes a new version from what is live at that moment, so doing it mid-build can put older
code back. If `/admin` just says "server is up", the live version is older than the code: open
**Deployments**, find the newest entry that says **Build**, and deploy it from its menu, or push any
change to `jujutsu/server/` to build again.

## Allowed sites

`ALLOWED_ORIGINS` in `wrangler.toml` lists the sites the game may connect from. It is `"*"`, so the
game works wherever it is hosted. To stop other websites from using your rooms, replace it with a
comma-separated list, e.g. `"https://ardy828.github.io,https://*.ardychan828.workers.dev"` (a `*`
inside an address stands for any subdomain). `localhost` is always allowed, for testing.

## Checking it

The server's main address says which version of the code is live (`VERSION` in `worker.js`, bumped
with each change), and where the admin page is.

Open `/check` on the server (e.g. `https://jujutsu-arena.NAME.workers.dev/check`). It answers with
`"up": true`, the `"version"`, whether the rooms work (`"rooms": {"players": …}`, or an `"error"`), and whether the
page asking would be let in. The game asks the same thing when it cannot join a room and shows the
answer under the menu buttons.

## Free plan limits

Durable Objects are on the free Workers plan with the SQLite backend, which `wrangler.toml` uses.
The free plan allows 100,000 requests a day, and every 20 WebSocket messages the server receives
count as one request. A full room of 8 sends roughly 6 or 7 requests' worth a second (the host's
20 snapshots a second plus everyone's input), so the free plan covers about four hours of a full
room a day, and far more for smaller rooms. An open admin page adds about 100 requests a minute
(it asks all four rooms every 3 seconds while its tab is visible). Past the limit, connections fail until the count resets at
midnight UTC. Cloudflare's $5 a month Workers Paid plan removes the worry.

## Testing locally

`npx wrangler dev` in this folder runs the server at `http://127.0.0.1:8787`; set `SERVER` to that
address in a copy of the game served from `localhost`.
