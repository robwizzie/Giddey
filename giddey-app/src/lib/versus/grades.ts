import { Category, lineupChemistry } from './chemistry';
import { BAND_INFO, bestLineup, Grade, LogEntry, rosterSizeFor, Side, teamOvr, VersusState } from './engine';
import { getVersusPlayer } from './pool';

// ═══════════════════════════════════════════════════════════════
//  DRAFT GRADES — a letter grade and a one-line analyst take for each
//  team, plus steal / reach callouts on individual picks. Everything is
//  deterministic: the same rosters and picks always get the same grade.
// ═══════════════════════════════════════════════════════════════

export interface Callout {
	kind: 'steal' | 'reach';
	text: string;
}

/** Is this pick a steal or a reach? */
export function pickCallout(s: VersusState, e: LogEntry): Callout | null {
	const p = getVersusPlayer(e.id);
	if (!p) return null;
	// auction: price vs what he was worth
	if (e.price !== undefined) {
		const v = e.value ?? 0;
		if (v >= 6 && e.price <= v * 0.6) return { kind: 'steal', text: `Steal — worth ~$${v}, went for $${e.price}` };
		if (e.price >= v * 1.5 + 5) return { kind: 'reach', text: `Overpay — worth ~$${v}` };
		return null;
	}
	if (e.best !== undefined && p.overall <= e.best - 3) return { kind: 'reach', text: `Reach — a ${e.best} was on the board` };
	// steal: clearly better than what the other coach got in the same round
	const band = s.draft?.blueprints[e.side]?.[e.round];
	const theirs = s.draft?.log.find(x => x.side !== e.side && x.round === e.round && x.price === undefined);
	const q = theirs ? getVersusPlayer(theirs.id) : undefined;
	if (band && band !== 'superstar' && q && p.overall >= q.overall + 3) return { kind: 'steal', text: `Steal — ${p.overall - q.overall} OVR better than ${q.lastName} in the ${BAND_INFO[band].label} round` };
	return null;
}

const STRONG: Record<Category, string> = {
	shooting: 'Elite spacing',
	playmaking: 'The ball never sticks',
	rim: 'Walls up at the rim',
	rebounding: 'Owns the glass',
	depth: 'Deep bench',
};

const WEAK: Record<Category, string> = {
	shooting: 'nobody to stretch the floor',
	playmaking: 'no true playmaker',
	rim: 'no rim protection',
	rebounding: 'soft on the boards',
	depth: 'a thin bench',
};

const LETTERS: [number, string][] = [
	[97, 'A+'],
	[93, 'A'],
	[90, 'A-'],
	[87, 'B+'],
	[83, 'B'],
	[80, 'B-'],
	[77, 'C+'],
	[73, 'C'],
	[70, 'C-'],
	[0, 'D'],
];

export function letterFor(score: number): string {
	return LETTERS.find(([min]) => score >= min)![1];
}

export function gradeColor(letter: string): string {
	if (letter.startsWith('A')) return '#22c55e';
	if (letter.startsWith('B')) return '#38bdf8';
	if (letter.startsWith('C')) return '#f59e0b';
	return '#ef4444';
}

/** Grade both teams from the last draft */
export function draftGrades(s: VersusState): [Grade, Grade] {
	const log = s.draft?.log ?? [];
	const calls = log.map(e => ({ e, c: pickCallout(s, e) }));
	const grade = (side: Side): Grade => {
		const team = s.teams[side];
		const ovr = teamOvr(team);
		const opp = teamOvr(s.teams[side === 0 ? 1 : 0]);
		const lu = bestLineup(team);
		const oop = lu.starters.filter(x => x.fit === 'out' || x.fit === 'empty').length;
		const chem = lineupChemistry(team, rosterSizeFor(s.settings, side));
		const theirs = lineupChemistry(s.teams[side === 0 ? 1 : 0], rosterSizeFor(s.settings, side === 0 ? 1 : 0));
		const cats: Category[] = ['shooting', 'playmaking', 'rim', 'rebounding'];
		// strengths and holes are judged against tonight's opponent
		const edge = (c: Category) => chem.ratings[c] - theirs.ratings[c];
		const best = cats.reduce((a, b) => (edge(b) > edge(a) ? b : a));
		const worst = cats.reduce((a, b) => (edge(b) < edge(a) ? b : a));
		const spread = Math.max(0, -edge(worst)) * 2;
		const mine = calls.filter(x => x.e.side === side);
		const steals = mine.filter(x => x.c?.kind === 'steal');
		const reaches = mine.filter(x => x.c?.kind === 'reach').length;

		const score = Math.round(85 + (ovr - opp) * 4 - oop * 3 + Math.min(4, steals.length * 1.5) - Math.min(6, reaches * 2) + Math.max(-4, 2 - spread / 4));
		const letter = letterFor(score);

		let take = `${edge(best) > 0 ? STRONG[best] : 'Outgunned everywhere'}, ${oop ? 'but someone’s playing out of position' : spread <= 4 ? 'no real holes' : WEAK[worst]}.`;
		const top = steals.map(x => getVersusPlayer(x.e.id)).sort((a, b) => (b?.overall ?? 0) - (a?.overall ?? 0))[0];
		if (top) take += ` Steal of the draft: ${top.lastName}.`;
		else if (reaches >= 2) take += ` Reached ${reaches} times.`;
		return { letter, score, take };
	};
	return [grade(0), grade(1)];
}
