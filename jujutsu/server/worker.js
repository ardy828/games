// Jujutsu Arena's public server: a relay on Cloudflare Workers, plus the admin page.
//
// Each public room (pub-1 to pub-4) is one Durable Object holding the players' WebSockets. It does not
// run the match: like a private party, the match runs in one player's browser (the host) and this
// object only passes messages along. Clients send "to|json", where to is '*' (everyone, host only),
// 'h' (the host), a player id (host only) or '!' (the room itself: the host's scoreboard for the
// admin page); the room delivers it as "from|json". The room's own messages come from '!': welcome,
// join, leave, full, host, and the admin's rules, msg, admin (an event for the host to run) and kick.
// When the host leaves, or goes quiet for STALL_MS (a hidden tab, a dead laptop), the oldest remaining
// player becomes host and every player is told, so the room lives as long as anyone is in it.
//
// /admin is the admin page (admin.html); its API under /admin/api/ needs the ADMIN_KEY secret.
//
// Deploy: see README.md in this folder.

import { DurableObject } from 'cloudflare:workers';
import ADMIN_HTML from './admin.html';

const VERSION = 10;          // shown on the root page and in /check, so you can tell which code is live; bump it with each change
const ROOMS = ['pub-1', 'pub-2', 'pub-3', 'pub-4'];
const MAX_PLAYERS = 20;
const MAX_MSG = 32768;      // bytes; a full room's snapshot is about 8 kB
const STALL_MS = 3000;      // a host silent this long hands the room on
const CHAT_LOG = 100;      // chat lines each room keeps for the admin page
const EVENTS = ['heal', 'ults', 'cds', 'maho', 'end', 'restart'];

// The rules the admin sets for the public rooms. Keep RULES0 and cleanRules() in step with the copies
// in ../index.html, which applies them.
const RULES0 = { rounds: true, points: 20, time: 0, brk: 7, resp: 4, curses: 6, skill: 1, dmg: 1, cd: 1, ur: 1, spd: 1, hp: 1, yuji: true, megumi: true, nobara: true, gojo: true, sukuna: true, ults: true };
function cleanRules(c) {
  c = c && typeof c === 'object' ? c : {};
  const n = (k, a, b, step) => { const v = +c[k]; return Number.isFinite(v) ? Math.round(Math.min(b, Math.max(a, v)) / step) * step : RULES0[k]; };
  const b = (k) => (typeof c[k] === 'boolean' ? c[k] : RULES0[k]);
  const r = {
    rounds: b('rounds'), points: n('points', 0, 200, 1), time: n('time', 0, 30, 0.5), brk: n('brk', 3, 30, 1), resp: n('resp', 0.5, 15, 0.5),
    curses: n('curses', 0, 10, 1), skill: n('skill', 0, 2, 1), dmg: n('dmg', 0.25, 4, 0.05), cd: n('cd', 0.1, 3, 0.05), ur: n('ur', 0.25, 4, 0.05), spd: n('spd', 0.5, 2, 0.05),
    hp: n('hp', 0.25, 4, 0.05), yuji: b('yuji'), megumi: b('megumi'), nobara: b('nobara'), gojo: b('gojo'), sukuna: b('sukuna'), ults: b('ults'),
  };
  if (!r.yuji && !r.megumi && !r.nobara && !r.gojo && !r.sukuna) r.yuji = true;
  return r;
}

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
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
// compare without stopping at the first difference, so timing does not leak how much of a guess was right
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const room = (env, name) => env.ROOMS.get(env.ROOMS.idFromName(name));
const ask = (env, name, what, data) =>
  room(env, name).fetch('https://room/admin/' + what, { method: 'POST', body: JSON.stringify(data || {}) }).then((r) => r.json());

