// pages/dashboard.js

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  // — Weekly Score state —
  const [wsEmail, setWsEmail] = useState('')
  const [wsWeek, setWsWeek] = useState(1)
  const [wsResult, setWsResult] = useState(null)
  const [wsError, setWsError] = useState('')
  const [wsLoading, setWsLoading] = useState(false)

  // — Leaderboard state —
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(true)

  // — League Picks state —
  const [lpWeek, setLpWeek] = useState(1)
  const [lpPicks, setLpPicks] = useState([])
  const [lpLoading, setLpLoading] = useState(false)

  // Fetch & compute the leaderboard on mount
  useEffect(() => {
    async function loadLeaderboard() {
      setLbLoading(true)
      // 1) fetch all profiles
      let { data: profiles, error } = await supabase
        .from('profiles')
        .select('email,username')
      if (error) {
        console.error(error)
        setLbLoading(false)
        return
      }

      // 2) fetch all results
      let { data: results } = await supabase
        .from('results')
        .select('away_team,home_team,away_score,home_score,week')

      // 3) fetch all picks with games
      let { data: picks } = await supabase
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

      // 4) init stats
      const stats = {}
      profiles.forEach(p => {
        stats[p.email] = { username: p.username, totalCorrect: 0, totalPoints: 0 }
      })

      // 5) score every pick
      picks.forEach(pick => {
        const g = pick.games
        const result = results.find(r =>
          r.week === g.week &&
          r.home_team.trim() === g.home_team.trim() &&
          r.away_team.trim() === g.away_team.trim()
        )
        if (!result) return

        const spread    = parseFloat(g.spread)
        const homeCover = (result.home_score + spread) > result.away_score
        const winner    = homeCover
          ? result.home_team.trim()
          : result.away_team.trim()

        const picked    = pick.selected_team.trim()
        const u         = stats[pick.user_email]
        if (!u) return

        if (picked === winner) {
          u.totalCorrect += 1
          u.totalPoints  += 1
          if (pick.is_lock) u.totalPoints += 2
        } else if (pick.is_lock) {
          u.totalPoints -= 2
        }
      })

      // 6) sort by totalPoints, then totalCorrect
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

  // Handle weekly score lookup
  async function fetchWeeklyScore() {
    setWsError('')
    setWsResult(null)
    setWsLoading(true)
    try {
      const resp = await fetch(
        `/api/weekly-scores?week=${encodeURIComponent(wsWeek)}`
      )
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Unknown error')
      const me = json.find(r => r.email === wsEmail.trim())
      if (!me) {
        setWsError('No picks found for that email/week.')
      } else {
        setWsResult(me)
      }
    } catch (e) {
      setWsError(e.message)
    } finally {
      setWsLoading(false)
    }
  }

  // Load picks for a given week
  async function loadLeaguePicks() {
    setLpLoading(true)
    let { data, error } = await supabase
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
    } else {
      setLpPicks(data)
    }
    setLpLoading(false)
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>League Dashboard</h1>
      <nav>
        <Link href="/"><a>← Home</a></Link>
      </nav>

      {/* Weekly Score */}
      <section style={{ marginTop: 40 }}>
        <h2>Weekly Score Lookup</h2>
        <div>
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
            <input
              type="number"
              min={1}
              value={wsWeek}
              onChange={e => setWsWeek(e.target.value)}
            />
          </label>{' '}
          <button onClick={fetchWeeklyScore} disabled={wsLoading}>
            {wsLoading ? 'Loading…' : 'Get Score'}
          </button>
        </div>
        {wsError && <p style={{ color: 'red' }}>{wsError}</p>}
        {wsResult && (
          <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Correct</th>
                <th>Lock ✔</th>
                <th>Lock ✘</th>
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

      {/* League Leaderboard */}
      <section style={{ marginTop: 60 }}>
        <h2>League Leaderboard</h2>
        {lbLoading ? (
          <p>Loading leaderboard…</p>
        ) : (
          <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Total Correct</th>
                <th>Total Points</th>
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
        <h2>League Picks (All Users)</h2>
        <div>
          <label>
            Week:{' '}
            <input
              type="number"
              min={1}
              value={lpWeek}
              onChange={e => setLpWeek(e.target.value)}
            />
          </label>{' '}
          <button onClick={loadLeaguePicks} disabled={lpLoading}>
            {lpLoading ? 'Loading…' : 'Load Picks'}
          </button>
        </div>
        {lpLoading ? (
          <p>Loading picks…</p>
        ) : (
          <table border={1} cellPadding={8} style={{ borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Game</th>
                <th>Pick</th>
                <th>Lock?</th>
              </tr>
            </thead>
            <tbody>
              {lpPicks.map((p, i) => {
                const g = p.games
                const kickoff = new Date(g.kickoff_time).toLocaleString()
                return (
                  <tr key={i}>
                    <td>{p.user_email}</td>
                    <td>{`${g.away_team.trim()} @ ${g.home_team.trim()} (${kickoff})`}</td>
                    <td>{p.selected_team.trim()}</td>
                    <td style={{ textAlign: 'center' }}>
                      {p.is_lock ? '✔' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
