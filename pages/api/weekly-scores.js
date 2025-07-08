// pages/api/weekly-scores.js
import { createClient } from '@supabase/supabase-js'

// Initialize admin client using service role key (bypasses RLS)
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

  // 1) Load game results for the specified week
  let { data: results = [], error: resultsError } = await supabaseAdmin
    .from('results')
    .select('away_team,home_team,away_score,home_score,game_week')
    .eq('game_week', week)

  if (resultsError) {
    // fallback if your column is named `week`
    const { data: altResults = [], error: altError } = await supabaseAdmin
      .from('results')
      .select('away_team,home_team,away_score,home_score,week')
      .eq('week', week)
    if (altError) {
      return res.status(500).json({ error: resultsError.message })
    }
    results = altResults
  }

  // 2) Load all picks for that week with game spreads
  const { data: picks = [], error: picksError } = await supabaseAdmin
    .from('picks')
    .select('user_email,selected_team,is_lock,games(away_team,home_team,spread)')
    .eq('games.week', week)

  if (picksError) {
    return res.status(500).json({ error: picksError.message })
  }

  // 3) Tally scores per user
  const statsByUser = {}
  // Seed each user
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

  // Evaluate each pick
  picks.forEach(p => {
    const game = p.games
    // Find matching result by teams (order-insensitive)
    const result = results.find(r =>
      (r.home_team === game.home_team && r.away_team === game.away_team) ||
      (r.home_team === game.away_team && r.away_team === game.home_team)
    )
    if (!result) return

    // Determine if home covered
    const homeCovers = (result.home_score + game.spread) > result.away_score
    const coveringTeam = homeCovers ? result.home_team : result.away_team

    const userStats = statsByUser[p.user_email]
    if (p.selected_team === coveringTeam) {
      userStats.correct += 1
      if (p.is_lock) userStats.lockCorrect += 1
    } else {
      if (p.is_lock) userStats.lockIncorrect += 1
    }
  })

  // Apply perfect-week bonus
  Object.values(statsByUser).forEach(s => {
    if (s.correct === 5) {
      s.perfectBonus = 3
    }
  })

  // 4) Build response array
  const response = Object.entries(statsByUser).map(([email, s]) => {
    const weeklyPoints =
      s.correct +
      // lock correct gives +2 total: 1 from correct + 1 extra
      s.lockCorrect * 1 +
      // incorrect lock is -2
      s.lockIncorrect * -2 +
      s.perfectBonus

    return {
      email,
      correct: s.correct,
      lockCorrect: s.lockCorrect,
      lockIncorrect: s.lockIncorrect,
      perfectBonus: s.perfectBonus,
      weeklyPoints
    }
  })

  res.status(200).json(response)
}
