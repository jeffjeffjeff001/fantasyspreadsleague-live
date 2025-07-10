// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// Admin client (uses your service role key to bypass RLS)
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

  // 1) Load game results (from game_results, fallback to results)
  let { data: results = [], error: rErr } = await supabaseAdmin
    .from('game_results')
    .select('away_team,home_team,away_score,home_score,game_week')
    .eq('game_week', week)

  if (rErr) {
    const { data: alt = [], error: rErr2 } = await supabaseAdmin
      .from('results')
      .select('away_team,home_team,away_score,home_score,week')
      .eq('week', week)
    if (rErr2) {
      return res.status(500).json({ error: rErr2.message })
    }
    // normalize shape
    results = alt.map(r => ({
      away_team: r.away_team,
      home_team: r.home_team,
      away_score: r.away_score,
      home_score: r.home_score,
      game_week: week
    }))
  }

  // 2) Load all picks for that week (joined on games.week)
  const { data: picks = [], error: pErr } = await supabaseAdmin
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

  if (pErr) {
    return res.status(500).json({ error: pErr.message })
  }

  // 3) Tally stats per user
  const statsByUser = {}
  picks.forEach(p => {
    if (!statsByUser[p.user_email]) {
      statsByUser[p.user_email] = {
        correct: 0,
        lockCorrect: 0,
        lockIncorrect: 0,
        perfectBonus: 0
      }
    }
  })

  for (const p of picks) {
    const g = p.games
    // find matching result
    const r = results.find(r =>
      (r.home_team === g.home_team && r.away_team === g.away_team) ||
      (r.home_team === g.away_team && r.away_team === g.home_team)
    )
    if (!r) continue

    // determine if home covers: home_score + spread > away_score
    const spread = parseFloat(g.spread)  // ensure numeric
    const homeCovers = (r.home_score + spread) > r.away_score
    const coveringTeam = homeCovers ? r.home_team : r.away_team

    const u = statsByUser[p.user_email]
    if (p.selected_team === coveringTeam) {
      // +1 for correct pick
      u.correct += 1
      // +2 bonus for correct lock
      if (p.is_lock) u.lockCorrect += 1
    } else {
      // -2 penalty for wrong lock
      if (p.is_lock) u.lockIncorrect += 1
    }
  }

  // perfect-week bonus: +3 if all 5 picks correct
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 4) Build and return the response
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const weeklyPoints =
      // each correct pick = +1
      u.correct
      // each correct lock = additional +2
      + u.lockCorrect * 2
      // each wrong lock = -2
      + u.lockIncorrect * -2
      // perfect-week bonus
      + u.perfectBonus

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
