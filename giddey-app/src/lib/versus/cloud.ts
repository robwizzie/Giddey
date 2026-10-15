import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { loadRivalry, RivalryGame, saveRivalry } from './rivalry';
import { mergeGames } from './sync';
import { League, LeagueFormat, loadLeagues, saveLeagues } from './league';

// ═══════════════════════════════════════════════════════════════
//  OPTIONAL ACCOUNTS (Supabase)
//
//  Versus works fully offline with no account. When the site is built
//  with a Supabase project (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY), people
//  can sign in, and each rivalry they create or join lives in the cloud:
//
//    • the local rivalry log stays the source the app reads from
//    • sync = pull every cloud game into the log, push every local game
//      of a linked pair up (games are immutable and de-duped by key)
//    • a pair of names is "linked" when it matches one of your cloud
//      rivalries, so games you played before signing up upload too
//
//  supabase-js is only downloaded when accounts are configured.
// ═══════════════════════════════════════════════════════════════

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const cloudEnabled = !!(URL && KEY);
export const googleEnabled = cloudEnabled && process.env.NEXT_PUBLIC_SUPABASE_GOOGLE === '1';

export interface Profile {
	id: string;
	name: string;
	favorites: string[];
}

export interface CloudRivalry {
	id: string;
	names: [string, string];
	inviteCode: string;
	createdBy: string;
	/** account in each seat (null = not joined yet) */
	members: [{ id: string; name: string } | null, { id: string; name: string } | null];
	/** which seat the signed-in user holds */
	mySeat: 0 | 1;
	/** games played up to this time were reset (ms) */
	resetAt: number | null;
	games: number;
}

export interface CloudState {
	ready: boolean;
	session: Session | null;
	profile: Profile | null;
	rivalries: CloudRivalry[];
	syncing: boolean;
	lastSync: number | null;
	error: string | null;
	/** a newer night in progress saved from another device, waiting for "pick up where you left off" */
	handoff: Handoff | null;
}

/** The night in progress on another of your devices */
export interface Handoff {
	state: unknown;
	changedAt: number;
	device: string;
}

let state: CloudState = { ready: !cloudEnabled, session: null, profile: null, rivalries: [], syncing: false, lastSync: null, error: null, handoff: null };
const listeners = new Set<() => void>();

function set(patch: Partial<CloudState>) {
	state = { ...state, ...patch };
	listeners.forEach(fn => fn());
}

export function cloudState(): CloudState {
	return state;
}

export function subscribeCloud(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** Called after a sync pulls new games so the app can rebuild what it derives from the log */
type ChangeFn = (favorites: Record<string, string[]>, myNames: string[]) => void;
let onChange: ChangeFn | null = null;
export function onCloudChange(fn: ChangeFn): void {
	onChange = fn;
}

let clientP: Promise<SupabaseClient> | null = null;

export function client(): Promise<SupabaseClient> {
	if (!cloudEnabled) return Promise.reject(new Error('Accounts are not set up on this site'));
	clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
		createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'giddey-versus-auth' } }),
	);
	return clientP;
}

const pairKey = (names: string[]) => names.map(n => n.trim().toLowerCase()).sort().join('|');
export const gameKey = (g: Pick<RivalryGame, 'ts' | 'names'>) => `${g.ts}|${pairKey(g.names)}`;

function message(e: unknown): string {
	const m = (e as { message?: string })?.message ?? String(e);
	return m.replace(/^.*?ERROR:\s*/, '');
}

/** Start listening for the session (call once on page load) */
let started = false;
export async function startCloud(): Promise<void> {
	if (!cloudEnabled || started) return;
	started = true;
	try {
		const sb = await client();
		sb.auth.onAuthStateChange((event, session) => {
			const was = state.session?.user.id;
			set({ session });
			if (session && session.user.id !== was) void refresh();
			if (!session) set({ profile: null, rivalries: [], lastSync: null, handoff: null });
		});
		const { data } = await sb.auth.getSession();
		set({ session: data.session, ready: true });
		if (data.session) await refresh();
		// back on this tab or app after using another device: catch up
		let lastFocus = 0;
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible' || !state.session || Date.now() - lastFocus < 15000) return;
			lastFocus = Date.now();
			void syncNow();
		});
	} catch (e) {
		set({ ready: true, error: message(e) });
	}
}

