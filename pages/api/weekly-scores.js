// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// Admin client using your service role key (bypasses RLS)
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

  // 1) Load final game results for that week
  let { data: results = [], error: rErr } = await supabaseAdmin
    .from('game_results')
    .select('away_team,home_team,away_score,home_score,game_week')
    .eq('game_week', week)

  if (rErr) {
    // fallback to table named `results`
    const { data: alt = [], error: rErr2 } = await supabaseAdmin
      .from('results')
      .select('away_team,home_team,away_score,home_score,week')
      .eq('week', week)
    if (rErr2) return res.status(500).json({ error: rErr2.message })
    // normalize to same shape
    results = alt.map(r => ({
      away_team:  r.away_team,
      home_team:  r.home_team,
      away_score: r.away_score,
      home_score: r.home_score,
      game_week:  week
    }))
  }

  // 2) Load **all** picks with their related game data
  const { data: allPicks = [], error: pErr } = await supabaseAdmin
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

  if (pErr) return res.status(500).json({ error: pErr.message })

  // 3) Filter picks to this week
  const picks = allPicks.filter(p => p.games?.week === week)

  // Seed per-user stats
  const statsByUser = {}
  picks.forEach(p => {
    if (!statsByUser[p.user_email]) {
      statsByUser[p.user_email] = {
        correct:      0,
        lockCorrect:  0,
        lockIncorrect:0,
        perfectBonus: 0
      }
    }
  })

  // Tally each pick
  picks.forEach(p => {
    const g = p.games
    // find the matching game result
    const r = results.find(r =>
      (r.home_team === g.home_team && r.away_team === g.away_team) ||
      (r.home_team === g.away_team && r.away_team === g.home_team)
    )
    if (!r) return

    // determine if home covered: home_score + spread > away_score
    const homeCovers = (r.home_score + parseFloat(g.spread)) > r.away_score
    const coveringTeam = homeCovers ? r.home_team : r.away_team

    const u = statsByUser[p.user_email]
    if (p.selected_team === coveringTeam) {
      // +1 for correct
      u.correct += 1
      // extra +1 if this was a lock (net +2)
      if (p.is_lock) u.lockCorrect += 1
    } else {
      // penalty for wrong lock
      if (p.is_lock) u.lockIncorrect += 1
    }
  })

  // perfect-week bonus: if they got 5 correct picks
  Object.values(statsByUser).forEach(u => {
    if (u.correct === 5) u.perfectBonus = 3
  })

  // 4) Build the response array
  const response = Object.entries(statsByUser).map(([email, u]) => {
    const points =
      u.correct +          // every correct pick
      u.lockCorrect * 1 +  // extra +1 for each lockCorrect (so total +2)
      u.lockIncorrect * -2 + // -2 per wrong lock
      u.perfectBonus       // possible +3
    return {
      email,
      correct:       u.correct,
      lockCorrect:   u.lockCorrect,
      lockIncorrect: u.lockIncorrect,
      perfectBonus:  u.perfectBonus,
      weeklyPoints:  points
    }
  })

  res.status(200).json(response)
}
