// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// supabaseAdmin with service role key bypasses RLS
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

  // 1) Load results from game_results table
  let { data: results = [], error } = await supabaseAdmin
    .from('game_results')
    .select('away_team,home_team,away_score,home_score,game_week')
    .eq('game_week', week)

  if (error) {
    // fallback to a table named `results`
    const { data: alt = [], error: err2 } = await supabaseAdmin
      .from('results')
      .select('away_team,home_team,away_score,home_score,week')
      .eq('week', week)
    if (err2) {
      return res.status(500).json({ error: err2.message })
    }
    results = alt.map(r => ({
      away_team:  r.away_team,
      home_team:  r.home_team,
      away_score: r.away_score,
      home_score: r.home_score
    }))
  }

  // 2) Load all picks for that week
  const { data: picks = [], error: picksError } = await supabaseAdmin
    .from('picks')
    .select('user_email,selected_team,is_lock,games(away_team,home_team,spread,week)')
    .eq('games.week', week)

  if (picksError) {
    return res.status(500).json({ error: picksError.message })
  }

  // 3) Tally by user
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

  picks.forEach(p => {
    const g = p.games
    // find matching result
    const r = results.find(r =>
      (r.home_team === g.home_team && r.away_team === g.away_team) ||
      (r.home_team === g.away_team && r.away_team === g.home_team)
    )
    if (!r) return

    // determine coverage
    const homeCovers = (r.home_score + g.spread) > r.away_score
    const coveringTeam = homeCovers ? r.home_team : r.away_team

    const u = statsByUser[p.user_email]
    if (p.selected_team === coveringTeam) {
      // +1 for any correct
      u.correct += 1
      // extra +1 if lock -> total +2
      if (p.is_lock) u.lockCorrect += 1
    } else {
      // penalty for wrong lock
      if (p.is_lock) u.lockIncorrect += 1
    }
  })

  // perfect-week bonus
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 4) Build response
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const weeklyPoints =
      // each correct: +1
      u.correct
      // each lock-correct gives +1 more (so lock correct total = 2)
      + u.lockCorrect * 1
      // each lock-incorrect is -2
      + u.lockIncorrect * -2
      // perfect-week
      + u.perfectBonus

    return {
      email,
      correct:      u.correct,
      lockCorrect:  u.lockCorrect,
      lockIncorrect:u.lockIncorrect,
      perfectBonus: u.perfectBonus,
      weeklyPoints
    }
  })

  return res.status(200).json(response)
}
