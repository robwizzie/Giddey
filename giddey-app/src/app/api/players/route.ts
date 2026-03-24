import { NextResponse } from 'next/server';
import { ALL_PLAYERS } from '@/lib/players';
import { TEAMS_MAP } from '@/lib/teams';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '@/lib/images';

/**
 * GET /api/players
 *
 * Returns all available players (base roster + custom cards)
 * in the 2kratings-compatible format.
 */
export async function GET() {
  const data = ALL_PLAYERS.map((p) => {
    const team = TEAMS_MAP[p.teamId];
    return {
      id: p.id,
      first_name: p.firstName,
      last_name: p.lastName,
      position: `${p.position} / ${p.secondaryPosition}`,
      rating: p.overall,
      tier: p.tier,
      team_name: team ? `${team.city} ${team.name}` : p.teamId,
      team_logo: getTeamLogoUrl(p.teamId),
      team_division: team?.division ?? '',
      draft_year: p.draftYear,
      image: getPlayerHeadshotUrl(p.id, p.firstName, p.lastName),
    };
  });

  return NextResponse.json(data);
}