// ─── sign in / out ──────────────────────────────────────────────

const redirectTo = () => `${location.origin}${location.pathname}`;

export async function sendSignInEmail(email: string): Promise<void> {
	const sb = await client();
	const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
	if (error) throw new Error(message(error));
}

/** The 6-digit code from the same email — works inside the installed app too */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
	const sb = await client();
	const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'email' });
	if (error)
		throw new Error(
			/expired|invalid/i.test(error.message)
				? 'That code didn’t work. Codes expire after an hour and only work once — tapping the link in the email uses it up. Send a new one and use the newest email.'
				: message(error),
		);
}

export async function signInWithGoogle(): Promise<void> {
	const sb = await client();
	const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
	if (error) throw new Error(message(error));
}

export async function signOut(): Promise<void> {
	const sb = await client();
	await sb.auth.signOut();
	set({ session: null, profile: null, rivalries: [], lastSync: null, handoff: null });
}

// ─── profile & rivalries ────────────────────────────────────────

async function loadProfile(sb: SupabaseClient): Promise<Profile | null> {
	const uid = state.session?.user.id;
	if (!uid) return null;
	const { data, error } = await sb.from('versus_profiles').select('id, name, favorites').eq('id', uid).maybeSingle();
	if (error) throw error;
	if (data) return data as Profile;
	// accounts made before Versus (or by another app on the same project) never got a
	// profile from the sign-up trigger — create it now
	const meta = state.session?.user.user_metadata as { name?: string } | undefined;
	const name = (meta?.name?.trim() || state.session?.user.email?.split('@')[0] || 'Coach').slice(0, 12);
	const made = await sb.from('versus_profiles').upsert({ id: uid, name }, { onConflict: 'id', ignoreDuplicates: true }).select('id, name, favorites').maybeSingle();
	if (made.error) throw made.error;
	if (made.data) return made.data as Profile;
	const again = await sb.from('versus_profiles').select('id, name, favorites').eq('id', uid).maybeSingle();
	if (again.error) throw again.error;
	return again.data as Profile | null;
}

async function loadRivalries(sb: SupabaseClient): Promise<CloudRivalry[]> {
	const uid = state.session?.user.id;
	if (!uid) return [];
	const { data, error } = await sb
		.from('rivalries')
			.select('id, name_a, name_b, invite_code, created_by, reset_at, rivalry_members(seat, user_id, versus_profiles(name)), games(count)')
		.order('created_at', { ascending: false });
	if (error) throw error;
	type Row = {
		id: string;
		name_a: string;
		name_b: string;
		invite_code: string;
		created_by: string;
		reset_at: string | null;
		rivalry_members: { seat: 0 | 1; user_id: string; versus_profiles: { name: string } | null }[];
		games: { count: number }[];
	};
	return ((data ?? []) as unknown as Row[]).map(r => {
		const members: CloudRivalry['members'] = [null, null];
		for (const m of r.rivalry_members) members[m.seat] = { id: m.user_id, name: m.versus_profiles?.name ?? '' };
		return {
			id: r.id,
			names: [r.name_a, r.name_b],
			inviteCode: r.invite_code,
			createdBy: r.created_by,
			members,
			mySeat: members[1]?.id === uid ? 1 : 0,
			resetAt: r.reset_at ? Date.parse(r.reset_at) : null,
			games: r.games?.[0]?.count ?? 0,
		};
	});
}

/** Reload profile + rivalries, then sync games */
export async function refresh(): Promise<void> {
	if (!state.session) return;
	try {
		const sb = await client();
		const [profile, rivalries] = await Promise.all([loadProfile(sb), loadRivalries(sb)]);
		set({ profile, rivalries, error: null });
		await syncNow();
	} catch (e) {
		set({ error: message(e) });
	}
}

