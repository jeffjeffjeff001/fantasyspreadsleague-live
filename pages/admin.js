import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames]               = useState([])
  const [profiles, setProfiles]         = useState([])
  const [loadingGames, setLoadingGames]     = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const [newGame, setNewGame] = useState({ away: '', home: '', spread: '', kickoff: '' })

  // For viewing picks
  const [userForPicks, setUserForPicks] = useState('')
  const [weekForPicks, setWeekForPicks] = useState(1)
  const [userPicks, setUserPicks]       = useState([])
  const [loadingPicks, setLoadingPicks] = useState(false)

  // Load games by week
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

    if (error) alert('Error loading members: ' + error.message)
    else setProfiles(data)
    setLoadingProfiles(false)
  }

  useEffect(() => {
    loadGames()
    loadProfiles()
  }, [selectedWeek])

  // Add new game
  const handleAddGame = async () => {
    const { away, home, spread, kickoff } = newGame
    const { error } = await supabase.from('games').insert([
      {
        week: selectedWeek,
        away_team: away,
        home_team: home,
        spread: parseFloat(spread),
        kickoff_time: new Date(kickoff).toISOString()
      }
    ])
    if (error) alert('Error adding game: ' + error.message)
    else {
      setNewGame({ away: '', home: '', spread: '', kickoff: '' })
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

  // Clear week games
  const handleClearWeek = async () => {
    if (!confirm(`Clear all games for Week ${selectedWeek}?`)) return
    const { error } = await supabase.from('games').delete().eq('week', selectedWeek)
    if (error) alert('Error clearing games: ' + error.message)
    else setGames([])
  }

  // Delete a user via API
  const handleDeleteUser = async (email) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return
    const res = await fetch('/api/delete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const { error } = await res.json()
    if (error) alert('Delete failed: ' + error)
    else loadProfiles()
  }

  // Load a user's picks for a week
  const loadUserPicks = async () => {
    if (!userForPicks) return alert('Select a user')
    setLoadingPicks(true)
    const { data, error } = await supabase
      .from('picks')
      .select(`
        game_id,
        selected_team,
        is_lock,
        games(away_team,home_team,spread,kickoff_time)
      `)
      .eq('user_email', userForPicks)
      .eq('games.week', weekForPicks)
      .order('games.kickoff_time', { ascending: true })

    if (error) alert('Error loading picks: ' + error.message)
    else setUserPicks(data)
    setLoadingPicks(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin</h1>
      <p><Link href='/'><a>← Home</a></Link></p>

      {/* Game Management */}
      <section style={{ marginBottom: 40 }}>
        <h2>Game Management (Week {selectedWeek})</h2>
        <div style={{ marginBottom: 16 }}>
          <label>Week:&nbsp;
            <input
              type='number' min='1'
              value={selectedWeek}
              onChange={e => setSelectedWeek(parseInt(e.target.value,10)||1)}
              style={{ width: 60 }}
            />
          </label>
          <button onClick={handleClearWeek} style={{ marginLeft: 12 }}>Clear Week</button>
        </div>
        {loadingGames ? <p>Loading games…</p> : (
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
                    <button onClick={() => handleDeleteGame(g.id)} style={{ background: 'red', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 style={{ marginTop: 24 }}>Add New Game</h3>
        <div style={{ marginBottom: 16 }}>
          <input placeholder='Away Team' value={newGame.away} onChange={e => setNewGame({ ...newGame, away: e.target.value })} style={{ marginRight: 8 }} />
          <input placeholder='Home Team' value={newGame.home} onChange={e => setNewGame({ ...newGame, home: e.target.value })} style={{ marginRight: 8 }} />
          <input placeholder='Spread' type='number' value={newGame.spread} onChange={e => setNewGame({ ...newGame, spread: e.target.value })} style={{ width: 80, marginRight: 8 }} />
          <input placeholder='Kickoff (ISO)' value={newGame.kickoff} onChange={e => setNewGame({ ...newGame, kickoff: e.target.value })} style={{ marginRight: 8 }} />
          <button onClick={handleAddGame}>Add Game</button>
        </div>
      </section>

      {/* User Management */}
      <section style={{ marginBottom: 40 }}>
        <h2>User Management</h2>
        {loadingProfiles ? <p>Loading members…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style...
