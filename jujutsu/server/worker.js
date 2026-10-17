// Jujutsu Arena's public server: a relay on Cloudflare Workers.
//
// Each public room (pub-1 to pub-4) is one Durable Object holding the players' WebSockets. It does not
// run the match: like a private party, the match runs in one player's browser (the host) and this
// object only passes messages along. Clients send "to|json", where to is '*' (everyone, host only),
// 'h' (the host) or a player id (host only); the room delivers it as "from|json". The room's own
// messages come from '!': welcome, join, leave, full and host. When the host leaves, or goes quiet for
// STALL_MS (a hidden tab, a dead laptop), the oldest remaining player becomes host and every player is
// told, so the room lives as long as anyone is in it.
//
// Deploy: see README.md in this folder.

import { DurableObject } from 'cloudflare:workers';

const ROOM = /^pub-[1-4]$/;
const MAX_PLAYERS = 8;
const MAX_MSG = 16384;      // bytes; a snapshot is a few kB
const STALL_MS = 3000;      // a host silent this long hands the room on

// ALLOWED_ORIGINS is a comma-separated list of sites the game may connect from. "*" alone allows any
// site; inside an address a * stands for any subdomain, e.g. https://*.example.workers.dev
function allowed(origin, env) {
  if (!origin) return true;    // not a browser
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes('*')) return true;
  return list.some((p) =>
    new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\w-]+(\\.[\\w-]+)*') + '$').test(origin));
}

const OPEN = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // /check: is the server up, are the rooms working, and would this page be let in? The game asks
    // this when it cannot join, to say why.
    if (url.pathname === '/check') {
      const origin = req.headers.get('Origin');
      const out = { up: true, origin, allowed: allowed(origin, env), rooms: null, error: null };
      try { out.rooms = await (await env.ROOMS.get(env.ROOMS.idFromName('pub-1')).fetch('https://room/check')).json(); }
      catch (e) { out.error = String((e && e.message) || e); }
      return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', ...OPEN } });
    }
    const m = url.pathname.match(/^\/room\/([\w-]+)$/);
    if (!m) return new Response('Jujutsu Arena server is up.\n', { headers: { 'content-type': 'text/plain', ...OPEN } });
    if (!ROOM.test(m[1])) return new Response('No such room.\n', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket.\n', { status: 426 });
    if (!allowed(req.headers.get('Origin'), env)) return new Response('Forbidden.\n', { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

const sys = (m) => '!|' + JSON.stringify(m);
function send(ws, s) { try { ws.send(s); } catch (e) { /* closing */ } }

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.host = undefined;          // loaded from storage on first use; the object can be evicted between players
    this.hostAt = Date.now();       // when the host was last heard from (a fresh start gives it a grace period)
  }
  // open sockets with who is on them, oldest first
  players(except) {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== 1) continue;
      const me = ws.deserializeAttachment();
      if (me) out.push({ ws, me });
    }
    return out.sort((a, b) => a.me.t - b.me.t);
  }
  async getHost() {
    if (this.host === undefined) this.host = (await this.ctx.storage.get('host')) ?? null;
    return this.host;
  }
  async setHost(id) {
    this.host = id; this.hostAt = Date.now();
    await this.ctx.storage.put('host', id);
  }
  // pick the oldest player other than the one leaving (skipWs) or stalled (skipId), and tell everyone;
  // a stalled host stays in the room as a player
  async newHost(skipId, skipWs) {
    const all = this.players(skipWs), next = all.find((p) => p.me.id !== skipId);
    if (!next) { this.host = null; await this.ctx.storage.deleteAll(); return null; }
    const id = next.me.id;
    await this.setHost(id);
    const msg = sys({ sys: 'host', id, peers: all.map((p) => ({ id: p.me.id, name: p.me.name })) });
    for (const p of all) send(p.ws, msg);
    return id;
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') return Response.json({ players: this.players().length });
    const name = (url.searchParams.get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Sorcerer';
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const others = this.players(server);
    if (others.length >= MAX_PLAYERS) {
      send(server, sys({ sys: 'full' }));
      server.close(4000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = ((await this.ctx.storage.get('next')) || 1);
    await this.ctx.storage.put('next', id + 1);
    server.serializeAttachment({ id, name, t: Date.now() });
    let host = await this.getHost();
    if (!others.some((p) => p.me.id === host)) { host = id; await this.setHost(id); }
    send(server, sys({ sys: 'welcome', id, host, peers: others.map((p) => ({ id: p.me.id, name: p.me.name })).concat({ id, name }) }));
    const h = others.find((p) => p.me.id === host);
    if (h) send(h.ws, sys({ sys: 'join', id, name }));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_MSG) return;
    const me = ws.deserializeAttachment();
    const bar = msg.indexOf('|');
    if (!me || bar < 1) return;
    const to = msg.slice(0, bar), out = me.id + '|' + msg.slice(bar + 1);
    let host = await this.getHost();
    const now = Date.now();
    if (me.id === host) this.hostAt = now;
    else if (now - this.hostAt > STALL_MS) host = await this.newHost(host);
    if (to === 'h') {
      const h = this.players().find((p) => p.me.id === host);
      if (h && h.ws !== ws) send(h.ws, out);
    } else if (me.id !== host) {
      // only the host speaks to everyone or to one player
    } else if (to === '*') {
      for (const p of this.players(ws)) send(p.ws, out);
    } else {
      const p = this.players().find((o) => String(o.me.id) === to);
      if (p) send(p.ws, out);
    }
  }
  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (e) { /* already closed */ }
    await this.gone(ws);
  }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    const me = ws.deserializeAttachment();
    if (!me || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: true }); } catch (e) { /* closed */ }
    const left = sys({ sys: 'leave', id: me.id });
    for (const p of this.players(ws)) send(p.ws, left);
    if (me.id === await this.getHost()) await this.newHost(me.id, ws);
    else if (!this.players(ws).length) { this.host = null; await this.ctx.storage.deleteAll(); }
  }
}