export async function updateProfile(patch: Partial<Pick<Profile, 'name' | 'favorites'>>): Promise<void> {
	const sb = await client();
	const uid = state.session?.user.id;
	if (!uid) return;
	if (!state.profile) set({ profile: await loadProfile(sb) });
	const { data, error } = await sb.from('versus_profiles').update(patch).eq('id', uid).select('id, name, favorites').single();
	if (error) throw new Error(message(error));
	set({ profile: data as Profile });
}

export async function createRivalry(myName: string, theirName: string): Promise<CloudRivalry> {
	const sb = await client();
	const { data, error } = await sb.from('rivalries').insert({ name_a: myName.trim(), name_b: theirName.trim() }).select('id').single();
	if (error) throw new Error(/rivalries_check/.test(error.message) ? 'The two names need to be different' : message(error));
	await refresh();
	return state.rivalries.find(r => r.id === (data as { id: string }).id)!;
}

export async function joinRivalry(code: string): Promise<CloudRivalry | null> {
	const sb = await client();
	const { data, error } = await sb.rpc('join_rivalry', { code: code.trim() });
	if (error) throw new Error(message(error));
	await refresh();
	return state.rivalries.find(r => r.id === data) ?? null;
}

export async function leaveRivalry(r: CloudRivalry): Promise<void> {
	const sb = await client();
	const uid = state.session?.user.id;
	// the creator deletes it for everyone; anyone else just leaves
	const { error } = r.createdBy === uid ? await sb.from('rivalries').delete().eq('id', r.id) : await sb.from('rivalry_members').delete().eq('rivalry_id', r.id).eq('user_id', uid!);
	if (error) throw new Error(message(error));
	await refresh();
}

/** The cloud rivalry these two names belong to, if any */
export function linkedRivalry(names: [string, string]): CloudRivalry | undefined {
	const k = pairKey(names);
	return state.rivalries.find(r => pairKey(r.names) === k);
}

export async function deleteCloudGames(r: CloudRivalry): Promise<void> {
	const sb = await client();
	// mark the reset first so other phones drop their copies instead of re-uploading
	const { error: e1 } = await sb.from('rivalries').update({ reset_at: new Date().toISOString() }).eq('id', r.id);
	if (e1) throw new Error(message(e1));
	const { error } = await sb.from('games').delete().eq('rivalry_id', r.id);
	if (error) throw new Error(message(error));
	await refresh();
}

export function inviteLink(r: CloudRivalry): string {
	return `${location.origin}${location.pathname}#join=${r.inviteCode}`;
}

// ─── games ──────────────────────────────────────────────────────

async function pullGames(sb: SupabaseClient, rivalryId: string): Promise<RivalryGame[]> {
	const out: RivalryGame[] = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await sb.from('games').select('data').eq('rivalry_id', rivalryId).order('played_at').range(from, from + 999);
		if (error) throw error;
		out.push(...(data ?? []).map(r => r.data as RivalryGame));
		if (!data || data.length < 1000) return out;
	}
}

let syncing: Promise<void> | null = null;

// ─── leagues ────────────────────────────────────────────────────

/** Cloud leagues are cached in the local league list (so they work offline) */
async function loadCloudLeagues(sb: SupabaseClient): Promise<League[]> {
	const uid = state.session?.user.id;
	const { data, error } = await sb.from('leagues').select('id, name, names, format, playoffs_early, invite_code, created_by, created_at').order('created_at');
	if (error) throw error;
	type Row = { id: string; name: string; names: string[]; format: LeagueFormat; playoffs_early: boolean; invite_code: string; created_by: string; created_at: string };
	const cloud = ((data ?? []) as Row[]).map(
		(r): League => ({
			id: r.id,
			name: r.name,
			names: r.names,
			format: r.format,
			createdAt: Date.parse(r.created_at),
			playoffsEarly: r.playoffs_early,
			cloud: { inviteCode: r.invite_code, isCommissioner: r.created_by === uid },
		}),
	);
	// replace every cached cloud league; local-only leagues stay
	saveLeagues([...loadLeagues().filter(l => !l.cloud), ...cloud]);
	return cloud;
}

