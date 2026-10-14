// @ts-nocheck — Deno code (Supabase Edge Function); the Next.js tsconfig would otherwise type-check it.
// notify-turn — Web Push "your turn" alerts for Versus live rooms.
//
// Called by a Database Webhook on versus_rooms UPDATE (see supabase/README.md).
// When the room's `turn` changed to a coach seat, every browser subscribed to
// that seat (versus_push) gets a push; the app's service worker shows it.
// Dead subscriptions (404 / 410) are deleted.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL),
// optional WEBHOOK_SECRET (then the webhook must send it in an x-webhook-secret header).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy: supabase functions deploy notify-turn --no-verify-jwt

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Room {
	code: string;
	state: Record<string, unknown> | null;
	version: number;
	turn: number | null;
}

interface WebhookPayload {
	type: 'INSERT' | 'UPDATE' | 'DELETE';
	table: string;
	record: Room | null;
	old_record: Room | null;
}

const env = (k: string) => Deno.env.get(k) ?? '';

webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:admin@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
type Any = any;

/** "Your pick, Rob" / "Round 4 · Dave took a player" — kept simple; the app has the full wording */
function message(room: Room, side: number): { title: string; body: string } {
	const s = (room.state ?? {}) as Any;
	const names: string[] = s.settings?.names ?? ['Coach 1', 'Coach 2'];
	const name = names[side] || `Coach ${side + 1}`;
	const rival = names[side ? 0 : 1] || 'Your rival';
	const phase: string = s.phase ?? '';
	const d = s.draft;
	if (phase === 'draft' && d) {
		const round = `Round ${(d.round ?? 0) + 1}`;
		if (d.auction) return { title: d.auction.lot ? `Your bid, ${name}` : `Your nomination, ${name}`, body: `${round} · ${rival} is waiting on you` };
		const last = d.lastPick ?? d.log?.[d.log.length - 1];
		const who = last ? names[last.side] : null;
		return { title: `Your pick, ${name}`, body: who ? `${round} · ${who} just picked` : `${round} · you're on the clock` };
	}
	const titles: Record<string, string> = {
		theme: 'Your spin',
		favorites: 'Pick your franchise guy',
		keepers: 'Pick your keeper',
		dynasty: 'Your keep',
		bans: 'Your bans',
		board: 'Your scouting report',
		trade: s.trade?.proposal ? 'Trade offer for you' : 'Your trade',
		equalizer: 'Your move',
		boosts: 'Your move',
		gameday: 'Your challenge spin',
		postgame: 'Your revenge spin',
	};
	return { title: `${titles[phase] ?? 'Your turn'}, ${name}`, body: `${rival} is waiting on you · Giddey Versus` };
}

Deno.serve(async req => {
	if (req.method !== 'POST') return new Response('POST only', { status: 405 });
	const secret = env('WEBHOOK_SECRET');
	if (secret && req.headers.get('x-webhook-secret') !== secret) return new Response('forbidden', { status: 403 });

	let payload: WebhookPayload;
	try {
		payload = await req.json();
	} catch {
		return new Response('bad json', { status: 400 });
	}
	const room = payload.record;
	if (payload.table !== 'versus_rooms' || !room || payload.type === 'DELETE') return Response.json({ skipped: 'not a room update' });
	const turn = room.turn;
	if (turn !== 0 && turn !== 1) return Response.json({ skipped: 'nobody in particular is up' });
	if (payload.type === 'UPDATE' && payload.old_record?.turn === turn) return Response.json({ skipped: 'turn unchanged' });

	const { data: subs, error } = await db.from('versus_push').select('endpoint, subscription').eq('code', room.code).eq('side', turn);
	if (error) return Response.json({ error: error.message }, { status: 500 });

	const msg = message(room, turn);
	const body = JSON.stringify({ ...msg, url: `/versus#live=${room.code}-${turn + 1}`, tag: 'giddey-turn' });
	const dead: string[] = [];
	let sent = 0;
	await Promise.all(
		(subs ?? []).map(async ({ endpoint, subscription }) => {
			try {
				await webpush.sendNotification(subscription, body, { TTL: 60 * 60 * 6, urgency: 'high', topic: `giddey-${room.code}` });
				sent++;
			} catch (e) {
				const code = (e as { statusCode?: number }).statusCode;
				if (code === 404 || code === 410) dead.push(endpoint);
				else console.error('push failed', code, (e as Error).message);
			}
		}),
	);
	if (dead.length) await db.from('versus_push').delete().in('endpoint', dead);
	return Response.json({ sent, pruned: dead.length });
});
