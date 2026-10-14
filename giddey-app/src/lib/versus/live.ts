import type { RealtimeChannel } from '@supabase/supabase-js';
import { client, cloudEnabled } from './cloud';
import type { Side, VersusState } from './engine';
import { turnSeat } from './notify';

// ═══════════════════════════════════════════════════════════════
//  LIVE ROOM — each coach plays on their own phone; an optional main
//  screen (TV, laptop, tablet) shows the night for everyone.
//
//  Seats: Coach 1, Coach 2, and any number of main screens. The device
//  that opens the room is the host — it runs the shared steps (setup,
//  coin toss, rules pull, entering the result, next game). The host can
//  be a coach's phone or the main screen.
//
//  Every device holds the same VersusState. Whoever acts sends the new
//  state over a Supabase Realtime broadcast channel with a version
//  number; everyone else swaps it in. Spins (wheels, slot machine, coin,
//  lottery) are also sent as "fx" so the other devices play the same
//  animation. Screens hide what one coach shouldn't see of the other's
//  turn (their own pack, secret picks, predictions, votes).
//
//  No sign-in needed. Draft now, play later: the sender also saves the
//  room (room_put RPC, debounced, only newer versions win) and a joining
//  device loads it (room_get), so a coach can close the app mid-draft and
//  pick up where they left off — even after every device left. Without
//  the versus_rooms migration this is silently skipped.
// ═══════════════════════════════════════════════════════════════

export type LiveRole = 'coach' | 'screen';

export interface LivePeer {
	id: string;
	role: LiveRole;
	side: Side | null;
	host: boolean;
}

export interface LiveInfo {
	code: string;
	role: LiveRole;
	/** coach seat (null on a main screen) */
	side: Side | null;
	host: boolean;
	connected: boolean;
	peers: LivePeer[];
	error: string | null;
	/** when the room was last saved to the cloud (ms), if known */
	savedAt?: number | null;
}

/** A spin played on one device, replayed on the others */
export type LiveFx =
	| { kind: 'wheel'; title: string; items: { id: string; label: string; color: string }[]; index: number; accent?: string }
	| { kind: 'slot'; title: string; reels: { title: string; items: { id: string; label: string; color: string }[] }[]; picks: number[] }
	| { kind: 'coin'; names: [string, string]; winner: Side }
	| { kind: 'lottery'; names: [string, string]; winner: Side };

const STORE = 'giddey-versus-live';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const me = Math.random().toString(36).slice(2, 10);

let info: LiveInfo | null = null;
let channel: RealtimeChannel | null = null;
let version = 0;
let latest: VersusState | null = null;
let apply: ((s: VersusState) => void) | null = null;
/** a state arrived from another device since joining */
let heard = false;
const fxListeners = new Set<(fx: LiveFx) => void>();
const listeners = new Set<() => void>();

function set(next: LiveInfo | null) {
	info = next;
	listeners.forEach(fn => fn());
}

export function liveInfo(): LiveInfo | null {
	return info;
}

