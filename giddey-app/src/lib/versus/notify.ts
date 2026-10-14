'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { client, cloudEnabled } from './cloud';
import { actingSide, other, type Side, type VersusState } from './engine';
import { getVersusPlayer } from './pool';
import { liveInfo, mySide, subscribeLive } from './live';

// ═══════════════════════════════════════════════════════════════
//  TURN ALERTS — in a live room, tell a coach when it's their move.
//
//  • Page hidden (other tab, phone locked with the app in the
//    background): a system notification through the service worker,
//    and a "● Your pick" tab title. Works with no server at all.
//  • App closed: Web Push from the notify-turn edge function, when the
//    site is built with NEXT_PUBLIC_VAPID_PUBLIC_KEY (see supabase/README).
//    The room row's `turn` (computed here by whoMustAct) drives it.
//
//  Opt-in per device from the LiveSheet; the choice is remembered.
// ═══════════════════════════════════════════════════════════════

/**
 * Which coach the game is waiting on right now — the seat a "your turn"
 * ping should go to. 'both' = either / both coaches act (no single seat),
 * null = nobody in particular (the host's shared steps: setup, coin toss,
 * rules pull, entering the result, the reveal …).
 *
 * Mirrors the LiveGate / useCanAct sides used by each screen.
 */
export function whoMustAct(s: VersusState): Side | 'both' | null {
	switch (s.phase) {
		// theme wheel: the coin-toss winner spins
		case 'theme':
			return s.coinWinner ?? 0;
		// franchise guys and keepers go one at a time
		case 'favorites':
			return s.favoriteTurn;
		case 'keepers':
			return s.keeperTurn;
		// dynasty keeps alternate (the season lottery itself is a host step)
		case 'dynasty':
			return s.dynasty?.turn ?? 0;
		// secret bans: one coach locks in, then the other; after the reveal the host moves on
		case 'bans':
			return s.bans && !s.bans.revealed ? s.bans.turn : s.bans ? null : 0;
		// scouting report: same, one coach at a time (both locked → the draft starts)
		case 'board':
			return s.board?.turn ?? 0;
		case 'draft': {
			const d = s.draft;
			if (!d) return null;
			// auction: whoever has to raise or pass, or nominate the next lot
			if (d.auction) return d.auction.lot ? d.auction.lot.turn : d.auction.nominator;
			// snake / cut / franchise / blind-bid: the coach on the clock (spin, cut, pick, secret pick)
			return actingSide(d);
		}
		// talent equalizer: the coach getting the help picks
		case 'equalizer':
			return s.equalizer?.side ?? null;
		// trades: answer an offer on the table, otherwise it's the proposer's turn
		case 'trade':
			if (!s.trade) return null;
			return s.trade.proposal ? other(s.trade.proposal.from) : s.trade.turn;
		// mechanical boosts (upgrade / sign) are resolved by the coach who earned them
		case 'boosts':
			return s.boostQueue[0]?.side ?? null;
		case 'gameday': {
			const gd = s.gameday;
			// quarter + rule pull run on the host
			if (gd.quarter === null || gd.modifier === null) return null;
			// then each coach spins their own challenge
			if (!gd.rewards[0]) return 0;
			if (!gd.rewards[1]) return 1;
			// secret predictions before tip-off are optional — no ping
			return null;
		}
		case 'postgame': {
			// the loser's revenge spin (sabotage) is theirs, until it's landed
			// (the host may skip it and move on — then the ping just goes stale)
			const last = s.series[s.series.length - 1];
			if (last && !s.pendingSabotage) return other(last.winner);
			return null;
		}
		default:
			return null;
	}
}

/** whoMustAct as a room `turn`: a seat, or null */
export function turnSeat(s: VersusState): Side | null {
	const w = whoMustAct(s);
	return w === 'both' ? null : w;
}

/** What to call the move, for the title: "Your pick", "Your bid", … */
function moveLabel(s: VersusState): string {
	switch (s.phase) {
		case 'theme':
			return 'Your spin';
		case 'favorites':
			return 'Pick your franchise guy';
		case 'keepers':
			return 'Pick your keeper';
		case 'dynasty':
			return 'Your keep';
		case 'bans':
			return 'Your bans';
		case 'board':
			return 'Your scouting report';
		case 'draft': {
			const d = s.draft;
			if (d?.auction) return d.auction.lot ? 'Your bid' : 'Your nomination';
			if (d?.stage === 'spin') return 'Your spin';
			if (d?.stage === 'cut') return 'Your cut';
			if (d?.stage === 'secret') return 'Your secret pick';
			return 'Your pick';
		}
		case 'trade':
			return s.trade?.proposal ? 'Trade offer for you' : 'Your trade';
		case 'equalizer':
		case 'boosts':
			return 'Your move';
		case 'gameday':
			return 'Your challenge spin';
		case 'postgame':
			return 'Your revenge spin';
		default:
			return 'Your turn';
	}
}

