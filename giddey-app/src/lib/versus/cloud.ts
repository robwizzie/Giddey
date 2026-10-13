import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { loadRivalry, RivalryGame, saveRivalry } from './rivalry';
import { mergeGames } from './sync';

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

function client(): Promise<SupabaseClient> {
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
	const { data, error } = await sb.from('profiles').select('id, name, favorites').eq('id', uid).maybeSingle();
	if (error) throw error;
	return data as Profile | null;
}

async function loadRivalries(sb: SupabaseClient): Promise<CloudRivalry[]> {
	const uid = state.session?.user.id;
	if (!uid) return [];
	const { data, error } = await sb
		.from('rivalries')
			.select('id, name_a, name_b, invite_code, created_by, reset_at, rivalry_members(seat, user_id, profiles(name)), games(count)')
		.order('created_at', { ascending: false });
	if (error) throw error;
	type Row = {
		id: string;
		name_a: string;
		name_b: string;
		invite_code: string;
		created_by: string;
		reset_at: string | null;
		rivalry_members: { seat: 0 | 1; user_id: string; profiles: { name: string } | null }[];
		games: { count: number }[];
	};
	return ((data ?? []) as unknown as Row[]).map(r => {
		const members: CloudRivalry['members'] = [null, null];
		for (const m of r.rivalry_members) members[m.seat] = { id: m.user_id, name: m.profiles?.name ?? '' };
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
	const { data, error } = await sb.from('profiles').update(patch).eq('id', uid).select('id, name, favorites').single();
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
			// franchise guys travel with each person's profile
			const favorites: Record<string, string[]> = {};
			if (state.profile) {
				for (const r of state.rivalries) favorites[r.names[r.mySeat]] = state.profile.favorites;
				const others = state.rivalries.flatMap(r => r.members.filter((m): m is NonNullable<typeof m> => !!m && m.id !== uid).map(m => ({ id: m.id, name: r.names[r.members.indexOf(m)] })));
				if (others.length) {
					const { data } = await sb.from('profiles').select('id, favorites').in('id', [...new Set(others.map(o => o.id))]);
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
