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

## Allowed sites

The server only accepts players from `https://ardy828.github.io` and from `localhost` (for testing).
If you host the game somewhere else as well, add that address to `ALLOWED_ORIGINS` in `wrangler.toml`
(comma-separated, e.g. `"https://ardy828.github.io,https://games.example.com"`).

## Free plan limits

Durable Objects are on the free Workers plan with the SQLite backend, which `wrangler.toml` uses.
The free plan allows 100,000 requests a day, and every 20 WebSocket messages the server receives
count as one request. A full room of 8 sends roughly 6 or 7 requests' worth a second (the host's
20 snapshots a second plus everyone's input), so the free plan covers about four hours of a full
room a day, and far more for smaller rooms. Past the limit, connections fail until the count resets at
midnight UTC. Cloudflare's $5 a month Workers Paid plan removes the worry.

## Testing locally

`npx wrangler dev` in this folder runs the server at `http://127.0.0.1:8787`; set `SERVER` to that
address in a copy of the game served from `localhost`.
