import { getVersusPlayer, VersusPlayer } from './pool';
import { Challenge, Difficulty, DIFFICULTY_INFO, setRosterResolver, WheelSegment } from './wheels';

// ═══════════════════════════════════════════════════════════════
//  ROSTER CHALLENGES — challenges about the players you drafted
//  ("LeBron scores 25+"). The id carries the player, so the result
//  screen and the rivalry log can show it later: r:<template>:<id>
// ═══════════════════════════════════════════════════════════════

type Pickr = (roster: VersusPlayer[]) => VersusPlayer | undefined;

interface Template {
	id: string;
	difficulty: Difficulty;
	/** which of your players it's about */
	who: Pickr;
	title: (p: VersusPlayer) => string;
	desc: (p: VersusPlayer) => string;
	needsBench?: boolean;
}

const byOvr = (r: VersusPlayer[]) => [...r].sort((a, b) => b.overall - a.overall);
const at = (pos: string): Pickr => r => byOvr(r).find(p => p.position === pos);
const last = (n: string) => n.split(' ').slice(-1)[0];

const TEMPLATES: Template[] = [
	{ id: 'star20', difficulty: 'medium', who: r => byOvr(r)[0], title: p => `${last(p.lastName)} drops 20`, desc: p => `${p.firstName} ${p.lastName}, your best player, scores 20+ points.` },
	{ id: 'star30', difficulty: 'hard', who: r => byOvr(r)[0], title: p => `${last(p.lastName)} goes for 30`, desc: p => `${p.firstName} ${p.lastName} scores 30+ points.` },
	{ id: 'two15', difficulty: 'medium', who: r => byOvr(r)[1], title: p => `${last(p.lastName)} gets 15`, desc: p => `Your second option, ${p.firstName} ${p.lastName}, scores 15+.` },
	{ id: 'low3', difficulty: 'easy', who: r => byOvr(r).slice(-1)[0], title: p => `${last(p.lastName)} hits a three`, desc: p => `Your lowest-rated player, ${p.firstName} ${p.lastName}, makes a three-pointer.` },
	{ id: 'low8', difficulty: 'hard', who: r => byOvr(r).slice(-1)[0], title: p => `${last(p.lastName)} scores 8`, desc: p => `Your lowest-rated player, ${p.firstName} ${p.lastName}, scores 8+.` },
	{ id: 'c8', difficulty: 'medium', who: at('C'), title: p => `${last(p.lastName)} cleans the glass`, desc: p => `${p.firstName} ${p.lastName} grabs 8+ rebounds.` },
	{ id: 'pg6', difficulty: 'medium', who: at('PG'), title: p => `${last(p.lastName)} runs the show`, desc: p => `${p.firstName} ${p.lastName} dishes 6+ assists.` },
	{ id: 'dd', difficulty: 'hard', who: r => byOvr(r).find(p => p.position === 'PF' || p.position === 'C') ?? byOvr(r)[0], title: p => `${last(p.lastName)} double-double`, desc: p => `${p.firstName} ${p.lastName} records a double-double.` },
	{ id: 'dunk', difficulty: 'easy', who: r => byOvr(r).find(p => p.position === 'SF' || p.position === 'PF'), title: p => `${last(p.lastName)} throws it down`, desc: p => `${p.firstName} ${p.lastName} dunks at least twice.` },
	{ id: 'bench10', difficulty: 'medium', needsBench: true, who: r => byOvr(r)[5], title: p => `${last(p.lastName)} sparks the bench`, desc: p => `${p.firstName} ${p.lastName} scores 10+ off the bench.` },
];

function resolve(id: string): Challenge | undefined {
	const [, tid, pid] = id.split(':');
	const t = TEMPLATES.find(x => x.id === tid);
	const p = getVersusPlayer(pid ?? '');
	if (!t || !p) return undefined;
	return { id, title: t.title(p), desc: t.desc(p), difficulty: t.difficulty, needsBench: t.needsBench };
}

setRosterResolver(resolve);

/** Wheel segments for challenges about this coach's own roster */
export function rosterChallengeSegments(roster: string[], difficulty?: Difficulty): (WheelSegment & { challenge: Challenge })[] {
	const players = roster.map(id => getVersusPlayer(id)).filter((p): p is VersusPlayer => !!p);
	const out: (WheelSegment & { challenge: Challenge })[] = [];
	const used = new Set<string>();
	for (const t of TEMPLATES) {
		if (difficulty && t.difficulty !== difficulty) continue;
		if (t.needsBench && players.length <= 5) continue;
		const p = t.who(players);
		// one challenge per player keeps the wheel varied
		if (!p || used.has(`${t.id}:${p.id}`)) continue;
		used.add(`${t.id}:${p.id}`);
		const c = resolve(`r:${t.id}:${p.id}`)!;
		out.push({ id: c.id, label: c.title, color: DIFFICULTY_INFO[t.difficulty].color, weight: DIFFICULTY_INFO[t.difficulty].weight, challenge: c });
	}
	return out;
}
