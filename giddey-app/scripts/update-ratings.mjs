#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  2K RATING UPDATES
//
//  2K changes overalls during the season. Paste the new numbers in a
//  plain list and this script applies them to the Versus player data
//  and records what moved (shown in the app as risers & fallers).
//
//    node scripts/update-ratings.mjs ratings.csv
//    node scripts/update-ratings.mjs --url https://…/ratings.csv
//    pbpaste | node scripts/update-ratings.mjs -
//    node scripts/update-ratings.mjs ratings.csv --dry-run
//
//  One player per line, any of these separators: comma, tab, " - ", "|".
//    Shai Gilgeous-Alexander, 98
//    Luka Doncic	96	LAL        ← optional 3rd column: new team (trades)
//  Names match either data file (accents and punctuation are ignored).
//  A player in both files (LeBron today and All-Time LeBron) updates the
//  modern card; prefix the name with "All-Time " to change the legend.
//  Lines starting with # and a "name,ovr" header are skipped.
// ═══════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = { modern: path.join(root, 'src/data/2k27-modern.json'), alltime: path.join(root, 'src/data/2k27-alltime.json') };
const CHANGES = path.join(root, 'src/data/rating-changes.json');

const norm = s =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]/g, '');
const slug = s =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['.]/g, '')
		.replace(/[\s-]+/g, '_');

export function parse(text) {
	const rows = [];
	const bad = [];
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const parts = line
			.split(/\t|,|\||\s+-\s+/)
			.map(s => s.trim())
			.filter(Boolean);
		const ovr = parseInt(parts[1], 10);
		if (/^(name|player)$/i.test(parts[0]) && isNaN(ovr)) continue;
		if (parts.length < 2 || isNaN(ovr) || ovr < 40 || ovr > 99) {
			bad.push(line);
			continue;
		}
		rows.push({ name: parts[0], ovr, team: parts[2] && /^[A-Za-z]{2,4}$/.test(parts[2]) ? parts[2].toUpperCase() : undefined });
	}
	return { rows, bad };
}

export function apply(rows, data, today = new Date().toISOString().slice(0, 10)) {
	const index = new Map();
	// modern wins a plain name; "All-Time <name>" always means the legend
	for (const era of ['alltime', 'modern']) for (const p of data[era]) index.set(norm(`${p.first_name}${p.last_name}`), { p, era });
	for (const p of data.alltime) index.set(norm(`alltime${p.first_name}${p.last_name}`), { p, era: 'alltime' });
	const changes = [];
	const unknown = [];
	for (const r of rows) {
		const hit = index.get(norm(r.name));
		if (!hit) {
			unknown.push(r.name);
			continue;
		}
		const { p, era } = hit;
		const change = { id: `${era === 'alltime' ? 'at_' : ''}${slug(p.first_name)}_${slug(p.last_name)}`, name: `${p.first_name} ${p.last_name}`, from: p.ovr, to: r.ovr };
		if (r.team && era === 'modern' && r.team !== p.team) {
			change.team = { from: p.team, to: r.team };
			p.team = r.team;
		}
		if (p.ovr === r.ovr && !change.team) continue;
		p.ovr = r.ovr;
		changes.push(change);
	}
	return { changes, unknown, update: changes.length ? { date: today, changes } : null };
}

async function main() {
	const args = process.argv.slice(2);
	const dry = args.includes('--dry-run');
	const urlAt = args.indexOf('--url');
	let text;
	if (urlAt >= 0) {
		const res = await fetch(args[urlAt + 1]);
		if (!res.ok) throw new Error(`Couldn't download ${args[urlAt + 1]} (${res.status})`);
		text = await res.text();
	} else {
		const file = args.find(a => !a.startsWith('--'));
		if (!file) {
			console.error('Usage: node scripts/update-ratings.mjs <ratings.csv | - | --url URL> [--dry-run]');
			process.exit(2);
		}
		text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
	}
	const { rows, bad } = parse(text);
	const data = { modern: JSON.parse(fs.readFileSync(FILES.modern, 'utf8')), alltime: JSON.parse(fs.readFileSync(FILES.alltime, 'utf8')) };
	const { changes, unknown, update } = apply(rows, data);

	console.log(`Read ${rows.length} players · ${changes.length} changed · ${unknown.length} not found · ${bad.length} unreadable lines`);
	for (const c of [...changes].sort((a, b) => b.to - b.from - (a.to - a.from))) {
		const d = c.to - c.from;
		console.log(`  ${d > 0 ? '📈' : d < 0 ? '📉' : '🔁'} ${c.name.padEnd(28)} ${c.from} → ${c.to}${d ? ` (${d > 0 ? '+' : ''}${d})` : ''}${c.team ? `  ${c.team.from} → ${c.team.to}` : ''}`);
	}
	if (unknown.length) console.log(`\nNot in the player list (check spelling):\n  ${unknown.join('\n  ')}`);
	if (bad.length) console.log(`\nSkipped lines:\n  ${bad.join('\n  ')}`);
	if (!rows.length) {
		// an empty template (e.g. the file reset after the last update) is not an error
		console.log('\nNo ratings found in the input — nothing to do.');
		return;
	}
	if (dry || !update) {
		console.log(dry ? '\nDry run — nothing written.' : '\nNothing to update.');
		return;
	}
	fs.writeFileSync(FILES.modern, JSON.stringify(data.modern, null, 2) + '\n');
	fs.writeFileSync(FILES.alltime, JSON.stringify(data.alltime, null, 2) + '\n');
	const log = fs.existsSync(CHANGES) ? JSON.parse(fs.readFileSync(CHANGES, 'utf8')) : [];
	log.push(update);
	fs.writeFileSync(CHANGES, JSON.stringify(log, null, 2) + '\n');
	console.log(`\nWrote both data files and logged the update in src/data/rating-changes.json.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	main().catch(e => {
		console.error(e.message);
		process.exit(1);
	});
}