/** Move a phone-only league to the cloud (its games come along) */
export async function uploadLeague(local: League): Promise<League> {
	const sb = await client();
	const { data, error } = await sb.from('leagues').insert({ name: local.name, names: local.names, format: local.format, playoffs_early: !!local.playoffsEarly }).select('id').single();
	if (error) throw new Error(message(error));
	const id = (data as { id: string }).id;
	// re-tag this league's games with the cloud id, then drop the local copy
	saveRivalry(loadRivalry().map(g => (g.league?.id === local.id ? { ...g, league: { ...g.league, id } } : g)));
	saveLeagues(loadLeagues().filter(l => l.id !== local.id));
	await refresh();
	return loadLeagues().find(l => l.id === id)!;
}

export async function peekLeague(code: string): Promise<{ id: string; name: string; names: string[]; claimed: string[] } | null> {
	const sb = await client();
	const { data, error } = await sb.rpc('league_by_code', { code: code.trim() });
	if (error) throw new Error(message(error));
	return ((data as { id: string; name: string; names: string[]; claimed: string[] }[]) ?? [])[0] ?? null;
}

export async function joinLeague(code: string, asName: string): Promise<void> {
	const sb = await client();
	const { error } = await sb.rpc('join_league', { code: code.trim(), as_name: asName });
	if (error) throw new Error(message(error));
	await refresh();
}

export async function updateCloudLeague(id: string, patch: { playoffs_early?: boolean; names?: string[]; format?: LeagueFormat; name?: string }): Promise<void> {
	const sb = await client();
	const { error } = await sb.from('leagues').update(patch).eq('id', id);
	if (error) throw new Error(message(error));
	await refresh();
}

export async function leaveCloudLeague(l: League): Promise<void> {
	const sb = await client();
	const uid = state.session?.user.id;
	const { error } = l.cloud?.isCommissioner ? await sb.from('leagues').delete().eq('id', l.id) : await sb.from('league_members').delete().eq('league_id', l.id).eq('user_id', uid!);
	if (error) throw new Error(message(error));
	saveLeagues(loadLeagues().filter(x => x.id !== l.id));
	await refresh();
}

async function syncLeagueGames(sb: SupabaseClient, leagues: League[], uid: string) {
	for (const l of leagues) {
		const remote: RivalryGame[] = [];
		for (let from = 0; ; from += 1000) {
			const { data, error } = await sb.from('league_games').select('data').eq('league_id', l.id).order('played_at').range(from, from + 999);
			if (error) throw error;
			remote.push(...(data ?? []).map(r => r.data as RivalryGame));
			if (!data || data.length < 1000) break;
		}
		mergeGames({ v: 1, games: remote, favorites: {} });
		const have = new Set(remote.map(gameKey));
		const mine = loadRivalry().filter(g => g.league?.id === l.id && !have.has(gameKey(g)));
		for (let i = 0; i < mine.length; i += 200) {
			const rows = mine.slice(i, i + 200).map(g => ({ league_id: l.id, game_key: gameKey(g), played_at: new Date(g.ts).toISOString(), data: g, created_by: uid }));
			const { error } = await sb.from('league_games').upsert(rows, { onConflict: 'league_id,game_key', ignoreDuplicates: true });
			if (error) throw error;
		}
	}
}

