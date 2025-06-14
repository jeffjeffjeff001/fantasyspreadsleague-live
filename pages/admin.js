// pages/admin.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase    = createClient(supabaseUrl, supabaseKey)

export default function AdminUpload() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [existingGames, setExistingGames] = useState([])
  const [newGames, setNewGames] = useState([{ home: '', away: '', spread: '', time: '' }])
  const [upcomingPicks, setUpcomingPicks] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load games + upcoming picks for the week
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setStatus(null)
      try {
        // 1) Games
        const { data: gamesData, error: gErr } = await supabase
          .from('games')
          .select('*')
          .eq('week', selectedWeek)
          .order('kickoff_time', { ascending: true })
        if (gErr) throw gErr
        setExistingGames(gamesData || [])

        // 2) Picks for games not yet kicked off
        const nowISO = new Date().toISOString()
        const { data: picksData, error: pErr } = await supabase
          .from('picks')
          .select(`
            id,
            user_email,
            selected_team,
            is_lock,
            games ( id, home_team, away_team, kickoff_time )
          `)
          .eq('games.week', selectedWeek)
          .gte('kickoff_time', nowISO, { foreignTable: 'games' })
          .order('kickoff_time', { ascending: true, foreignTable: 'games' })
        if (pErr) throw pErr
        setUpcomingPicks(picksData || [])
      } catch (err) {
        console.error(err)
        setStatus(`🚫 Error loading data: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedWeek])

  // Delete a single game (cascade by first removing its picks)
  const handleDeleteGame = async (gameId) => {
    if (!confirm('Delete this game and all its picks?')) return
    setLoading(true)
    try {
      // 1) Delete picks for this game
      let { error: pickErr } = await supabase.from('picks').delete().eq('game_id', gameId)
      if (pickErr) throw pickErr
      // 2) Delete the game
      let { error: gameErr } = await supabase.from('games').delete().eq('id', gameId)
      if (gameErr) throw gameErr
      // Update UI
      setExistingGames((g) => g.filter((x) => x.id !== gameId))
      setUpcomingPicks((p) => p.filter((x) => x.games.id !== gameId))
      setStatus('✅ Game and its picks deleted.')
    } catch (err) {
      console.error(err)
      setStatus(`🚫 ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Clear all games & their picks for the week
  const handleClearWeek = async () => {
    if (!confirm(`Clear ALL games & picks for Week ${selectedWeek}?`)) return
    setLoading(true)
    try {
      // Get IDs
      const ids = existingGames.map((g) => g.id)
      if (ids.length) {
        // 1) Delete all picks for these games
        let { error: pickErr } = await supabase.from('picks').delete().in('game_id', ids)
        if (pickErr) throw pickErr
        // 2) Delete the games
        let { error: gameErr } = await supabase.from('games').delete().in('id', ids)
        if (gameErr) throw gameErr
      }
      // Reset UI
      setExistingGames([])
      setUpcomingPicks([])
      setStatus(`✅ Cleared Week ${selectedWeek} games & picks.`)
    } catch (err) {
      console.error(err)
      setStatus(`🚫 ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Delete a single upcoming pick
  const handleDeletePick = async (pickId) => {
    if (!confirm('Delete this pick?')) return
    setLoading(true)
    try {
      let { error } = await supabase.from('picks').delete().eq('id', pickId)
      if (error) throw error
      setUpcomingPicks((p) => p.filter((x) => x.id !== pickId))
      setStatus('✅ Pick deleted.')
    } catch (err) {
      console.error(err)
      setStatus(`🚫 ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // New‐game form handlers
  const handleNewGameChange = (i, field, v) => {
    const copy = [...newGames]
    copy[i][field] = v
    setNewGames(copy)
  }
  const addNewGameRow = () =>
    setNewGames([...newGames, { home: '', away: '', spread: '', time: '' }])

  // Submit new games for the week
  const submitNewGames = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const inserts = newGames.map((g) => ({
        home_team: g.home,
        away_team: g.away,
        spread: parseFloat(g.spread) || 0,
        kickoff_time: g.time,
        week: selectedWeek
      }))
      let { error } = await supabase.from('games').insert(inserts)
      if (error) throw error
      setStatus('✅ New games added.')
      setNewGames([{ home: '', away: '', spread: '', time: '' }])
      // Refresh via effect
      setSelectedWeek(selectedWeek)
    } catch (err) {
      console.error(err)
      setStatus(`🚫 ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Manage Week {selectedWeek} Games & Picks</h2>
      <p>
        <Link href="/"><a>← Return Home</a></Link>
      </p>

      {/* Week selector */}
      <div>
        <label>
          Week:&nbsp;
          <input
            type="number"
            min="1"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10) || 1)}
            style={{ width: 60 }}
          />
        </label>
        <button onClick={() => setSelectedWeek(selectedWeek)} disabled={loading}>
          Load
        </button>
      </div>

      {/* Existing Games */}
      <section style={{ marginTop: 20 }}>
        <h3>Existing Games</h3>
        {loading ? (
          <p>Loading…</p>
        ) : existingGames.length ? (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{border:'1px solid #ccc',padding:8}}>Matchup</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Spread</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Kickoff</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {existingGames.map((g) => (
                <tr key={g.id}>
                  <td style={{border:'1px solid #ccc',padding:8}}>
                    {g.away_team} @ {g.home_team}
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8}}>{g.spread}</td>
                  <td style={{border:'1px solid #ccc',padding:8}}>
                    {new Date(g.kickoff_time).toLocaleString()}
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8, textAlign:'center'}}> 
                    <button onClick={()=>handleDeleteGame(g.id)} disabled={loading}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No games for this week.</p>
        )}

        {existingGames.length > 0 && (
          <button onClick={handleClearWeek} disabled={loading} style={{marginTop:8}}>
            Clear All Games & Picks
          </button>
        )}
      </section>

      {/* Upcoming Picks */}
      <section style={{ marginTop: 40 }}>
        <h3>Manage Upcoming Picks</h3>
        {upcomingPicks.length ? (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={{border:'1px solid #ccc',padding:8}}>User</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Matchup</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Pick</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Lock?</th>
                <th style={{border:'1px solid #ccc',padding:8}}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {upcomingPicks.map((p) => (
                <tr key={p.id}>
                  <td style={{border:'1px solid #ccc',padding:8}}>{p.user_email}</td>
                  <td style={{border:'1px solid #ccc',padding:8}}>
                    {p.games.away_team} @ {p.games.home_team}
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8}}>{p.selected_team}</td>
                  <td style={{border:'1px solid #ccc',padding:8,textAlign:'center'}}>
                    {p.is_lock ? '✅' : ''}
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8,textAlign:'center'}}>
                    <button onClick={()=>handleDeletePick(p.id)} disabled={loading}>X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No upcoming picks to manage.</p>
        )}
      </section>

      {/* Add New Games */}
      <section style={{ marginTop: 40 }}>
        <h3>Add New Games</h3>
        {newGames.map((g, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <input
              placeholder="Home"
              value={g.home}
              onChange={(e)=>handleNewGameChange(i,'home',e.target.value)}
              style={{ marginRight:8 }}
            />
            <input
              placeholder="Away"
              value={g.away}
              onChange={(e)=>handleNewGameChange(i,'away',e.target.value)}
              style={{ marginRight:8 }}
            />
            <input
              placeholder="Spread"
              value={g.spread}
              onChange={(e)=>handleNewGameChange(i,'spread',e.target.value)}
              style={{ width:60, marginRight:8 }}
            />
            <input
              type="datetime-local"
              value={g.time}
              onChange={(e)=>handleNewGameChange(i,'time',e.target.value)}
              style={{ marginRight:8 }}
            />
          </div>
        ))}
        <button onClick={addNewGameRow} disabled={loading} style={{ marginRight:8 }}>+ New Row</button>
        <button onClick={submitNewGames} disabled={loading}>Submit Games</button>
      </section>

      {status && <p style={{ marginTop:20 }}>{status}</p>}
    </div>
  )
}
