# Versus accounts (optional)

Versus works with no backend: every game is saved on the phone it was played on, any number of rivalries can share a phone, and two phones can be merged with a sync link or QR code.

Connecting a Supabase project turns on these features:

- **Play on separate devices** (no account needed): each coach drafts, spins and votes on their own phone, and an optional main screen (TV or laptop) shows what both coaches are allowed to see. Runs over Supabase Realtime.
- **Online leagues**: friends join with an invite code and log games from their own phones.
- **Public career pages**: a link anyone can open.

Accounts add three things on top of that:

- **Cloud backup.** Every rivalry you create or join is stored in the cloud. Sign in on any phone, or in the installed home-screen app, and it's all there.
- **One shared record.** Invite your opponent with a link or an 8-character code. Games either of you logs show up for both of you.
- **Your franchise guys follow you** from device to device.

Accounts run on [Supabase](https://supabase.com) (free tier), which provides sign-in, Postgres and row-level security. The site stays a static GitHub Pages export: the browser talks to Supabase directly, and the anon key is meant to be public. The row-level security policies in the migration are what keep each rivalry private to its two members.

## Setup (about 10 minutes)

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) (the free plan is enough).

2. **Create the tables.** Open **SQL Editor → New query** and run both migrations, in order:
   1. [`migrations/20261013000000_versus_accounts.sql`](migrations/20261013000000_versus_accounts.sql) (profiles, rivalries, games)
   2. [`migrations/20261014000000_versus_leagues_careers.sql`](migrations/20261014000000_versus_leagues_careers.sql) (leagues, career pages)

   If you use the Supabase CLI, `supabase link` then `supabase db push` does the same thing. Live rooms use Realtime broadcast, which is on by default; nothing to create.

3. **Allow the redirect.** Go to **Authentication → URL Configuration**:
   - Site URL: `https://playgiddey.com/versus`
   - Redirect URLs: `https://playgiddey.com/versus`, plus `http://localhost:3000/versus` for local development

4. **Send a 6-digit code in the sign-in email.** Go to **Authentication → Emails → Magic Link** and make sure the template includes the code. The code is what lets people sign in inside the installed iPhone app, where a tapped link opens Safari instead.

   ```html
   <h2>Your Giddey Versus sign-in</h2>
   <p>Enter this code in the app: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```

   Supabase's built-in email sender only allows a few emails an hour. For real use, add your own SMTP under **Project Settings → Authentication → SMTP**. Resend, Postmark and SES all work, and Resend has a free tier.

5. **Optional: Google sign-in.** Enable **Authentication → Providers → Google** with a Google OAuth client, then set the `SUPABASE_GOOGLE` variable below to `1`.

6. **Point the site at the project.** In the GitHub repo go to **Settings → Secrets and variables → Actions → Variables** and add:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | Project Settings → API → Project URL |
   | `SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
   | `SUPABASE_GOOGLE` | `1` (only if you did step 5) |

7. **Redeploy.** Re-run **Actions → Deploy to GitHub Pages**, or push to `main`. **Account** and **Play on separate devices** then appear in the Versus **⋯** menu.

For local development, put the same values in `giddey-app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## How it works

| Table | What's in it | Who can see it |
|---|---|---|
| `profiles` | display name, franchise guys | you, and people you share a rivalry with |
| `rivalries` | the two seat names, invite code, last reset | its members |
| `rivalry_members` | which account holds seat 0 / seat 1 | its members |
| `games` | each game as the app's own JSON, keyed by timestamp + names | its members |
| `leagues` | name, 3–12 coach names, format, invite code | its members (the commissioner edits) |
| `league_members` | which account plays as which league name | its members |
| `league_games` | each league game, as JSON | its members |
| `careers` | a published career snapshot and its share slug | **everyone** — publishing is the opt-in |

- **Creating a rivalry** gives you seat 0. The other name waits as a guest until someone joins with the invite code (`join_rivalry` RPC).
- **The phone's local log is still what the app reads from.** Sync pulls a rivalry's cloud games into it and pushes up any local games between those two names. Games played before signing up upload the first time you link that pair.
- **Games never change after they're logged.** They're de-duplicated by key, so syncing as often as you like is safe.
- **Resetting a record** sets `reset_at`. Every phone drops its older copies on the next sync instead of uploading them again.
- **Live rooms** are Realtime broadcast channels named after a random 6-character code. No rows are written.
  - Each device takes a seat: coach 1, coach 2, or main screen (links end in `-1`, `-2` or `-S`). One device hosts and runs the shared steps (coin toss, game-day rules, final score).
  - The coach whose turn it is sends the new state; the others swap it in. Wheel, slot-machine and coin results are replayed on every screen.
  - Private moves stay on the coach's own phone: their own pack in split rounds, blind-bid picks, predictions and Player of the Game votes. The other phone and the main screen see card backs or "voting…" until it's revealed.
  - Privacy here is a screen rule between friends, not a security boundary: the shared state travels to every device in the room.
- **The policies are tested** on a local Postgres 16 with a stub `auth` schema:
  - strangers see nothing
  - nobody can log a game as someone else
  - invite codes can't be edited
  - a third person can't join a full rivalry
  - you can only edit your own profile