/** "Round 4 · Dave took Allen Iverson" */
function moveBody(s: VersusState): string {
	const names = s.settings.names;
	const d = s.draft;
	if (s.phase === 'draft' && d) {
		const round = `Round ${d.round + 1}`;
		const last = d.lastPick ?? d.log[d.log.length - 1];
		const p = last ? getVersusPlayer(last.id) : undefined;
		if (p && last) return `${round} · ${names[last.side]} took ${p.firstName} ${p.lastName}${last.price ? ` for $${last.price}` : ''}`;
		return `${round} · you're on the clock`;
	}
	if (s.phase === 'trade' && s.trade?.proposal) return `${names[s.trade.proposal.from]} sent you a trade offer`;
	if (s.phase === 'bans') return `${names[other(s.bans?.turn ?? 0)]} locked in. Your turn to ban.`;
	if (s.phase === 'board') return `${names[other(s.board?.turn ?? 0)]} locked in their reads. Your turn.`;
	return `Game ${s.gameNo} · ${names[0]} vs ${names[1]}`;
}

/** The notification for this device's coach, or null when it isn't their move */
export function turnMessage(s: VersusState, side: Side): { title: string; body: string } | null {
	const w = whoMustAct(s);
	if (w !== side && w !== 'both') return null;
	const name = s.settings.names[side];
	const label = moveLabel(s);
	return { title: label === 'Your turn' || label === 'Your pick' ? `${label}, ${name}` : label, body: moveBody(s) };
}

// ─── opt-in ─────────────────────────────────────────────────────

const PREF = 'giddey-versus-notify';
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
/** Turn alerts with the app closed are set up on this site */
export const pushEnabled = !!VAPID && cloudEnabled;

export type NotifyStatus = 'on' | 'off' | 'denied' | 'unsupported' | 'install';

const prefListeners = new Set<() => void>();
let status: NotifyStatus = 'off';

function readPref(): boolean {
	try {
		return localStorage.getItem(PREF) === 'on';
	} catch {
		return false;
	}
}

function writePref(on: boolean) {
	try {
		localStorage.setItem(PREF, on ? 'on' : 'off');
	} catch {
		/* ignore */
	}
}

const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () =>
	typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

function computeStatus(): NotifyStatus {
	if (typeof window === 'undefined') return 'off';
	if (!('Notification' in window)) return isIOS() && !standalone() ? 'install' : 'unsupported';
	if (Notification.permission === 'denied') return 'denied';
	return readPref() && Notification.permission === 'granted' ? 'on' : 'off';
}

function refresh() {
	const next = computeStatus();
	if (next !== status) {
		status = next;
		prefListeners.forEach(fn => fn());
	}
}

/** on / off / denied (blocked in the browser) / unsupported / install (iPhone: add to Home Screen first) */
export function notifyStatus(): NotifyStatus {
	return status;
}

export function subscribeNotify(fn: () => void): () => void {
	prefListeners.add(fn);
	refresh();
	return () => prefListeners.delete(fn);
}

export function useNotifyStatus(): NotifyStatus {
	return useSyncExternalStore(subscribeNotify, notifyStatus, () => 'off');
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
	try {
		return (await navigator.serviceWorker.getRegistration('/versus')) ?? (await navigator.serviceWorker.register('/versus-sw.js', { scope: '/versus' }));
	} catch {
		return null;
	}
}

/** Call from a tap: asks for permission, then remembers the choice */
export async function enableTurnNotifications(): Promise<NotifyStatus> {
	if (typeof window === 'undefined' || !('Notification' in window)) return computeStatus();
	let perm = Notification.permission;
	if (perm === 'default') {
		try {
			perm = await Notification.requestPermission();
		} catch {
			perm = 'denied';
		}
	}
	writePref(perm === 'granted');
	refresh();
	if (perm === 'granted') void syncPush();
	return status;
}

export function disableTurnNotifications(): void {
	writePref(false);
	refresh();
	void dropPush();
}

// ─── push (app closed) ──────────────────────────────────────────

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const pad = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

let pushedFor: string | null = null;

