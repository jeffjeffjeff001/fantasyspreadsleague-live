// pages/admin.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const [selectedWeek, setSelectedWeek]         = useState(1)
  const [games, setGames]                       = useState([])
  const [profiles, setProfiles]                 = useState([])
  const [loadingGames, setLoadingGames]         = useState(false)
  const [loadingProfiles, setLoadingProfiles]   = useState(false)

  // New game form
  const [newGameAway, setNewGameAway]           = useState('')
  const [newGameHome, setNewGameHome]           = useState('')
  const [newGameSpread, setNewGameSpread]       = useState('')
  const [newGameKickoff, setNewGameKickoff]     = useState('')

  // View picks
  const [userForPicks, setUserForPicks]         = useState('')
  const [weekForPicks, setWeekForPicks]         = useState(1)
  const [userPicks, setUserPicks]               = useState([])
  const [loadingPicks, setLoadingPicks]         = useState(false)

  // Weekly scores
  const [weeklyScores, setWeeklyScores]         = useState([])
  const [loadingScores, setLoadingScores]       = useState(false)

  useEffect(() => {
    loadGames()
    loadProfiles()
  }, [selectedWeek])

  // ── Data loading ──────────────────────────────────────────────────
  async function loadGames() {
    setLoadingGames(true)
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true })
    if (error) alert('Error loading games: ' + error.message)
    else setGames(data)
    setLoadingGames(false)
  }

  async function loadProfiles() {
    setLoadingProfiles(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('email, username, first_name, last_name')
      .order('username', { ascending: true })
    if (error) alert('Error loading profiles: ' + error.message)
    else setProfiles(data)
    setLoadingProfiles(false)
  }

  // ── Game management ────────────────────────────────────────────────
  async function handleAddGame() {
    const { error } = await supabase.from('games').insert([{
      week:         selectedWeek,
      away_team:    newGameAway,
      home_team:    newGameHome,
      spread:       parseFloat(newGameSpread),
      kickoff_time: new Date(newGameKickoff).toISOString(),
    }])
    if (error) alert('Error adding game: ' + error.message)
    else {
      setNewGameAway('')
      setNewGameHome('')
      setNewGameSpread('')
      setNewGameKickoff('')
      loadGames()
    }
  }

  async function handleDeleteGame(id) {
    if (!confirm('Delete this game?')) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) alert('Error deleting game: ' + error.message)
    else loadGames()
  }

  async function handleClearWeek() {
    if (!confirm(`Clear all games for Week ${selectedWeek}?`)) return
    const { error } = await supabase.from('games').delete().eq('week', selectedWeek)
    if (error) alert('Error clearing games: ' + error.message)
    else setGames([])
  }

  // ── User management ────────────────────────────────────────────────
  async function handleDeleteUser(email) {
    if (!confirm(`Delete user ${email}?`)) return
    const res = await fetch('/api/delete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const { error } = await res.json()
    if (error) alert('Error deleting user: ' + error)
    else loadProfiles()
  }

  // ── View user picks ───────────────────────────────────────────────┐
  async function loadUserPicks() {
    if (!userForPicks) return alert('Please select a user')
    setLoadingPicks(true)
    const { data, error } = await supabase
      .from('picks')
      .select('id, selected_team, is_lock, games(away_team,home_team,kickoff_time)')
      .eq('user_email', userForPicks)
      .eq('games.week', weekForPicks)
      .order('kickoff_time', { foreignTable: 'games', ascending: true })
    if (error) alert('Error loading picks: ' + error.message)
    else setUserPicks(data)
    setLoadingPicks(false)
  }

  async function handleDeletePick(pickId) {
    if (!confirm('Delete this pick?')) return
    const { error } = await supabase.from('picks').delete().eq('id', pickId)
    if (error) alert('Error deleting pick: ' + error.message)
    else loadUserPicks()
  }

  // ── Calculate scores (with HTTP‐error handling) ────────────────────
  async function calculateScores() {
    setLoadingScores(true)
    const res = await fetch(`/api/weekly-scores?week=${selectedWeek}`)
    const data = await res.json()
    if (!res.ok) {
      alert('Error calculating scores: ' + (data.error || JSON.stringify(data)))
      setWeeklyScores([])
    } else {
      setWeeklyScores(data)
    }
    setLoadingScores(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin</h1>
      <p><Link href="/"><a>← Home</a></Link></p>

      {/* Game Management */}
      {/* … (identical to previous full code above) … */}

      {/* Calculate Weekly Scores */}
      <section style={{ marginTop: 40 }}>
        <h2>Calculate Scores (Week {selectedWeek})</h2>
        <button onClick={calculateScores}>Calculate Scores</button>
        {loadingScores && <p>Calculating…</p>}
        {weeklyScores.length > 0 && (
          <table style={{ width:'100%',borderCollapse:'collapse',marginTop:12 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Points</th>
                <th>Correct</th>
                <th>Lock ✓</th>
                <th>Lock ✗</th>
                <th>Bonus</th>
              </tr>
            </thead>
            <tbody>
              {weeklyScores.map(u => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.weeklyPoints}</td>
                  <td>{u.correct}</td>
                  <td>{u.lockCorrect}</td>
                  <td>{u.lockIncorrect}</td>
                  <td>{u.perfectBonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
