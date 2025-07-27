// pages/dashboard.js

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  // — Weekly Score state —
  const [wsEmail,    setWsEmail]    = useState('')
  const [wsWeek,     setWsWeek]     = useState(1)
  const [wsResult,   setWsResult]   = useState(null)
  const [wsError,    setWsError]    = useState('')
  const [wsLoading,  setWsLoading]  = useState(false)

  // — Leaderboard state —
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading,   setLbLoading]   = useState(true)

  // — League Picks state —
  const [lpWeek,     setLpWeek]     = useState(1)
  const [lpPicks,    setLpPicks]    = useState([])
  const [lpLoading,  setLpLoading]  = useState(false)

  // Fetch & compute the leaderboard on mount
  useEffect(() => {
    async function loadLeaderboard() {
      setLbLoading(true)

      // 1) fetch profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('email,username')
      if (profErr) {
        console.error(profErr)
        setLbLoading(false)
        return
      }

      // 2) fetch all results
      const { data: results, error: resErr } = await supabase
        .from('results')
        .select('away_team,home_team,away_score,home_score,week')
      if (resErr) {
        console.error(resErr)
        setLbLoading(false)
        return
      }

      // 3) fetch all picks
      const { data: picks, error: pickErr } = await supabase
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
      if (pickErr) {
        console.error(pickErr)
        setLbLoading(false)
        return
      }

      // 4) init stats
      const stats = {}
      profiles.forEach(p => {
        stats[p.email] = {
          username:     p.username,
          totalCorrect: 0,
          totalPoints:  0,
          // track picks per week for perfect-week bonus
          weeklyStats: {} 
        }
      })

      // 5) score every pick
      picks.forEach(pick => {
        const g = pick.games
        const week = g.week
        const u = stats[pick.user_email]
        if (!u) return

        // init this week counters
        if (!u.weeklyStats[week]) {
          u.weeklyStats[week] = { total: 0, correct: 0 }
        }
        u.weeklyStats[week].total += 1

        const result = results.find(r =>
          r.week === week &&
          r.home_team.trim() === g.home_team.trim() &&
          r.away_team.trim() === g.away_team.trim()
        )
        if (!result) return

        const spread    = parseFloat(g.spread)
        const homeCover = (result.home_score + spread) > result.away_score
        const winner    = homeCover
          ? result.home_team.trim()
          : result.away_team.trim()

        const picked = pick.selected_team.trim()
        if (picked === winner) {
          u.totalCorrect += 1
          u.totalPoints  += 1
          u.weeklyStats[week].correct += 1
          if (pick.is_lock) {
            u.totalPoints += 2
          }
        } else if (pick.is_lock) {
          u.totalPoints -= 2
        }
      })

      // 6) perfect-week bonus: +3 if user got all their picks correct that week
      Object.values(stats).forEach(u => {
        Object.values(u.weeklyStats).forEach(ws => {
          if (ws.correct === ws.total) {
            u.totalPoints += 3
          }
        })
      })

      // 7) sort
      const list = Object.values(stats)
      list.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints
        }
        return b.totalCorrect - a.totalCorrect
      })

      setLeaderboard(list)
      setLbLoading(false)
    }
    loadLeaderboard()
  }, [])

  // — Weekly Score Lookup —
  async function fetchWeeklyScore() {
    setWsError('')
    setWsResult(null)
    setWsLoading(true)
    try {
      const resp = await fetch(`/api/weekly-scores?week=${wsWeek}`)
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Error')
      const me = json.find(r => r.email === wsEmail.trim())
      if (!me) {
        setWsError('No picks found for that email & week.')
      } else {
        setWsResult(me)
      }
    } catch (err) {
      setWsError(err.message)
    } finally {
      setWsLoading(false)
    }
  }

  // — Load & group league picks —
  async function loadLeaguePicks() {
    setLpLoading(true)
    try {
      // 1) fetch profiles for username lookup
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email,username')
      const userMap = {}
      profiles.forEach(p => { userMap[p.email] = p.username })

      // 2) fetch picks+games for lpWeek
      const { data: picks, error } = await supabase
        .from('picks')
        .select(`
          user_email,
          selected_team,
          is_lock,
          games (
            away_team,
            home_team,
            kickoff_time,
            week
          )
        `)
        .eq('games.week', lpWeek)

      if (error) {
        console.error(error)
        setLpPicks([])
        return
      }

      // 3) group by user
      const grouped = {}
      picks.forEach(pick => {
        // <— GUARD AGAINST NULL
        if (!pick.games) return

        const email = pick.user_email
        if (!grouped[email]) {
          grouped[email] = {
            username:  userMap[email] || email,
            thursday:  '',
            best:      [],
            monday:    ''
          }
        }
        const kt   = new Date(pick.games.kickoff_time)
        const day  = kt.getDay()  // 0=Sun,1=Mon...4=Thu
        const team = pick.selected_team.trim()

        if (day === 4)      grouped[email].thursday = team
        else if (day === 1) grouped[email].monday   = team
        else                grouped[email].best.push(team)
      })

      // ── ensure every league member appears (even with no picks) ─────────
      profiles.forEach(p => {
        if (!grouped[p.email]) {
          grouped[p.email] = {
            username: p.username,
            thursday: '',
            best:     [],
            monday:   ''
          }
        }
      })

      // 4) to array
      setLpPicks(Object.values(grouped))
    } finally {
      setLpLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>League Dashboard</h1>
      <nav><Link href="/"><a>← Home</a></Link></nav>

      {/* Weekly Score */}
      <section style={{ marginTop: 40 }}>
        <h2>Weekly Score</h2>
        <label>
          Email:{' '}
          <input
            type="email"
            value={wsEmail}
            onChange={e => setWsEmail(e.target.value)}
          />
        </label>{' '}
        <label>
          Week:{' '}
          <select
            value={wsWeek}
            onChange={e => setWsWeek(parseInt(e.target.value,10))}
          >
            {Array.from({ length: 18 }, (_, i) => i + 1).map(wk => (
              <option key={wk} value={wk}>{wk}</option>
            ))}
          </select>
        </label>
        <button onClick={fetchWeeklyScore} disabled={wsLoading}>
          {wsLoading ? 'Loading…' : 'Get Score'}
        </button>
        {wsError && <p style={{ color: 'red' }}>{wsError}</p>}
        {wsResult && (
          <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Correct</th>
                <th>Lock ✔</th>
                <th>Lock ✘</th>
                <th>Bonus</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{wsResult.email}</td>
                <td style={{ textAlign: 'center' }}>{wsResult.correct}</td>
                <td style={{ textAlign: 'center' }}>{wsResult.lockCorrect}</td>
                <td style={{ textAlign: 'center' }}>{wsResult.lockIncorrect}</td>
                <td style={{ textAlign: 'center' }}>{wsResult.perfectBonus}</td>
                <td style={{ textAlign: 'center' }}>{wsResult.weeklyPoints}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Leaderboard */}
      <section style={{ marginTop: 60 }}>
        <h2>League Leaderboard</h2>
        {lbLoading ? (
          <p>Loading leaderboard…</p>
        ) : (
          <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Total Correct</th>
                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, i) => (
                <tr key={u.username || i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{u.username}</td>
                  <td style={{ textAlign: 'center' }}>{u.totalCorrect}</td>
                  <td style={{ textAlign: 'center' }}>{u.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* League Picks */}
      <section style={{ marginTop: 60 }}>
        <h2>League Picks</h2>
        <div style={{ marginBottom: 12 }}>
          <label>
            Week:&nbsp;
            <select
              value={lpWeek}
              onChange={e => setLpWeek(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map(wk => (
                <option key={wk} value={wk}>{wk}</option>
              ))}
            </select>
          </label>
          <button
            onClick={loadLeaguePicks}
            disabled={lpLoading}
            style={{ marginLeft: 8 }}
          >
            {lpLoading ? 'Loading…' : 'Load Picks'}
          </button>
        </div>

        {lpLoading && <p>Loading picks…</p>}

        {!lpLoading && lpPicks.length > 0 ? (
          <table
            border={1}
            cellPadding={8}
            style={{ borderCollapse: 'collapse', marginTop: 10 }}
          >
            <thead>
              <tr>
                <th>Username</th>
                <th>Thursday Pick</th>
                <th>Best‑3 Picks</th>
                <th>Monday Pick</th>
              </tr>
            </thead>
            <tbody>
              {lpPicks.map((u, i) => (
                <tr key={i}>
                  <td>{u.username}</td>
                  <td style={{ textAlign: 'center' }}>{u.thursday}</td>
                  <td>{u.best.join(', ')}</td>
                  <td style={{ textAlign: 'center' }}>{u.monday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {!lpLoading && lpPicks.length === 0 && (
          <p>No league picks found for Week {lpWeek}.</p>
        )}
      </section>
    </div>
  )
}
