// pages/dashboard.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function LeagueDashboard() {
  const [week, setWeek]         = useState(1)
  const [profiles, setProfiles] = useState([])
  const [games, setGames]       = useState([])
  const [picks, setPicks]       = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('email, username'),
      supabase.from('games').select('*').eq('week', week),
      supabase.from('picks').select('user_email, selected_team, is_lock, game_id')
    ]).then(([{ data: pr }, { data: gm }, { data: pk }]) => {
      setProfiles(pr || [])
      setGames(gm || [])
      // only picks for this week
      const gameIds = new Set((gm || []).map((g) => g.id))
      setPicks((pk || []).filter((p) => gameIds.has(p.game_id)))
      setLoading(false)
    })
  }, [week])

  // map picks by user
  const picksByUser = {}
  profiles.forEach((p) => { picksByUser[p.email] = [] })
  picks.forEach((pick) => {
    picksByUser[pick.user_email]?.push(pick)
  })

  const isCorrect   = (pick) => {
    const game = games.find((g) => g.id === pick.game_id)
    return game && pick.selected_team === game.result_winner
  }
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // weekly scores for everyone (zero if no picks)
  const weeklyScores = profiles.map((p) => {
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

  // leaderboard sorted
  const leaderboard = [...weeklyScores].sort((a, b) =>
    b.weeklyPoints !== a.weeklyPoints
      ? b.weeklyPoints - a.weeklyPoints
      : b.correct - a.correct
  )

  return (
    <div style={{ padding: 20 }}>
      <h1>League Dashboard</h1>
      <p><Link href="/"><a>← Home</a></Link></p>

      <div style={{ margin: '20px 0' }}>
        <label>
          Week:&nbsp;
          <input
            type="number" min="1"
            value={week}
            onChange={e => setWeek(parseInt(e.target.value,10)||1)}
            style={{ width: 60 }}
          />
        </label>
      </div>

      {loading && <p>Loading…</p>}

      {/* Weekly Score */}
      <section style={{ marginBottom: 40 }}>
        <h2>Weekly Score (Week {week})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>User</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Score</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Total Correct Picks</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Lock Correct</th>
            </tr>
          </thead>
          <tbody>
            {weeklyScores.map((u) => (
              <tr key={u.email}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.username}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.weeklyPoints}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.correct}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{u.lockCorrect}</td>
              </tr>
            ))}
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
              <th style={{ border: '1px solid #ccc', padding: 8 }}>User</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Points</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Total Correct Picks</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u,i) => (
              <tr key={u.email}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{i+1}</td>
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
              <th style={{ border: '1px solid #ccc', padding: 8 }}>User</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Thursday</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Best-3</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Monday</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const userPicks = picksByUser[p.email] || []
              const th = userPicks.find(pk => isThursday(games.find(g=>g.id===pk.game_id).kickoff_time))
              const mo = userPicks.find(pk => isMonday(games.find(g=>g.id===pk.game_id).kickoff_time))
              const best = userPicks
                .filter(pk => {
                  const dow = new Date(
                    games.find(g=>g.id===pk.game_id).kickoff_time
                  ).getUTCDay()
                  return dow!==1 && dow!==4
                })
                .slice(0,3)

              return (
                <tr key={p.email}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.username}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{th?.selected_team||'–'}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {best.length ? best.map(b=>b.selected_team).join(', ') : '–'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{mo?.selected_team||'–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
