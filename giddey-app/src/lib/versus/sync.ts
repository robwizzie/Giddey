import { getPool } from './pool';
import { loadRivalry, RivalryGame, saveRivalry } from './rivalry';

// ═══════════════════════════════════════════════════════════════
//  PHONE SYNC — there's no server, so the rivalry log travels inside a
//  link. Player ids become pool indexes, the JSON is deflated and
//  base64url'd, and the other phone merges whatever games it's missing
//  (matched by timestamp + coach names, so re-importing is harmless).
// ═══════════════════════════════════════════════════════════════

export interface SyncPayload {
	v: 1;
	games: RivalryGame[];
	/** franchise guys by coach name */
	favorites: Record<string, string[]>;
}

type Packed = { v: 1; g: unknown[]; f: Record<string, number[]> };

const ids = () => getPool('mixed').map(p => p.id);
let indexCache: Map<string, number> | null = null;
const indexOf = () => (indexCache ??= new Map(ids().map((id, i) => [id, i])));

const toIdx = (list: string[] | undefined) => (list ?? []).map(id => indexOf().get(id) ?? -1).filter(i => i >= 0);
const fromIdx = (list: number[] | undefined) => {
	const all = ids();
	return (list ?? []).map(i => all[i]).filter(Boolean);
};

function pack(p: SyncPayload): Packed {
	return {
		v: 1,
		g: p.games.map(g => ({ ...g, rosters: [toIdx(g.rosters[0]), toIdx(g.rosters[1])], potg: toIdx(g.potg) })),
		f: Object.fromEntries(Object.entries(p.favorites).map(([k, v]) => [k, toIdx(v)])),
	};
}

function unpack(p: Packed): SyncPayload {
	return {
		v: 1,
		games: (p.g as (RivalryGame & { rosters: [number[], number[]]; potg?: number[] })[]).map(g => ({
			...g,
			rosters: [fromIdx(g.rosters?.[0]), fromIdx(g.rosters?.[1])] as [string[], string[]],
			potg: fromIdx(g.potg),
		})),
		favorites: Object.fromEntries(Object.entries(p.f ?? {}).map(([k, v]) => [k, fromIdx(v)])),
	};
}

const b64url = (bytes: Uint8Array) => {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
	const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
	return new Uint8Array(await out.arrayBuffer());
}

/** "z…" = deflated, "j…" = plain (browsers without CompressionStream) */
export async function encodeSync(p: SyncPayload): Promise<string> {
	const raw = new TextEncoder().encode(JSON.stringify(pack(p)));
	if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
	return 'j' + b64url(raw);
}

export async function decodeSync(code: string): Promise<SyncPayload | null> {
	try {
		// accept a whole link, a "#sync=…" fragment or the bare code
		const m = code.trim().match(/sync=([A-Za-z0-9_-]+)/);
		const c = m ? m[1] : code.trim();
		const kind = c[0];
		let bytes: Uint8Array = unb64url(c.slice(1));
		if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
		else if (kind !== 'j') return null;
		const packed = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
		if (packed?.v !== 1 || !Array.isArray(packed.g)) return null;
		return unpack(packed);
	} catch {
		return null;
	}
}

export function syncLink(code: string): string {
	const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : 'https://playgiddey.com/versus';
	return `${base}#sync=${code}`;
}

const keyOf = (g: RivalryGame) => `${g.ts}|${g.names.map(n => n.trim().toLowerCase()).sort().join('|')}`;

/** What this phone would send: every logged game, plus both coaches' franchise guys */
export function buildPayload(names: [string, string], favorites: [string[], string[]], games = loadRivalry()): SyncPayload {
	return { v: 1, games, favorites: { [names[0]]: favorites[0], [names[1]]: favorites[1] } };
}

/** Link with as many of the newest games as fit a scannable QR code */
export async function qrSized(p: SyncPayload, maxChars = 1400): Promise<{ link: string; count: number }> {
	const sorted = [...p.games].sort((a, b) => a.ts - b.ts);
	let lo = 0;
	let hi = sorted.length;
	let best = { link: syncLink(await encodeSync({ ...p, games: [] })), count: 0 };
	// binary search on how many recent games fit
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const link = syncLink(await encodeSync({ ...p, games: sorted.slice(sorted.length - mid) }));
		if (link.length <= maxChars) {
			best = { link, count: mid };
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return best;
}

export interface MergeResult {
	added: number;
	total: number;
	/** franchise guys to add, per seat of the current coaches */
	favorites: [string[], string[]];
}

/** Preview what an import would add (doesn't save) */
export function previewMerge(p: SyncPayload, names: [string, string], favorites: [string[], string[]]): MergeResult {
	const have = new Set(loadRivalry().map(keyOf));
	const added = p.games.filter(g => !have.has(keyOf(g))).length;
	const norm = (n: string) => n.trim().toLowerCase();
	const favs: [string[], string[]] = [[], []];
	for (const [name, list] of Object.entries(p.favorites)) {
		const seat = names.findIndex(n => norm(n) === norm(name));
		if (seat < 0) continue;
		favs[seat] = list.filter(id => !favorites[seat].includes(id));
	}
	return { added, total: p.games.length, favorites: favs };
}

/** Add the games this phone is missing; returns how many were new */
export function mergeGames(p: SyncPayload): number {
	const mine = loadRivalry();
	const have = new Set(mine.map(keyOf));
	const fresh = p.games.filter(g => !have.has(keyOf(g)));
	if (fresh.length) saveRivalry([...mine, ...fresh].sort((a, b) => a.ts - b.ts));
	return fresh.length;
}
