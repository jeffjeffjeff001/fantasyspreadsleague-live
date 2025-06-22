// pages/dashboard.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function LeagueDashboard() {
  const [week, setWeek]             = useState(1)
  const [profiles, setProfiles]     = useState([])
  const [games, setGames]           = useState([])
  const [picks, setPicks]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [filterUsername, setFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('email, username'),
      supabase.from('games').select('*').eq('week', week),
      supabase.from('picks').select('user_email, selected_team, is_lock, game_id')
    ]).then(([{ data: pr }, { data: gm }, { data: pk }]) => {
      setProfiles(pr || [])
      setGames(gm || [])
      setPicks(pk || [])
      setLoading(false)
    })
  }, [week])

  // only show users who've submitted this week
  const submittedEmails = new Set(picks.map(p => p.user_email))

  // bucket picks by user
  const picksByUser = {}
  profiles.forEach(p => { picksByUser[p.email] = [] })
  picks.forEach(pick => {
    if (submittedEmails.has(pick.user_email)) {
      picksByUser[pick.user_email].push(pick)
    }
  })

  const isCorrect = pick => {
    const game = games.find(g => g.id === pick.game_id)
    return game && pick.selected_team === game.result_winner
  }
  const isThu = iso => new Date(iso).getUTCDay() === 4
  const isMon = iso => new Date(iso).getUTCDay() === 1

  // build weeklyScores only for users who submitted
  const weeklyScores = profiles
    .filter(p => submittedEmails.has(p.email))
    .map(p => {
      const userPicks = picksByUser[p.email] || []
      let correct = 0, lockCorrect = 0
      userPicks.forEach(pick => {
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

  // apply username filter if set
  const displayedScores = filterUsername
    ? weeklyScores.filter(u => u.username.toLowerCase() === filterUsername.toLowerCase())
    : weeklyScores

  // leaderboard same as weeklyScores (season-to-date placeholder)
  const leaderboard = [...weeklyScores].sort((a,b) =>
    b.weeklyPoints !== a.weeklyPoints
      ? b.weeklyPoints - a.weeklyPoints
      : b.correct - a.correct
  )

  return (
    <div style={{ padding: 20 }}>
      <h1>League Dashboard</h1>
      <p><Link href="/"><a>← Return Home</a></Link></p>

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

      {loading && <p>Loading data…</p>}

      {/* Weekly Score */}
      <section style={{ marginBottom: 40 }}>
        <h2>Weekly Score (Week {week})</h2>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Filter by username"
            value={filterUsername}
            onChange={e => setFilter(e.target.value)}
            style={{ marginRight: 8, width: 200 }}
          />
          <button onClick={() => {/* just re-render */}}>
            Show Score
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{border:'1px solid #ccc',padding:8}}>Username</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Score</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Total Correct Picks</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Lock Correct</th>
            </tr>
          </thead>
          <tbody>
            {displayedScores.map(u => (
              <tr key={u.email}>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.username}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.weeklyPoints}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.correct}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.lockCorrect}</td>
              </tr>
            ))}
            {displayedScores.length === 0 && (
              <tr>
                <td colSpan={4} style={{padding:8,textAlign:'center'}}>
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
              <th style={{border:'1px solid #ccc',padding:8}}>Rank</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Username</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Points</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Total Correct Picks</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((u,i) => (
              <tr key={u.email}>
                <td style={{border:'1px solid #ccc',padding:8}}>{i+1}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.username}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.weeklyPoints}</td>
                <td style={{border:'1px solid #ccc',padding:8}}>{u.correct}</td>
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
              <th style={{border:'1px solid #ccc',padding:8}}>Username</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Thursday</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Best-3</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Monday</th>
            </tr>
          </thead>
          <tbody>
            {profiles
              .filter(p => submittedEmails.has(p.email))
              .map(p => {
                const userPicks = picksByUser[p.email] || []
                const th = userPicks.find(pk => isThu(games.find(g=>g.id===pk.game_id).kickoff_time))
                const mo = userPicks.find(pk => isMon(games.find(g=>g.id===pk.game_id).kickoff_time))
                const best = userPicks
                  .filter(pk => {
                    const dow = new Date(
                      games.find(g=>g.id===pk.game_id).kickoff_time
                    ).getUTCDay()
                    return dow !== 1 && dow !== 4
                  })
                  .slice(0,3)

                return (
                  <tr key={p.email}>
                    <td style={{border:'1px solid #ccc',padding:8}}>{p.username}</td>
                    <td style={{border:'1px solid #ccc',padding:8}}>{th?.selected_team || '–'}</td>
                    <td style={{border:'1px solid #ccc',padding:8}}>
                      {best.length ? best.map(b=>b.selected_team).join(', ') : '–'}
                    </td>
                    <td style={{border:'1px solid #ccc',padding:8}}>{mo?.selected_team || '–'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
