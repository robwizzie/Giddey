// 2KRatings.com URLs for player headshots and team logos
// Player: https://www.2kratings.com/wp-content/uploads/{First}-{Last}-2K-Rating.png
// Team:   https://www.2kratings.com/wp-content/uploads/{City}-{Name}-Secondary-Logo.svg

/** Convert a name string into URL-safe slug: remove apostrophes/periods, spaces → hyphens */
function slugify(name: string): string {
  return name
    .replace(/['.]/g, '')   // Remove apostrophes and periods
    .replace(/\s+/g, '-')   // Spaces → hyphens
    .trim();
}

// Players whose 2kratings image URL doesn't follow the standard {First}-{Last}-2K-Rating.png pattern
const IMAGE_URL_OVERRIDES: Record<string, string> = {
  anthony_edwards: 'https://www.2kratings.com/wp-content/uploads/Anthony-Edwards-2K-Rating-1.png',
  karl_anthony_towns: 'https://www.2kratings.com/wp-content/uploads/Karl-Anthony-Towns-2K-Rating-1.png',
  naz_reid: 'https://www.2kratings.com/wp-content/uploads/Naz-Reid-2K-Rating-1.png',
  sam_merrill: 'https://www.2kratings.com/wp-content/uploads/Sam-Merrill-2K-Rating-1.png',
  dangelo_russell: 'https://www.2kratings.com/wp-content/uploads/DAngelo-Russell-2K-Rating-1.png',
  jarred_vanderbilt: 'https://www.2kratings.com/wp-content/uploads/Jarred-Vanderbilt-2K-Rating-1.png',
  jordan_mclaughlin: 'https://www.2kratings.com/wp-content/uploads/Jordan-McLaughlin-2K-Rating-1.png',
  royce_oneale: 'https://www.2kratings.com/wp-content/uploads/Royce-ONeale-2K-Rating.png',
  deaaron_fox: 'https://www.2kratings.com/wp-content/uploads/DeAaron-Fox-2K-Rating.png',
  deanthony_melton: 'https://www.2kratings.com/wp-content/uploads/DeAnthony-Melton-2K-Rating.png',
  kelel_ware: 'https://www.2kratings.com/wp-content/uploads/Kelel-Ware-2K-Rating.png',
  jakobe_walter: 'https://www.2kratings.com/wp-content/uploads/JaKobe-Walter-2K-Rating.png',
  hoodie_melo: '/hoodie-carmelo.png',
};

// ── Team full names for 2kratings logo URLs ──
const TEAM_FULL_NAMES: Record<string, string> = {
  ATL: 'Atlanta-Hawks', BOS: 'Boston-Celtics', BKN: 'Brooklyn-Nets',
  CHA: 'Charlotte-Hornets', CHI: 'Chicago-Bulls', CLE: 'Cleveland-Cavaliers',
  DAL: 'Dallas-Mavericks', DEN: 'Denver-Nuggets', DET: 'Detroit-Pistons',
  GSW: 'Golden-State-Warriors', HOU: 'Houston-Rockets', IND: 'Indiana-Pacers',
  LAC: 'Los-Angeles-Clippers', LAL: 'Los-Angeles-Lakers',
  MEM: 'Memphis-Grizzlies', MIA: 'Miami-Heat', MIL: 'Milwaukee-Bucks',
  MIN: 'Minnesota-Timberwolves', NOP: 'New-Orleans-Pelicans',
  NYK: 'New-York-Knicks', OKC: 'Oklahoma-City-Thunder',
  ORL: 'Orlando-Magic', PHI: 'Philadelphia-76ers', PHX: 'Phoenix-Suns',
  POR: 'Portland-Trail-Blazers', SAC: 'Sacramento-Kings',
  SAS: 'San-Antonio-Spurs', TOR: 'Toronto-Raptors', UTA: 'Utah-Jazz',
  WAS: 'Washington-Wizards',
};

/**
 * Get player headshot URL from 2kratings.com.
 */
export function getPlayerHeadshotUrl(
  playerId: string,
  firstName?: string,
  lastName?: string,
): string {
  // Check override map first
  if (IMAGE_URL_OVERRIDES[playerId]) {
    return IMAGE_URL_OVERRIDES[playerId];
  }
  if (firstName && lastName) {
    const first = slugify(firstName);
    const last = slugify(lastName);
    return `https://www.2kratings.com/wp-content/uploads/${first}-${last}-2K-Rating.png`;
  }
  return `https://cdn.nba.com/headshots/nba/latest/260x190/fallback.png`;
}

// Overrides for teams whose logo URL doesn't follow the standard pattern
const TEAM_LOGO_OVERRIDES: Record<string, string> = {
  UTA: 'https://www.2kratings.com/wp-content/uploads/Utah-Jazz-2K-Roster-Secondary-Logo.svg',
  LAC: 'https://www.2kratings.com/wp-content/uploads/Los-Angeles-Clippers-Primary-Logo.svg',
};

/**
 * Get team logo URL (SVG from 2kratings).
 */
export function getTeamLogoUrl(teamAbbr: string): string {
  if (TEAM_LOGO_OVERRIDES[teamAbbr]) return TEAM_LOGO_OVERRIDES[teamAbbr];
  const fullName = TEAM_FULL_NAMES[teamAbbr];
  if (fullName) {
    return `https://www.2kratings.com/wp-content/uploads/${fullName}-Secondary-Logo.svg`;
  }
  const espnMap: Record<string, string> = {
    UTA: 'utah', NOP: 'no', SAS: 'sa', GSW: 'gs',
  };
  const espn = espnMap[teamAbbr] || teamAbbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${espn}.png`;
}