/** Two-way sync of every linked rivalry. Safe to call often — runs one at a time. */
export function syncNow(): Promise<void> {
	if (!cloudEnabled || !state.session) return Promise.resolve();
	syncing ??= (async () => {
		set({ syncing: true });
		try {
			const sb = await client();
			const uid = state.session!.user.id;
			await pullDevice(sb, uid);
			for (const r of state.rivalries) {
				// a reset on another phone: drop this pair's older games here too
				if (r.resetAt) {
					const k0 = pairKey(r.names);
					const all = loadRivalry();
					const kept = all.filter(g => pairKey(g.names) !== k0 || g.ts > r.resetAt!);
					if (kept.length !== all.length) saveRivalry(kept);
				}
				const remote = (await pullGames(sb, r.id)).filter(g => !r.resetAt || g.ts > r.resetAt);
				mergeGames({ v: 1, games: remote, favorites: {} });
				const have = new Set(remote.map(gameKey));
				const k = pairKey(r.names);
				const mine = loadRivalry().filter(g => pairKey(g.names) === k && !have.has(gameKey(g)));
				for (let i = 0; i < mine.length; i += 200) {
					const rows = mine.slice(i, i + 200).map(g => ({ rivalry_id: r.id, game_key: gameKey(g), played_at: new Date(g.ts).toISOString(), data: g, created_by: uid }));
					const { error } = await sb.from('games').upsert(rows, { onConflict: 'rivalry_id,game_key', ignoreDuplicates: true });
					if (error) throw error;
				}
				if (mine.length) r.games += mine.length;
			}
			await syncLeagueGames(sb, await loadCloudLeagues(sb), uid);
			// franchise guys travel with each person's profile
			const favorites: Record<string, string[]> = {};
			if (state.profile) {
				for (const r of state.rivalries) favorites[r.names[r.mySeat]] = state.profile.favorites;
				const others = state.rivalries.flatMap(r => r.members.filter((m): m is NonNullable<typeof m> => !!m && m.id !== uid).map(m => ({ id: m.id, name: r.names[r.members.indexOf(m)] })));
				if (others.length) {
					const { data } = await sb.from('versus_profiles').select('id, favorites').in('id', [...new Set(others.map(o => o.id))]);
					for (const p of (data ?? []) as { id: string; favorites: string[] }[]) for (const o of others.filter(x => x.id === p.id)) favorites[o.name] = p.favorites;
				}
			}
			set({ lastSync: Date.now(), error: null, rivalries: [...state.rivalries] });
			onChange?.(favorites, state.rivalries.map(r => r.names[r.mySeat]));
		} catch (e) {
			set({ error: message(e) });
		} finally {
			set({ syncing: false });
			syncing = null;
		}
	})();
	return syncing;
}

// ─── your account follows you between devices ───────────────────

const CHANGED_KEY = 'giddey-versus-changed-at';
const STATE_KEY = 'giddey-versus-v1';

const readNum = (k: string) => {
	try {
		return Number(localStorage.getItem(k)) || 0;
	} catch {
		return 0;
	}
};

/** Call on every local change to the night in progress */
export function markLocalChange(at = Date.now()): void {
	try {
		localStorage.setItem(CHANGED_KEY, String(at));
	} catch {
		/* storage blocked */
	}
}