async function adminApi(req, env, what) {
  if (!env.ADMIN_KEY) return json({ error: 'No admin key yet. Add a secret called ADMIN_KEY to this Worker in Cloudflare (see the README).' }, 503);
  if (!same(req.headers.get('Authorization') || '', 'Bearer ' + env.ADMIN_KEY)) return json({ error: 'Wrong admin key.' }, 401);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const where = ROOMS.includes(body.room) ? [body.room] : ROOMS;
  if (what === 'status') return json({ max: MAX_PLAYERS, rooms: await Promise.all(ROOMS.map(async (name) => ({ name, ...(await ask(env, name, 'status')) }))) });
  if (what === 'rules') {
    const rules = cleanRules(body.rules);
    await Promise.all(ROOMS.map((name) => ask(env, name, 'rules', { rules })));
    return json({ ok: true, rules });
  }
  if (what === 'event') {
    if (!EVENTS.includes(body.ev)) return json({ error: 'Unknown event.' }, 400);
    const res = await Promise.all(where.map((name) => ask(env, name, 'event', { ev: body.ev })));
    return json({ ok: true, rooms: res.filter((r) => r.ok).length });
  }
  if (what === 'msg') {
    const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!text) return json({ error: 'Type a message first.' }, 400);
    const sec = Math.min(60, Math.max(2, Math.round(Number(body.sec)) || 5));
    await Promise.all(where.map((name) => ask(env, name, 'msg', { text, sec })));
    return json({ ok: true });
  }
  if (what === 'kick') {
    if (!ROOMS.includes(body.room)) return json({ error: 'Which room?' }, 400);
    return json(await ask(env, body.room, 'kick', { id: body.id }));
  }
  return json({ error: 'No such admin action.' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' } });
    }
    const a = url.pathname.match(/^\/admin\/api\/(\w+)$/);
    if (a) return adminApi(req, env, a[1]);
    // /check: is the server up, are the rooms working, and would this page be let in? The game asks
    // this when it cannot join, to say why.
    if (url.pathname === '/check') {
      const origin = req.headers.get('Origin');
      const out = { up: true, version: VERSION, origin, allowed: allowed(origin, env), rooms: null, error: null };
      try { out.rooms = await (await room(env, 'pub-1').fetch('https://room/check')).json(); }
      catch (e) { out.error = String((e && e.message) || e); }
      return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', ...OPEN } });
    }
    const m = url.pathname.match(/^\/room\/([\w-]+)$/);
    if (!m) return new Response('Jujutsu Arena server is up (version ' + VERSION + '). Admin page: /admin\n', { headers: { 'content-type': 'text/plain', ...OPEN } });
    if (!ROOMS.includes(m[1])) return new Response('No such room.\n', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket.\n', { status: 426 });
    if (!allowed(req.headers.get('Origin'), env)) return new Response('Forbidden.\n', { status: 403 });
    return room(env, m[1]).fetch(req);
  },
};

