// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const week = parseInt(req.query.week, 10) || 1

  // 1) load results
  const { data: results = [] } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score')
    .eq('week', week)

  // 2) load picks + games
  const { data: picks = [] } = await supabaseAdmin
    .from('picks')
    .select(`
      id,
      user_email,
      selected_team,
      is_lock,
      games (id, away_team, home_team, week)
    `)
    .eq('games.week', week)

  // 3) map winners
  const winners = {}
  results.forEach(r => {
    const key = `${r.away_team}@${r.home_team}`
    winners[key] = r.home_score > r.away_score ? r.home_team : r.away_team
  })

  // 4) tally per user
  const tally = {}
  picks.forEach(p => {
    const email = p.user_email
    if (!tally[email]) {
      tally[email] = { email, correct: 0, lockCorrect: 0, lockIncorrect: 0 }
    }
    const gameKey = `${p.games.away_team}@${p.games.home_team}`
    const winner = winners[gameKey]
    if (p.selected_team === winner) {
      if (p.is_lock) tally[email].lockCorrect++
      else tally[email].correct++
    } else {
      if (p.is_lock) tally[email].lockIncorrect++
      // incorrect non-lock picks yield 0 points
    }
  })

  // 5) compute score with penalties and bonus
  const output = Object.values(tally).map(u => {
    const normalPts = u.correct * 1
    const lockPts = u.lockCorrect * 2
    const penalty = u.lockIncorrect * -2
    const subtotal = normalPts + lockPts + penalty
    const perfectBonus = (u.correct + u.lockCorrect === 5) ? 3 : 0
    return {
      email: u.email,
      correct: u.correct,
      lockCorrect: u.lockCorrect,
      lockIncorrect: u.lockIncorrect,
      weeklyPoints: subtotal + perfectBonus,
      bonus: perfectBonus
    }
  })

  res.status(200).json(output)
}
