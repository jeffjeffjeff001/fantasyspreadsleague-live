// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const week = parseInt(req.query.week, 10) || 1

  // 1) load results for that week
  const { data: results = [] } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score')
    .eq('week', week)

  // 2) load picks + game spreads
  const { data: picks = [] } = await supabaseAdmin
    .from('picks')
    .select(`
      id,
      user_email,
      selected_team,
      is_lock,
      games (away_team,home_team,spread)
    `)
    .eq('games.week', week)

  // 3) tally per user with spread logic
  const tally = {}
  picks.forEach(p => {
    const email = p.user_email
    if (!tally[email]) {
      tally[email] = { correct: 0, lockCorrect: 0, lockIncorrect: 0 }
    }
    // find matching result
    const result = results.find(r =>
      r.away_team === p.games.away_team && r.home_team === p.games.home_team
    )
    if (!result) return

    // determine covering team using spread
    // home covers if home_score + spread > away_score
    const coverHome = result.home_score + p.games.spread > result.away_score
    const coveringTeam = coverHome ? p.games.home_team : p.games.away_team

    // award or penalize
    if (p.selected_team === coveringTeam) {
      if (p.is_lock) tally[email].lockCorrect++
      else tally[email].correct++
    } else {
      if (p.is_lock) tally[email].lockIncorrect++
      // incorrect non-lock picks yield 0 points
    }
  })

  // 4) compute final points
  const output = Object.entries(tally).map(([email, u]) => {
    const normalPts  = u.correct * 1
    const lockPts    = u.lockCorrect * 2
    const penaltyPts = u.lockIncorrect * -2
    const subtotal   = normalPts + lockPts + penaltyPts
    const perfect    = (u.correct + u.lockCorrect === 5) ? 3 : 0
    return {
      email,
      correct: u.correct,
      lockCorrect: u.lockCorrect,
      lockIncorrect: u.lockIncorrect,
      perfectBonus: perfect,
      weeklyPoints: subtotal + perfect
    }
  })

  // 5) sort by points desc, then correct picks
  output.sort((a, b) => {
    if (b.weeklyPoints !== a.weeklyPoints) return b.weeklyPoints - a.weeklyPoints
    return b.correct - a.correct
  })

  res.status(200).json(output)
}