function deviceName(): string {
	const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
	if (/iPhone/.test(ua)) return 'iPhone';
	if (/iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'iPad';
	if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
	if (/Macintosh/.test(ua)) return 'Mac';
	if (/Windows/.test(ua)) return 'Windows PC';
	if (/CrOS/.test(ua)) return 'Chromebook';
	return 'another device';
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushPending: unknown = null;

async function pushNow(): Promise<void> {
	pushTimer = null;
	if (!state.session || pushPending === null) return;
	const body = pushPending;
	pushPending = null;
	try {
		const sb = await client();
		const { error } = await sb
			.from('versus_user_state')
			.upsert({ user_id: state.session.user.id, state: body, games: loadRivalry(), changed_at: readNum(CHANGED_KEY), device: deviceName() }, { onConflict: 'user_id' });
		if (error) throw error;
	} catch {
		/* best effort — the next change tries again */
	}
}

/** Save the night in progress (and the whole game log) to your account, a moment after the last change */
export function pushDevice(s: unknown): void {
	if (!cloudEnabled || !state.session) return;
	pushPending = s;
	if (pushTimer) clearTimeout(pushTimer);
	pushTimer = setTimeout(() => void pushNow(), 2000);
}

// leaving the page right after a change: send it now
if (typeof window !== 'undefined')
	window.addEventListener('pagehide', () => {
		if (pushTimer) {
			clearTimeout(pushTimer);
			void pushNow();
		}
	});

const isFresh = (s: { phase?: string; series?: unknown[] } | null) => !s || (s.phase === 'setup' && !(s.series ?? []).length);

/** Merge this account's games from your other devices, and notice a newer night in progress */
async function pullDevice(sb: SupabaseClient, uid: string): Promise<void> {
	const { data, error } = await sb.from('versus_user_state').select('state, games, changed_at, device').eq('user_id', uid).maybeSingle();
	if (error) {
		// table not created yet (migration 5 not run): everything else still works
		if (/versus_user_state|schema cache|does not exist/i.test(error.message)) return;
		throw error;
	}
	if (!data) {
		// first device on this account: start the backup from here
		try {
			const local = localStorage.getItem(STATE_KEY);
			if (local) pushDevice(JSON.parse(local));
		} catch {
			/* ignore */
		}
		return;
	}
	const row = data as { state: unknown; games: RivalryGame[] | null; changed_at: number; device: string | null };
	const added = mergeGames({ v: 1, games: Array.isArray(row.games) ? row.games : [], favorites: {} });
	let local: { phase?: string; series?: unknown[] } | null = null;
	try {
		local = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null');
	} catch {
		local = null;
	}
	const mine = readNum(CHANGED_KEY);
	const same = JSON.stringify(row.state) === JSON.stringify(local);
	if (row.state && !same && row.changed_at > mine) {
		set({ handoff: { state: row.state, changedAt: row.changed_at, device: row.device || 'another device' } });
		// nothing going on here yet: no need to ask
		if (isFresh(local)) handoffAuto?.(row.state, row.changed_at);
	} else if (!same && mine > row.changed_at && local) {
		// this device is ahead (it changed while offline): bring the account up to date
		pushDevice(local);
	} else if (added) {
		pushDevice(local);
	}
}

let handoffAuto: ((s: unknown, at: number) => void) | null = null;
/** The page applies a handoff by itself when this device has nothing going on */
export function onHandoffAuto(fn: (s: unknown, at: number) => void): void {
	handoffAuto = fn;
}

/** "Pick up where you left off" — returns the other device's state to load (and marks it as current here) */
export function takeHandoff(): unknown {
	const h = state.handoff;
	if (!h) return null;
	markLocalChange(h.changedAt);
	set({ handoff: null });
	return h.state;
}

/** "Keep this one" — this device's night becomes the one your account remembers */
export function keepThisDevice(current: unknown): void {
	set({ handoff: null });
	markLocalChange();
	pushDevice(current);
}

// ─── public career page ─────────────────────────────────────────

/** Publish (or refresh) your public career snapshot; returns the share slug */
export async function publishCareer(data: unknown): Promise<string> {
	const sb = await client();
	const uid = state.session?.user.id;
	if (!uid) throw new Error('Sign in first');
	const { data: existing } = await sb.from('careers').select('slug').eq('user_id', uid).maybeSingle();
	if (existing) {
		const { error } = await sb.from('careers').update({ data }).eq('user_id', uid);
		if (error) throw new Error(message(error));
		return (existing as { slug: string }).slug;
	}
	const { data: row, error } = await sb.from('careers').insert({ data }).select('slug').single();
	if (error) throw new Error(message(error));
	return (row as { slug: string }).slug;
}

export async function unpublishCareer(): Promise<void> {
	const sb = await client();
	const uid = state.session?.user.id;
	if (!uid) return;
	await sb.from('careers').delete().eq('user_id', uid);
}

/** Read a published career with the public key — no sign-in, no library download */
export async function fetchCareer(slug: string): Promise<{ data: unknown; updated: string } | null> {
	if (!cloudEnabled) return null;
	const res = await fetch(`${URL}/rest/v1/careers?slug=eq.${encodeURIComponent(slug)}&select=data,updated_at`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
	if (!res.ok) return null;
	const rows = (await res.json()) as { data: unknown; updated_at: string }[];
	return rows[0] ? { data: rows[0].data, updated: rows[0].updated_at } : null;
}

export function careerLink(slug: string): string {
	// keep the .html form when the site is served that way (local previews)
	return `${location.origin}/versus/career${location.pathname.endsWith('.html') ? '.html' : ''}#${slug}`;
}
