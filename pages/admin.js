import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function Admin() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  // New game form
  const [newGameAway, setNewGameAway] = useState('')
  const [newGameHome, setNewGameHome] = useState('')
  const [newGameSpread, setNewGameSpread] = useState('')
  const [newGameKickoff, setNewGameKickoff] = useState('')

  // View user picks
  const [userForPicks, setUserForPicks] = useState('')
  const [weekForPicks, setWeekForPicks] = useState(1)
  const [userPicks, setUserPicks] = useState([])
  const [loadingPicks, setLoadingPicks] = useState(false)

  // Load games
  const loadGames = async () => {
    setLoadingGames(true)
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true })
    if (error) {
      alert('Error loading games: ' + error.message)
    } else {
      setGames(data)
    }
    setLoadingGames(false)
  }

  // Load profiles
  const loadProfiles = async () => {
    setLoadingProfiles(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('email, username, first_name, last_name')
      .order('username', { ascending: true })
    if (error) {
      alert('Error loading profiles: ' + error.message)
    } else {
      setProfiles(data)
    }
    setLoadingProfiles(false)
  }

  useEffect(() => {
    loadGames()
    loadProfiles()
  }, [selectedWeek])

  // Add game
  const handleAddGame = async () => {
    const game = {
      week: selectedWeek,
      away_team: newGameAway,
      home_team: newGameHome,
      spread: parseFloat(newGameSpread),
      kickoff_time: new Date(newGameKickoff).toISOString()
    }
    const { error } = await supabase.from('games').insert([game])
    if (error) {
      alert('Error adding game: ' + error.message)
    } else {
      setNewGameAway('')
      setNewGameHome('')
      setNewGameSpread('')
      setNewGameKickoff('')
      loadGames()
    }
  }

  // Delete game
  const handleDeleteGame = async (id) => {
    if (!window.confirm('Delete this game?')) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) {
      alert('Error deleting game: ' + error.message)
    } else {
      loadGames()
    }
  }

  // Clear week
  const handleClearWeek = async () => {
    if (!window.confirm('Clear all games for Week ' + selectedWeek + '?')) return
    const { error } = await supabase.from('games').delete().eq('week', selectedWeek)
    if (error) {
      alert('Error clearing games: ' + error.message)
    } else {
      setGames([])
    }
  }

  // Delete user
  const handleDeleteUser = async (email) => {
    if (!window.confirm('Delete user ' + email + '?')) return
    const res = await fetch('/api/delete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const body = await res.json()
    if (body.error) alert('Error deleting user: ' + body.error)
    else loadProfiles()
  }

  // Load user picks
  const loadUserPicks = async () => {
    if (!userForPicks) {
      alert('Please select a user')
      return
    }
    setLoadingPicks(true)
    const { data, error } = await supabase
      .from('picks')
      .select('selected_team, is_lock, games(away_team,home_team,kickoff_time)')
      .eq('user_email', userForPicks)
      .eq('games.week', weekForPicks)
      .order('games.kickoff_time', { ascending: true, foreignTable: 'games' })
    if (error) {
      alert('Error loading picks: ' + error.message)
    } else {
      setUserPicks(data)
    }
    setLoadingPicks(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin</h1>
      <Link href='/'><a>← Home</a></Link>

      {/* Game Management */}
      <section style={{ marginTop: 20 }}>
        <h2>Game Management (Week {selectedWeek})</h2>
        <div>
          <label>Week: <input type='number' min='1' value={selectedWeek} onChange={e => setSelectedWeek(parseInt(e.target.value) || 1)} style={{ width: 60 }} /></label>
          <button onClick={handleClearWeek} style={{ marginLeft: 12 }}>Clear Week</button>
        </div>
        {loadingGames ? <p>Loading games…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
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
                    <button onClick={() => handleDeleteGame(g.id)} style={{ background: 'red', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12 }}>
          <input placeholder='Away Team' value={newGameAway} onChange={e => setNewGameAway(e.target.value)} />
          <input placeholder='Home Team' value={newGameHome} onChange={e => setNewGameHome(e.target.value)} style={{ marginLeft: 8 }} />
          <input placeholder='Spread' type='number' value={newGameSpread} onChange={e => setNewGameSpread(e.target.value)} style={{ marginLeft: 8, width: 80 }} />
          <input placeholder='Kickoff (ISO)' value={newGameKickoff} onChange={e => setNewGameKickoff(e.target.value)} style={{ marginLeft: 8 }} />
          <button onClick={handleAddGame} style={{ marginLeft: 8 }}>Add Game</button>
        </div>
      </section>

      {/* User Management */}
      <section style={{ marginTop: 40 }}>
        <h2>User Management</h2>
        {loadingProfiles ? <p>Loading profiles…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Username</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Name</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Email</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.email}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.username}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.first_name} {p.last_name}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.email}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                    <button onClick={() => handleDeleteUser(p.email)} style={{ background: 'red', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* View User Picks */}
      <section style={{ marginTop: 40 }}>
        <h2>View User Picks</h2>
        <div>
          <select value={userForPicks} onChange={e => setUserForPicks(e.target.value)}>
            <option value=''>Select user</option>
            {profiles.map(p => (
              <option key={p.email} value={p.email}>{p.username}</option>
            ))}
          </select>
          <input type='number' min='1' value={weekForPicks} onChange={e => setWeekForPicks(parseInt(e.target.value) || 1)} style={{ marginLeft: 8, width: 60 }} />
          <button onClick={loadUserPicks} style={{ marginLeft: 8 }}>Load Picks</button>
        </div>
        {loadingPicks ? <p>Loading picks…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Game</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Pick</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Lock?</th>
              </tr>
            </thead>
            <tbody>
              {userPicks.map((pick, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {pick.games.away_team} @ {pick.games.home_team}
                    <br />
                    <small>{new Date(pick.games.kickoff_time).toLocaleString()}</small>
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{pick.selected_team}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>{pick.is_lock ? '✅' : ''}</td>
                </tr>
              ))}
              {userPicks.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 8, textAlign: 'center' }}>No picks found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
