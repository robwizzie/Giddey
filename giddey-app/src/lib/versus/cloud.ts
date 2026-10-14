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
}

let state: CloudState = { ready: !cloudEnabled, session: null, profile: null, rivalries: [], syncing: false, lastSync: null, error: null };
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
			if (!session) set({ profile: null, rivalries: [], lastSync: null });
		});
		const { data } = await sb.auth.getSession();
		set({ session: data.session, ready: true });
		if (data.session) await refresh();
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
	const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
	if (error) throw new Error(message(error));
}

export async function signInWithGoogle(): Promise<void> {
	const sb = await client();
	const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
	if (error) throw new Error(message(error));
}

export async function signOut(): Promise<void> {
	const sb = await client();
	await sb.auth.signOut();
	set({ session: null, profile: null, rivalries: [], lastSync: null });
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
