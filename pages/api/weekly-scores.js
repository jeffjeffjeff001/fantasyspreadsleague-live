// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const week = parseInt(req.query.week, 10)||1

  // 1) load results
  const { data: results } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score')
    .eq('week', week)

  // 2) load picks + games
  const { data: picks } = await supabaseAdmin
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
    // join on away+home match
    winners[`${r.away_team}@${r.home_team}`] =
      r.home_score > r.away_score ? r.home_team : r.away_team
  })

  // 4) tally per user
  const tally = {}
  picks.forEach(p => {
    const key = p.user_email
    if (!tally[key]) tally[key] = { email:key, correct:0, lockCorrect:0 }
    const gameKey = `${p.games.away_team}@${p.games.home_team}`
    if (p.selected_team === winners[gameKey]) {
      p.is_lock ? tally[key].lockCorrect++ : tally[key].correct++
    }
  })

  // 5) apply perfect-week bonus
  const output = Object.values(tally).map(u => {
    const base    = u.correct + u.lockCorrect * 2
    const bonus   = (u.correct + u.lockCorrect === 5) ? 3 : 0
    return { ...u, weeklyPoints: base + bonus }
  })

  res.status(200).json(output)
}
