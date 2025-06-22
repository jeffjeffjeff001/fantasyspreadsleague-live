// pages/dashboard.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function LeagueDashboard() {
  const [week, setWeek] = useState(1)
  const [profiles, setProfiles] = useState([])
  const [games, setGames] = useState([])
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterUsername, setFilterUsername] = useState('')

  // Load profiles, this‐week’s games, and picks filtered by that week
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const { data: pr } = await supabase
        .from('profiles')
        .select('email, username')

      const { data: gm } = await supabase
        .from('games')
        .select('*')
        .eq('week', week)

      const { data: allPicks } = await supabase
        .from('picks')
        .select('user_email, selected_team, is_lock, game_id')

      // Keep only picks for this week’s games
      const gameIds = new Set((gm || []).map((g) => g.id))
      const weekPicks = (allPicks || []).filter((p) =>
        gameIds.has(p.game_id)
      )

      setProfiles(pr || [])
      setGames(gm || [])
      setPicks(weekPicks)
      setLoading(false)
    }
    loadData()
  }, [week])

  // Which emails have submitted
  const submittedEmails = new Set(picks.map((p) => p.user_email))

  // Bucket picks by user
  const picksByUser = {}
  profiles.forEach((p) => {
    if (submittedEmails.has(p.email)) {
      picksByUser[p.email] = []
    }
  })
  picks.forEach((pick) => {
    if (picksByUser[pick.user_email]) {
      picksByUser[pick.user_email].push(pick)
    }
  })

  // Helpers
  const isCorrect = (pick) => {
    const game = games.find((g) => g.id === pick.game_id)
    return game && pick.selected_team === game.result_winner
  }
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday = (iso) => new Date(iso).getUTCDay() === 1

  // Weekly scores for users who submitted
  const weeklyScores = profiles
    .filter((p) => submittedEmails.has(p.email))
    .map((p) => {
      const userPicks = picksByUser[p.email] || []
      let correct = 0, lockCorrect = 0
      userPicks.forEach((pick) => {
        if (isCorrect(pick)) {
          pick.is_lock ? lockCorrect++ : correct++
        }
      })
      const perfectBonus = (correct + lockCorrect === 5) ? 3 : 0
      return {
        email: p.email,
        username: p.username,
        weeklyPoints: correct + lockCorrect * 2 + perfectBonus,
        correct,
        lockCorrect
      }
    })

  // Filter by username if entered
  const displayedScores = filterUsername
    ? weeklyScores.filter((u) =>
        u.username.toLowerCase() === filterUsername.toLowerCase()
      )
    : weeklyScores

  // Leaderboard (season-to-date placeholder)
  const leaderboard = [...weeklyScores].sort((a, b) => {
    if (b.weeklyPoints !== a.weeklyPoints) {
      return b.weeklyPoints - a.weeklyPoints
    }
    return b.correct - a.correct
  })

  return (
    <div style={{ padding: 20 }}>
      <h1>League Dashboard</h1>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      <div style={{ margin: '20px 0' }}>
        <label>
          Week:&nbsp;
          <input
            type="number"
            min="1"
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value, 10) || 1)}
            style={{ width: 60 }}
          />
        </label>
      </div>

      {loading && <p>Loading data…</p>}

      {/* Weekly Score */}
      <section style={{ marginBottom: 40 }}>
        <h2>Weekly Score (Week {week})</h2>
        <div style={{ marginBottom: 12 }}>
          <label>
            Username:&nbsp;
            <input
              type="text"
              placeholder="Enter username"
              value={filterUsername}
              onChange={(e) => setFilterUsername(e.target.value)}
              style={{ width: 200 }}
            />
          </label>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Username</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Score</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Total Correct Picks</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Lock Correct</th>
            </tr>
          </thead>
          <tbody>
            {displayedScores.map((u) => (
              <tr key={u.email}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.username}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.weeklyPoints}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.correct}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.lockCorrect}</td>
              </tr>
            ))}
            {displayedScores.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, textAlign: 'center' }}>
                  No submissions found{filterUsername ? ` for "${filterUsername}"` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* League Leaderboard */}
      <section style={{ marginBottom: 40 }}>
        <h2>League Leaderboard</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Rank</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Username</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Points</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Total Correct Picks</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u, i) => (
              <tr key={u.email}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.username}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.weeklyPoints}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* League Picks */}
      <section>
        <h2>League Picks (Week {week})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Username</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Thursday</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Best-3</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Monday</th>
            </tr>
          </thead>
          <tbody>
            {profiles
              .filter((p) => submittedEmails.has(p.email))
              .map((p) => {
                const userPicks = picksByUser[p.email] || []
                const th = userPicks.find((pk) =>
                  isThursday(
                    games.find((g) => g.id === pk.game_id).kickoff_time
                  )
                )
                const mo = userPicks.find((pk) =>
                  isMonday(
                    games.find((g) => g.id === pk.game_id).kickoff_time
                  )
                )
                const best = userPicks
                  .filter((pk) => {
                    const dow = new Date(
                      games.find((g) => g.id === pk.game_id).kickoff_time
                    ).getUTCDay()
                    return dow !== 1 && dow !== 4
                  })
                  .slice(0, 3)

                return (
                  <tr key={p.email}>
                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                      {p.username}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                      {th ? th.selected_team : '–'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                      {best.length
                        ? best.map((b) => b.selected_team).join(', ')
                        : '–'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: 8 }}>
                      {mo ? mo.selected_team : '–'}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
