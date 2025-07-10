// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// Admin client (service role key bypasses RLS)
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

  // 1) Load game results for that week from whichever table/column exists
  let results = []

  // Try table `game_results` + column `game_week`
  let { data: r1 = [], error: e1 } = await supabaseAdmin
    .from('game_results')
    .select('away_team,home_team,away_score,home_score,game_week')
    .eq('game_week', week)

  if (!e1 && r1.length) {
    results = r1
  } else {
    // Try table `results` + column `game_week`
    let { data: r2 = [], error: e2 } = await supabaseAdmin
      .from('results')
      .select('away_team,home_team,away_score,home_score,game_week')
      .eq('game_week', week)

    if (!e2 && r2.length) {
      results = r2
    } else {
      // Try table `results` + column `week`
      let { data: r3 = [], error: e3 } = await supabaseAdmin
        .from('results')
        .select('away_team,home_team,away_score,home_score,week')
        .eq('week', week)

      if (e3) {
        return res.status(500).json({ error: e3.message })
      }
      // normalize shape
      results = r3.map(r => ({
        away_team:  r.away_team,
        home_team:  r.home_team,
        away_score: r.away_score,
        home_score: r.home_score,
        game_week:  week
      }))
    }
  }

  if (results.length === 0) {
    return res
      .status(404)
      .json({ error: `No game results found for week ${week}` })
  }

  // 2) Pull all picks for that week
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
        correct:       0,
        lockCorrect:   0,
        lockIncorrect: 0,
        perfectBonus:  0
      }
    }
  })

  // Evaluate each pick
  for (let p of picks) {
    const g = p.games
    // find the corresponding result row
    const r = results.find(r =>
      (r.home_team === g.home_team && r.away_team === g.away_team) ||
      (r.home_team === g.away_team && r.away_team === g.home_team)
    )
    if (!r) continue

    // compute cover: home_score + spread > away_score
    const spread = parseFloat(g.spread)
    const homeCovers = (r.home_score + spread) > r.away_score
    const coveringTeam = homeCovers ? r.home_team : r.away_team

    const u = statsByUser[p.user_email]
    if (p.selected_team === coveringTeam) {
      // +1 for correct
      u.correct += 1
      // +2 bonus if lock
      if (p.is_lock) u.lockCorrect += 1
    } else {
      // -2 penalty for wrong lock
      if (p.is_lock) u.lockIncorrect += 1
    }
  }

  // Perfect-week bonus +3 if they got all 5 correct
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 4) Format response
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const weeklyPoints =
      // each correct pick
      u.correct
      // each correct lock gives +2 more
      + u.lockCorrect * 2
      // each incorrect lock is -2
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
