import type { RealtimeChannel } from '@supabase/supabase-js';
import { client, cloudEnabled } from './cloud';
import type { Side, VersusState } from './engine';

// ═══════════════════════════════════════════════════════════════
//  LIVE ROOM — draft from two phones (or two houses), plus a TV.
//
//  Both phones hold the same VersusState. Whoever's turn it is acts on
//  their own phone; the new state goes out over a Supabase Realtime
//  broadcast channel with a version number, and the other phone (and
//  any TV) swaps it in. Turn locks in the UI stop the other coach from
//  acting out of turn. Randomness happens on the phone that acts, so
//  everyone sees the same packs and spins.
//
//  No tables needed — just the project's Realtime, which the anon key
//  can use. Room codes are random, so only people you send one to can
//  get in.
// ═══════════════════════════════════════════════════════════════

export type LiveRole = 'host' | 'guest' | 'tv';

export interface LivePeer {
	id: string;
	role: LiveRole;
}

export interface LiveInfo {
	code: string;
	role: LiveRole;
	/** which coach the host plays (the guest is the other one) */
	hostSide: Side;
	connected: boolean;
	peers: LivePeer[];
	error: string | null;
}

const STORE = 'giddey-versus-live';
const me = Math.random().toString(36).slice(2, 10);

let info: LiveInfo | null = null;
let channel: RealtimeChannel | null = null;
let version = 0;
let latest: VersusState | null = null;
let apply: ((s: VersusState) => void) | null = null;
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

/** The page hands over how to swap in a state that came from another phone */
export function onRemoteState(fn: (s: VersusState) => void): void {
	apply = fn;
}

export const liveAvailable = cloudEnabled;

/** This phone's coach in the room (null = TV, or not in a room) */
export function mySide(): Side | null {
	if (!info || info.role === 'tv') return null;
	return info.role === 'host' ? info.hostSide : info.hostSide === 0 ? 1 : 0;
}

/**
 * Who has to act, from this phone's point of view: null if this phone may
 * act, otherwise the name to wait for. `side` null = anyone (both phones).
 */
export function liveLock(side: Side | null, names: [string, string]): string | null {
	if (!info) return null;
	if (info.role === 'tv') return side === null ? 'the coaches' : names[side];
	if (side === null) return null;
	return mySide() === side ? null : names[side];
}

/** Host-only actions (coin flip, slot pull, next game) */
export function hostLock(names: [string, string]): string | null {
	if (!info || info.role === 'host') return null;
	return names[info.hostSide];
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRoomCode(): string {
	let c = '';
	for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	return c;
}

export function roomLink(code: string, role: 'guest' | 'tv'): string {
	return `${location.origin}${location.pathname}#${role === 'tv' ? 'tv' : 'live'}=${code}`;
}

export async function joinRoom(code: string, role: LiveRole, hostSide: Side = 0, current?: VersusState): Promise<void> {
	await leaveRoom(false);
	const sb = await client();
	version = 0;
	latest = current ?? null;
	set({ code, role, hostSide, connected: false, peers: [], error: null });
	try {
		localStorage.setItem(STORE, JSON.stringify({ code, role, hostSide }));
	} catch {
		/* ignore */
	}
	const ch = sb.channel(`versus-live-${code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
	channel = ch;
	ch.on('broadcast', { event: 'state' }, ({ payload }) => {
		const p = payload as { v: number; s: VersusState; by: LiveRole; hostSide: Side };
		if (!info) return;
		const newer = p.v > version || (p.v === version && p.by === 'host' && info.role !== 'host');
		if (!newer) return;
		version = p.v;
		latest = p.s;
		if (info.role !== 'host' && p.hostSide !== info.hostSide) set({ ...info, hostSide: p.hostSide });
		apply?.(p.s);
	});
	ch.on('broadcast', { event: 'hello' }, () => {
		// someone just joined: the host catches them up
		if (info?.role === 'host' && latest) void send(latest, false);
	});
	ch.on('presence', { event: 'sync' }, () => {
		const st = ch.presenceState<{ role: LiveRole }>();
		const peers = Object.entries(st)
			.filter(([k]) => k !== me)
			.map(([id, metas]) => ({ id, role: metas[0]?.role ?? 'guest' }));
		if (info) set({ ...info, peers });
	});
	ch.subscribe(async status => {
		if (!info) return;
		if (status === 'SUBSCRIBED') {
			set({ ...info, connected: true, error: null });
			await ch.track({ role });
			if (role === 'host' && latest) await send(latest, false);
			else await ch.send({ type: 'broadcast', event: 'hello', payload: { from: me } });
		} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
			set({ ...info, connected: false, error: 'Connection lost — reconnecting…' });
		} else if (status === 'CLOSED') {
			set({ ...info, connected: false });
		}
	});
}

async function send(s: VersusState, bump = true) {
	if (!channel || !info) return;
	if (bump) version++;
	latest = s;
	await channel.send({ type: 'broadcast', event: 'state', payload: { v: version, s, by: info.role, hostSide: info.hostSide } });
}

/** Call after every local change while in a room */
export function broadcastState(s: VersusState): void {
	if (!info || info.role === 'tv') return;
	void send(s);
}

/** The host can switch which coach they are */
export function setHostSide(side: Side): void {
	if (!info || info.role !== 'host') return;
	set({ ...info, hostSide: side });
	try {
		localStorage.setItem(STORE, JSON.stringify({ code: info.code, role: info.role, hostSide: side }));
	} catch {
		/* ignore */
	}
	if (latest) void send(latest);
}

export async function leaveRoom(forget = true): Promise<void> {
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

/** Rejoin the room this phone was in before a refresh */
export function savedRoom(): { code: string; role: LiveRole; hostSide: Side } | null {
	try {
		const raw = localStorage.getItem(STORE);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
