// pages/dashboard.js

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  // --- weekly‐score form state ---
  const [wsEmail, setWsEmail]   = useState('')
  const [wsWeek, setWsWeek]     = useState(1)
  const [wsResult, setWsResult] = useState(null)
  const [wsLoading, setWsLoading] = useState(false)
  const [wsError, setWsError]   = useState('')

  // --- leaderboard state ---
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading]     = useState(true)

  // Fetch and compute the leaderboard on mount
  useEffect(() => {
    async function loadLeaderboard() {
      setLbLoading(true)
      // 1) grab all profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('email,username')
      if (profErr) {
        console.error(profErr)
        setLbLoading(false)
        return
      }

      // 2) grab every game result
      const { data: results, error: resErr } = await supabase
        .from('results')
        .select('away_team,home_team,away_score,home_score,week')
      if (resErr) {
        console.error(resErr)
        setLbLoading(false)
        return
      }

      // 3) grab every pick with its game
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

      // 4) init stats per user
      const stats = {}
      profiles.forEach(p => {
        stats[p.email] = {
          username:      p.username,
          totalCorrect:  0,
          totalPoints:   0
        }
      })

      // 5) run each pick through the scoring logic
      picks.forEach(pick => {
        const g = pick.games
        // find the matching result row
        const result = results.find(r =>
          r.week === g.week &&
          r.home_team.trim() === g.home_team.trim() &&
          r.away_team.trim() === g.away_team.trim()
        )
        if (!result) return  // no result → skip

        // who covered?
        const spread    = parseFloat(g.spread)
        const homeCover = (result.home_score + spread) > result.away_score
        const winner    = homeCover
          ? result.home_team.trim()
          : result.away_team.trim()

        const picked    = pick.selected_team.trim()
        const userStats = stats[pick.user_email]
        if (!userStats) return

        // correct?
        if (picked === winner) {
          userStats.totalCorrect += 1
          userStats.totalPoints  += 1
          // +2 bonus for correct lock
          if (pick.is_lock) {
            userStats.totalPoints += 2
          }
        } else {
          // wrong lock → −2
          if (pick.is_lock) {
            userStats.totalPoints -= 2
          }
        }
      })

      // 6) perfect‐week bonus: +3 for any week with 5/5
      //    we’d need per‐week counts; for MVP you can skip or add later.

      // 7) turn into sorted array
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

  // --- handle the weekly score lookup ---
  async function fetchWeeklyScore() {
    setWsError('')
    setWsResult(null)
    setWsLoading(true)

    try {
      const res = await fetch(
        `/api/weekly-scores?week=${encodeURIComponent(wsWeek)}`
      )
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Unknown error')
      }
      // find this user’s entry
      const me = payload.find(r => r.email === wsEmail.trim())
      if (!me) {
        setWsError('No picks found for that email/week combination.')
      } else {
        setWsResult(me)
      }
    } catch (e) {
      setWsError(e.message)
    } finally {
      setWsLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>League Dashboard</h1>
      <nav>
        <Link href="/"><a>← Home</a></Link>
      </nav>

      {/* --- Weekly Score --- */}
      <section style={{ marginTop: 40 }}>
        <h2>Weekly Score Lookup</h2>
        <div style={{ marginBottom: 8 }}>
          <label>
            Email:{' '}
            <input
              type="email"
              value={wsEmail}
              onChange={e => setWsEmail(e.target.value)}
            />
          </label>
          {' '}
          <label>
            Week:{' '}
            <input
              type="number"
              min={1}
              value={wsWeek}
              onChange={e => setWsWeek(e.target.value)}
            />
          </label>
          {' '}
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

      {/* --- League Leaderboard --- */}
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
    </div>
  )
}