const sys = (m) => '!|' + JSON.stringify(m);
function send(ws, s) { try { ws.send(s); } catch (e) { /* closing */ } }

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.host = undefined;          // loaded from storage on first use; the object can be evicted between players
    this.hostAt = Date.now();       // when the host was last heard from (a fresh start gives it a grace period)
    this.rulesNow = undefined;      // the admin's rules, kept in storage
    this.stat = null;               // the host's latest scoreboard, for the admin page
    this.chat = undefined;          // the room's chat log (last CHAT_LOG lines), kept in storage
    this.chatAt = new Map();        // when each player last said something, to keep the log from flooding
  }
  async chatLog() {
    if (this.chat === undefined) this.chat = (await this.ctx.storage.get('chat')) || [];
    return this.chat;
  }
  // a chat line, logged under the name on the sender's own socket (so nobody can speak for someone else)
  async logChat(me, body) {
    let text = '';
    try { text = String(JSON.parse(body).text || ''); } catch (e) { return; }
    text = text.replace(/\s+/g, ' ').trim().slice(0, 100);
    const now = Date.now();
    if (!text || now - (this.chatAt.get(me.id) || 0) < 800) return;
    this.chatAt.set(me.id, now);
    const log = await this.chatLog();
    log.push({ at: now, id: me.id, name: me.name, text });
    if (log.length > CHAT_LOG) log.splice(0, log.length - CHAT_LOG);
    await this.ctx.storage.put('chat', log);
  }
  // open sockets with who is on them, oldest first
  players(except) {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== 1) continue;
      const me = ws.deserializeAttachment();
      if (me && !me.gone) out.push({ ws, me });
    }
    return out.sort((a, b) => a.me.t - b.me.t);
  }
  async getHost() {
    if (this.host === undefined) this.host = (await this.ctx.storage.get('host')) ?? null;
    return this.host;
  }
  async setHost(id) {
    this.host = id; this.hostAt = Date.now(); this.stat = null;
    await this.ctx.storage.put('host', id);
  }
  async rules() {
    if (this.rulesNow === undefined) this.rulesNow = cleanRules(await this.ctx.storage.get('rules'));
    return this.rulesNow;
  }
  // pick the oldest player other than the one leaving (skipWs) or stalled (skipId), and tell everyone;
  // a stalled host stays in the room as a player
  async newHost(skipId, skipWs) {
    const all = this.players(skipWs), next = all.find((p) => p.me.id !== skipId);
    if (!next) { this.host = null; this.stat = null; await this.ctx.storage.delete('host'); return null; }
    const id = next.me.id;
    await this.setHost(id);
    const msg = sys({ sys: 'host', id, peers: all.map((p) => ({ id: p.me.id, name: p.me.name })) });
    for (const p of all) send(p.ws, msg);
    return id;
  }
  // the admin API, called by the Worker
  async admin(what, body) {
    const players = this.players(), host = await this.getHost();
    if (what === 'status') {
      return {
        rules: await this.rules(),
        players: players.map((p) => ({ id: p.me.id, name: p.me.name, host: p.me.id === host, since: p.me.t })),
        stat: this.stat && Date.now() - this.stat.at < 10000 ? this.stat : null,
        chat: (await this.chatLog()).slice(-30),
      };
    }
    if (what === 'rules') {
      this.rulesNow = cleanRules(body.rules);
      await this.ctx.storage.put('rules', this.rulesNow);
      for (const p of players) send(p.ws, sys({ sys: 'rules', rules: this.rulesNow }));
      return { ok: true };
    }
    if (what === 'event') {
      const h = players.find((p) => p.me.id === host);
      if (h) send(h.ws, sys({ sys: 'admin', ev: body.ev }));
      return { ok: !!h };
    }
    if (what === 'msg') {
      for (const p of players) send(p.ws, sys({ sys: 'msg', text: String(body.text || '').slice(0, 140), sec: body.sec }));
      return { ok: true };
    }
    if (what === 'kick') {
      const p = players.find((o) => o.me.id === body.id);
      if (!p) return { ok: false, error: 'That player is not in this room any more.' };
      send(p.ws, sys({ sys: 'kick' }));
      try { p.ws.close(4001, 'kicked'); } catch (e) { /* gone */ }
      await this.gone(p.ws);
      return { ok: true };
    }
    return { ok: false, error: 'No such admin action.' };
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') {
      if (url.pathname === '/check') return Response.json({ players: this.players().length });
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      return Response.json(await this.admin(url.pathname.replace('/admin/', ''), body));
    }
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
    send(server, sys({ sys: 'welcome', id, host, rules: await this.rules(), peers: others.map((p) => ({ id: p.me.id, name: p.me.name })).concat({ id, name }) }));
    const h = others.find((p) => p.me.id === host);
    if (h) send(h.ws, sys({ sys: 'join', id, name }));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_MSG) return;
    const me = ws.deserializeAttachment();
    const bar = msg.indexOf('|');
    if (!me || me.gone || bar < 1) return;
    const to = msg.slice(0, bar), out = me.id + '|' + msg.slice(bar + 1);
    let host = await this.getHost();
    const now = Date.now();
    if (me.id === host) this.hostAt = now;
    else if (now - this.hostAt > STALL_MS) host = await this.newHost(host);
    // chat: a player's line on its way to the host, or the host's own line sent to the room
    const isChat = msg.startsWith('{"t":"chat"', bar + 1);
    if (isChat && (to === 'h' || (to === '!' && me.id === host))) await this.logChat(me, msg.slice(bar + 1));
    if (to === 'h') {
      const h = this.players().find((p) => p.me.id === host);
      if (h && h.ws !== ws) send(h.ws, out);
    } else if (me.id !== host) {
      // only the host speaks to everyone, to one player or to the room
    } else if (to === '!') {
      if (!isChat && msg.length < 4096) { try { this.stat = { ...JSON.parse(msg.slice(bar + 1)), at: now }; } catch (e) { /* ignored */ } }
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
    else if (!this.players(ws).length) { this.host = null; this.stat = null; await this.ctx.storage.delete('host'); }
  }
}
