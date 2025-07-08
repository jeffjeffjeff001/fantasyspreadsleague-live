import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  // New game form state
  const [newGameAway, setNewGameAway] = useState('')
  const [newGameHome, setNewGameHome] = useState('')
  const [newGameSpread, setNewGameSpread] = useState('')
  const [newGameKickoff, setNewGameKickoff] = useState('')

  // View user picks state
  const [userForPicks, setUserForPicks] = useState('')
  const [weekForPicks, setWeekForPicks] = useState(1)
  const [userPicks, setUserPicks] = useState([])
  const [loadingPicks, setLoadingPicks] = useState(false)

  // Weekly scores state
  const [weeklyScores, setWeeklyScores] = useState([])
  const [loadingScores, setLoadingScores] = useState(false)

  // Load games for selected week
  const loadGames = async () => {
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

  // Load all profiles
  const loadProfiles = async () => {
    setLoadingProfiles(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('email, username, first_name, last_name')
      .order('username', { ascending: true })
    if (error) alert('Error loading profiles: ' + error.message)
    else setProfiles(data)
    setLoadingProfiles(false)
  }

  useEffect(() => {
    loadGames()
    loadProfiles()
  }, [selectedWeek])

  // Add a new game
  const handleAddGame = async () => {
    const game = {
      week: selectedWeek,
      away_team: newGameAway,
      home_team: newGameHome,
      spread: parseFloat(newGameSpread),
      kickoff_time: new Date(newGameKickoff).toISOString(),
    }
    const { error } = await supabase.from('games').insert([game])
    if (error) alert('Error adding game: ' + error.message)
    else {
      setNewGameAway('')
      setNewGameHome('')
      setNewGameSpread('')
      setNewGameKickoff('')
      loadGames()
    }
  }

  // Delete a game
  const handleDeleteGame = async (id) => {
    if (!confirm('Delete this game?')) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) alert('Error deleting game: ' + error.message)
    else loadGames()
  }

  // Clear all games for a week
  const handleClearWeek = async () => {
    if (!confirm(`Clear all games for Week ${selectedWeek}?`)) return
    const { error } = await supabase.from('games').delete().eq('week', selectedWeek)
    if (error) alert('Error clearing games: ' + error.message)
    else setGames([])
  }

  // Delete a user profile
  const handleDeleteUser = async (email) => {
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

  // Load user's picks for a week
  const loadUserPicks = async () => {
    if (!userForPicks) { alert('Please select a user'); return }
    setLoadingPicks(true)
    const { data, error } = await supabase
      .from('picks')
      .select('id, selected_team, is_lock, games(away_team,home_team,kickoff_time,week)')
      .eq('user_email', userForPicks)
      .eq('games.week', weekForPicks)
      .order('kickoff_time', { foreignTable: 'games', ascending: true })
    if (error) alert('Error loading picks: ' + error.message)
    else setUserPicks(data)
    setLoadingPicks(false)
  }

  // Delete a pick
  const handleDeletePick = async (pickId) => {
    if (!confirm('Delete this pick?')) return
    const { error } = await supabase.from('picks').delete().eq('id', pickId)
    if (error) alert('Error deleting pick: ' + error.message)
    else loadUserPicks()
  }

  // Calculate weekly scores
  const calculateScores = async () => {
    setLoadingScores(true)
    const res = await fetch(`/api/weekly-scores?week=${selectedWeek}`)
    const data = await res.json()
    setWeeklyScores(data)
    setLoadingScores(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin</h1>
      <p><Link href='/'><a>← Home</a></Link></p>

      {/* Game Management */}
      <section style={{ marginTop: 20 }}>
        <h2>Game Management (Week {selectedWeek})</h2>
        <div style={{ marginBottom: 12 }}>
          <label>
            Week:&nbsp;
            <input
              type="number"
              min="1"
              value={selectedWeek}
              onChange={e => setSelectedWeek(parseInt(e.target.value, 10) || 1)}
              style={{ width: 60 }}
            />
          </label>
          <button onClick={handleClearWeek} style={{ marginLeft: 12 }}>
            Clear Week
          </button>
        </div>
        {loadingGames ? (
          <p>Loading games…</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Away</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Home</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Spread</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Kickoff</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map(g => (
                <tr key={g.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{g.away_team}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{g.home_team}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{g.spread}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{new Date(g.kickoff_time).toLocaleString()}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                    <button onClick={() => handleDeleteGame(g.id)} style={{ background: 'red', color: 'white', padding: '6px 12px', border: 'none' }}>
                      Delete
                    }</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <input placeholder="Away Team" value={newGameAway} onChange={e => setNewGameAway(e.target.value)} style={{ marginRight: 8 }} />
          <input placeholder="Home Team" value={newGameHome} onChange={e => setNewGameHome(e.target.value)} style={{ marginRight: 8 }} />
          <input placeholder="Spread" type="number" value={newGameSpread} onChange={