/** Subscribe this browser for its seat in the current room (best-effort, silent) */
async function syncPush(): Promise<void> {
	const info = liveInfo();
	const side = mySide();
	if (!pushEnabled || !info || side === null || status !== 'on') return;
	const key = `${info.code}-${side}`;
	if (pushedFor === key) return;
	try {
		const reg = await registration();
		if (!reg?.pushManager) return;
		const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
		const sb = await client();
		const { error } = await sb.rpc('push_subscribe', { p_code: info.code, p_side: side, p_subscription: sub.toJSON() });
		if (!error) pushedFor = key;
	} catch {
		/* push is optional */
	}
}

async function dropPush(): Promise<void> {
	pushedFor = null;
	if (!pushEnabled) return;
	try {
		const reg = await registration();
		const sub = await reg?.pushManager?.getSubscription();
		if (!sub) return;
		const sb = await client();
		await sb.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
	} catch {
		/* ignore */
	}
}

// ─── showing it ─────────────────────────────────────────────────

const TAG = 'giddey-turn';

async function show(title: string, body: string, url: string) {
	const opts: NotificationOptions & { renotify?: boolean } = { body, tag: TAG, renotify: true, icon: '/versus-icons/icon-192.png', badge: '/versus-icons/icon-192.png', data: { url, at: Date.now() } };
	try {
		const reg = await registration();
		if (reg) return void (await reg.showNotification(title, opts));
	} catch {
		/* fall through */
	}
	try {
		new Notification(title, opts);
	} catch {
		/* some mobile browsers only allow service-worker notifications */
	}
}

async function clearShown() {
	try {
		const reg = await registration();
		(await reg?.getNotifications({ tag: TAG }))?.forEach(n => n.close());
	} catch {
		/* ignore */
	}
}

// a tapped notification for another room: switch to it
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
	navigator.serviceWorker.addEventListener('message', e => {
		const msg = e.data as { type?: string; url?: string } | null;
		if (msg?.type !== 'giddey-open-room' || !msg.url) return;
		const m = msg.url.match(/#live=([A-Za-z0-9]{6})-/);
		if (m && liveInfo()?.code !== m[1].toUpperCase()) {
			location.hash = msg.url.slice(msg.url.indexOf('#'));
			location.reload();
		}
	});
}

const TITLE_MARK = '● ';

/** Changes whenever there's a new move to make */
function moveKey(s: VersusState): string {
	const d = s.draft;
	return [s.gameNo, s.phase, d?.round, d?.turn, d?.stage, d?.log.length, d?.auction?.lot?.bid, s.trade?.history.length, s.trade?.proposal?.give, s.boostQueue.length].join('|');
}

/**
 * Page hook: in a live room, ping this device's coach when the game turns
 * to them while the page is hidden, and mark the tab title until they look.
 */
export function useTurnNotifications(state: VersusState | null): void {
	const live = useSyncExternalStore(subscribeLive, liveInfo, () => null);
	const side = live?.role === 'coach' ? live.side : null;
	const code = live?.code ?? null;
	const was = useRef<string | null>(null);
	const baseTitle = useRef<string | null>(null);

	// keep the push subscription on this room's seat
	useEffect(() => {
		// left the room: stop the pings for it
		if (code === null || side === null) {
			if (pushedFor) void dropPush();
			return;
		}
		refresh();
		void syncPush();
	}, [code, side]);

	// restore the title (and clear the ping) when they come back
	useEffect(() => {
		const onVis = () => {
			if (document.visibilityState !== 'visible') return;
			if (baseTitle.current !== null) {
				document.title = baseTitle.current;
				baseTitle.current = null;
			}
			refresh();
			void clearShown();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => document.removeEventListener('visibilitychange', onVis);
	}, []);

	useEffect(() => {
		if (!state || code === null || side === null) {
			was.current = null;
			return;
		}
		const msg = turnMessage(state, side);
		// a new move for me: it just turned to me, or I'm up again (back-to-back snake picks)
		const key = msg ? moveKey(state) : null;
		const turnedToMe = !!key && key !== was.current;
		was.current = key;
		if (!msg) {
			if (baseTitle.current !== null) {
				document.title = baseTitle.current;
				baseTitle.current = null;
			}
			return;
		}
		if (!turnedToMe || document.visibilityState !== 'hidden') return;
		if (baseTitle.current === null) baseTitle.current = document.title.startsWith(TITLE_MARK) ? 'Giddey Versus' : document.title;
		document.title = `${TITLE_MARK}${msg.title.replace(/,.*$/, '')} — Giddey`;
		if (computeStatus() === 'on') void show(msg.title, msg.body, `/versus#live=${code}-${side + 1}`);
	}, [state, code, side]);
}
