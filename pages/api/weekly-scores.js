// pages/api/weekly-scores.js

import { createClient } from '@supabase/supabase-js'

// ————————————————————————————————————————————————————————————————
// Initialize an ADMIN Supabase client using your service‐role key
// ————————————————————————————————————————————————————————————————
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: null }
)

export default async function handler(req, res) {
  // 1) parse & validate week
  const week = parseInt(req.query.week, 10)
  if (isNaN(week)) {
    return res.status(400).json({ error: 'Invalid week parameter' })
  }

  // 2) load that week’s final scores from your `results` table
  const { data: results = [], error: resultsError } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score,week')
    .eq('week', week)

  if (resultsError) {
    return res.status(500).json({ error: resultsError.message })
  }
  if (results.length === 0) {
    return res.status(404).json({ error: `No results for week ${week}` })
  }

  // 3) load all picks joined with their games for the same week
  const { data: picks = [], error: picksError } = await supabaseAdmin
    .from('picks')
    .select(`
      user_email,
      selected_team,
      is_lock,
      games (
        id,
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

  // 4) initialize stats object per user
  const statsByUser = {}
  picks.forEach(pick => {
    if (!statsByUser[pick.user_email]) {
      statsByUser[pick.user_email] = {
        correct:       0,
        lockCorrect:   0,
        lockIncorrect: 0,
        perfectBonus:  0
      }
    }
  })

  // 5) for each pick, find its result and update stats
  for (const pick of picks) {
    const g = pick.games

    // trim away extra spaces before matching
    const pickAway  = g.away_team.trim()
    const pickHome  = g.home_team.trim()

    const result = results.find(r =>
      r.home_team.trim() === pickHome &&
      r.away_team.trim() === pickAway
    )
    if (!result) continue

    // determine covering team
    const spread    = parseFloat(g.spread)
    const homeCovers = (result.home_score + spread) > result.away_score
    const coveringTeam = homeCovers
      ? result.home_team.trim()
      : result.away_team.trim()

    // normalize the user’s pick too
    const selected = pick.selected_team.trim()
    const u        = statsByUser[pick.user_email]

    if (selected === coveringTeam) {
      u.correct += 1
      if (pick.is_lock) u.lockCorrect += 1
    } else if (pick.is_lock) {
      u.lockIncorrect += 1
    }
  }

  // 6) perfect‐week bonus
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 7) build final JSON array
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const weeklyPoints =
      u.correct +             // +1 per correct pick
      u.lockCorrect * 2 +     // +2 extra for each correct lock
      u.lockIncorrect * -2 +  // -2 for each wrong lock
      u.perfectBonus          // +3 if 5/5 correct

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
