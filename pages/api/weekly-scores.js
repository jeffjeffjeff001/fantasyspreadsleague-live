// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// Initialize an admin Supabase client using your service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: null }
)

export default async function handler(req, res) {
  const week = parseInt(req.query.week, 10)
  if (isNaN(week)) {
    return res.status(400).json({ error: 'Invalid week parameter' })
  }

  // 1) Load game results for this week from the `results` table
  const { data: results = [], error: resultsError } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score,week')
    .eq('week', week)

  if (resultsError) {
    return res.status(500).json({ error: resultsError.message })
  }
  if (results.length === 0) {
    return res
      .status(404)
      .json({ error: `No results found for week ${week}` })
  }

  // 2) Load all picks for that same week
  const { data: picks = [], error: picksError } = await supabaseAdmin
    .from('picks')
    .select(`
      user_email,
      selected_team,
      is_lock,
      games (
        away_team,
        home_team,
        spread,
        week
      )
    `)
    .eq('games.week', week)

  if (picksError) {
    return res.status(500).json({ error: picksError.message })
  }

  // 3) Tally per-user stats
  const statsByUser = {}
  picks.forEach(pick => {
    const email = pick.user_email
    if (!statsByUser[email]) {
      statsByUser[email] = {
        correct:       0,
        lockCorrect:   0,
        lockIncorrect: 0,
        perfectBonus:  0
      }
    }
  })

  for (const pick of picks) {
    const g = pick.games
    // Find corresponding result row
    const result = results.find(r =>
      (r.home_team === g.home_team && r.away_team === g.away_team) ||
      (r.home_team === g.away_team && r.away_team === g.home_team)
    )
    if (!result) continue

    const spread = parseFloat(g.spread)
    const homeCovers = (result.home_score + spread) > result.away_score
    const coveringTeam = homeCovers ? result.home_team : result.away_team

    const userStats = statsByUser[pick.user_email]
    if (pick.selected_team === coveringTeam) {
      // +1 for correct pick
      userStats.correct += 1
      // +2 bonus for a correct lock (net +3)
      if (pick.is_lock) userStats.lockCorrect += 1
    } else {
      // -2 penalty for a wrong lock
      if (pick.is_lock) userStats.lockIncorrect += 1
    }
  }

  // 4) Apply perfect-week bonus (+3 if 5 correct)
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 5) Build response array
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const weeklyPoints =
      u.correct +               // +1 per correct pick
      u.lockCorrect * 2 +       // +2 bonus per correct lock
      u.lockIncorrect * -2 +    // -2 per wrong lock
      u.perfectBonus            // +3 for perfect week

    return {
      email,
      correct:       u.correct,
      lockCorrect:   u.lockCorrect,
      lockIncorrect: u.lockIncorrect,
      perfectBonus:  u.perfectBonus,
      weeklyPoints
    }
  })

  return res.status(200).json(response)
}