export function subscribeLive(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** The page hands over how to swap in a state that came from another device */
export function onRemoteState(fn: (s: VersusState) => void): void {
	apply = fn;
}

export function onLiveFx(fn: (fx: LiveFx) => void): () => void {
	fxListeners.add(fn);
	return () => fxListeners.delete(fn);
}

export const liveAvailable = cloudEnabled;

/** This device's coach seat (null = main screen, or not in a room) */
export function mySide(): Side | null {
	return info?.role === 'coach' ? info.side : null;
}

/** In a room and this device is a main screen */
export function isScreen(): boolean {
	return info?.role === 'screen';
}

/**
 * May this device act for `side` (a coach's own turn)? Returns null when it
 * may, otherwise the name to wait for. Outside a room everything is allowed.
 */
export function liveLock(side: Side | null, names: [string, string]): string | null {
	if (!info) return null;
	if (side === null) return info.role === 'coach' || info.host ? null : 'the coaches';
	return info.role === 'coach' && info.side === side ? null : names[side];
}

/** Shared steps (setup, coin, rules pull, result, next game) run on the host */
export function hostLock(names: [string, string]): string | null {
	if (!info || info.host) return null;
	const host = info.peers.find(p => p.host);
	if (!host) return 'the host';
	return host.role === 'screen' ? 'the main screen' : host.side !== null ? names[host.side] : 'the host';
}

/**
 * Should this device see a coach's private choices (their own pack, secret
 * pick, prediction, vote)? Yes outside a room and on that coach's phone.
 */
export function canSeePrivate(side: Side): boolean {
	return !info || (info.role === 'coach' && info.side === side);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomCode(): string {
	let c = '';
	for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	return c;
}

/** Join link for a seat: a coach (0/1) or a main screen */
export function roomLink(code: string, seat: Side | 'screen'): string {
	return `${location.origin}${location.pathname}#live=${code}-${seat === 'screen' ? 'S' : seat + 1}`;
}

/** Parse "#live=CODE-1" / "-2" / "-S" */
export function parseRoomHash(hash: string): { code: string; role: LiveRole; side: Side | null } | null {
	const m = hash.match(/^#live=([A-Za-z0-9]{6})-(1|2|S)$/i);
	if (!m) return null;
	const seat = m[2].toUpperCase();
	return { code: m[1].toUpperCase(), role: seat === 'S' ? 'screen' : 'coach', side: seat === 'S' ? null : seat === '1' ? 0 : 1 };
}

export async function joinRoom(code: string, opts: { role: LiveRole; side: Side | null; host: boolean }, current?: VersusState): Promise<void> {
	await leaveRoom(false);
	const sb = await client();
	version = 0;
	heard = false;
	latest = current ?? null;
	set({ code, role: opts.role, side: opts.role === 'coach' ? opts.side : null, host: opts.host, connected: false, peers: [], error: null, savedAt: null });
	try {
		localStorage.setItem(STORE, JSON.stringify({ code, ...opts }));
	} catch {
		/* ignore */
	}
	const ch = sb.channel(`versus-live-${code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
	channel = ch;
	ch.on('broadcast', { event: 'state' }, ({ payload }) => {
		const p = payload as { v: number; s: VersusState; host: boolean };
		if (!info) return;
		const newer = p.v > version || (p.v === version && p.host && !info.host);
		if (!newer) return;
		version = p.v;
		latest = p.s;
		heard = true;
		apply?.(p.s);
	});
	ch.on('broadcast', { event: 'fx' }, ({ payload }) => fxListeners.forEach(fn => fn(payload as LiveFx)));
	ch.on('broadcast', { event: 'hello' }, () => {
		// someone just joined: the host catches them up
		if (info?.host && latest) void send(latest, false);
	});
	ch.on('presence', { event: 'sync' }, () => {
		const st = ch.presenceState<{ role: LiveRole; side: Side | null; host: boolean }>();
		const peers = Object.entries(st)
			.filter(([k]) => k !== me)
			.map(([id, metas]) => ({ id, role: metas[0]?.role ?? 'coach', side: metas[0]?.side ?? null, host: !!metas[0]?.host }));
		if (info) set({ ...info, peers });
	});
	ch.subscribe(async status => {
		if (!info) return;
		if (status === 'SUBSCRIBED') {
			set({ ...info, connected: true, error: null });
			await ch.track({ role: info.role, side: info.side, host: info.host });
			if (info.host && latest) await send(latest, false);
			else await ch.send({ type: 'broadcast', event: 'hello', payload: { from: me } });
		} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
			set({ ...info, connected: false, error: 'Connection lost — reconnecting…' });
		} else if (status === 'CLOSED') {
			set({ ...info, connected: false });
		}
	});
	void loadSaved(code);
}

/** Pick up a saved room: adopt it when it's newer than what we have */
async function loadSaved(code: string) {
	let row = null as { state: VersusState; version: number; updated_at: string } | null;
	try {
		const sb = await client();
		const { data, error } = await sb.rpc('room_get', { p_code: code });
		if (error) return;
		row = data as typeof row;
	} catch {
		return;
	}
	if (!info || info.code !== code || !row?.state) return;
	const savedAt = Date.parse(row.updated_at) || null;
	// newer than anything heard from the room — or, on a device that joined
	// empty-handed and nobody has caught it up, the room as it was left
	const newer = row.version > version || (row.version === version && !heard && !info.host && !latest);
	set({ ...info, savedAt });
	if (!newer) return;
	version = row.version;
	latest = row.state;
	apply?.(row.state);
	// a host that came back with an older copy re-syncs anyone it already sent it to
	if (info.host) void send(row.state, false);
}

// ─── saving (debounced, best-effort) ────────────────────────────

let pending: { code: string; s: VersusState; v: number } | null = null;
let putTimer: ReturnType<typeof setTimeout> | null = null;

function savePut(s: VersusState) {
	if (!info) return;
	pending = { code: info.code, s, v: version };
	if (putTimer) clearTimeout(putTimer);
	putTimer = setTimeout(() => void flushPut(), 1000);
}

async function flushPut(leaving = false): Promise<void> {
	if (putTimer) clearTimeout(putTimer);
	putTimer = null;
	const p = pending;
	pending = null;
	if (!p) return;
	const args = { p_code: p.code, p_state: p.s, p_version: p.v, p_turn: turnSeat(p.s) };
	try {
		const body = JSON.stringify(args);
		// the page is going away: a keepalive request survives it (64 KB cap)
		if (leaving && SB_URL && body.length < 60000) {
			await fetch(`${SB_URL}/rest/v1/rpc/room_put`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, body });
			return;
		}
		const sb = await client();
		const { data, error } = await sb.rpc('room_put', args);
		if (!error && data && info?.code === p.code) set({ ...info, savedAt: Date.now() });
	} catch {
		/* saving is best-effort; the room still runs over Realtime */
	}
}

// closing the app or switching away right after a pick: save it now
if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden' && pending) void flushPut(true);
	});
	window.addEventListener('pagehide', () => {
		if (pending) void flushPut(true);
	});
}

async function send(s: VersusState, bump = true) {
	if (!channel || !info) return;
	if (bump) version++;
	latest = s;
	// save real moves (and a brand-new room) — a catch-up resend is already saved
	if (cloudEnabled && (bump || version === 0)) savePut(s);
	await channel.send({ type: 'broadcast', event: 'state', payload: { v: version, s, host: info.host } });
}

/** Call after every local change while in a room */
export function broadcastState(s: VersusState): void {
	if (!info) return;
	// a non-host screen never changes the game
	if (info.role === 'screen' && !info.host) return;
	void send(s);
}

/** Replay a spin on the other devices */
export function broadcastFx(fx: LiveFx): void {
	if (!channel || !info) return;
	void channel.send({ type: 'broadcast', event: 'fx', payload: fx });
}

/** Which seats are taken by someone else */
export function takenSeats(): { coach: [boolean, boolean]; screens: number } {
	const coach: [boolean, boolean] = [false, false];
	let screens = 0;
	for (const p of info?.peers ?? []) {
		if (p.role === 'coach' && p.side !== null) coach[p.side] = true;
		else if (p.role === 'screen') screens++;
	}
	return { coach, screens };
}

export async function leaveRoom(forget = true): Promise<void> {
	await flushPut();
	if (channel) {
		const sb = await client();
		await sb.removeChannel(channel);
	}
	channel = null;
	if (forget) {
		try {
			localStorage.removeItem(STORE);
		} catch {
			/* ignore */
		}
	}
	set(null);
}

/** Rejoin the room this device was in before a refresh */
export function savedRoom(): { code: string; role: LiveRole; side: Side | null; host: boolean } | null {
	try {
		const raw = localStorage.getItem(STORE);
		const r = raw ? JSON.parse(raw) : null;
		return r && r.role && 'host' in r ? r : null;
	} catch {
		return null;
	}
}
