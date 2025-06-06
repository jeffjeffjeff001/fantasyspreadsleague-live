// pages/admin.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase    = createClient(supabaseUrl, supabaseKey)

export default function AdminUpload() {
  // State for selected week, default to 1
  const [selectedWeek, setSelectedWeek] = useState(1)
  // State to hold existing games fetched from Supabase for that week
  const [existingGames, setExistingGames] = useState([])
  // State to manage new‐game input rows (home/away/spread/time)
  const [newGames, setNewGames] = useState([
    { home: '', away: '', spread: '', time: '' }
  ])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  // Fetch existing games whenever selectedWeek changes
  useEffect(() => {
    async function fetchExisting() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('week', selectedWeek)
          .order('kickoff_time', { ascending: true })
        if (error) throw error
        setExistingGames(data || [])
      } catch (err) {
        console.error('Error fetching games:', err)
        setStatus(`🚫 Error loading games: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    fetchExisting()
  }, [selectedWeek])

  // Handle deleting a single game by id
  const handleDeleteGame = async (gameId) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)
      if (error) throw error
      // Refresh list
      setExistingGames((prev) => prev.filter((g) => g.id !== gameId))
      setStatus('✅ Deleted game successfully.')
    } catch (err) {
      console.error('Error deleting game:', err)
      setStatus(`🚫 Error deleting: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Clear all games for this week
  const handleClearWeek = async () => {
    if (!confirm(`Are you sure you want to delete ALL games for Week ${selectedWeek}?`)) {
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('week', selectedWeek)
      if (error) throw error
      setExistingGames([])
      setStatus(`✅ Cleared all games for Week ${selectedWeek}.`)
    } catch (err) {
      console.error('Error clearing week:', err)
      setStatus(`🚫 Error clearing: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle input change for new game rows
  const handleNewGameChange = (idx, field, value) => {
    const copy = [...newGames]
    copy[idx][field] = value
    setNewGames(copy)
  }

  // Add a blank new‐game row
  const addNewGameRow = () => {
    setNewGames([...newGames, { home: '', away: '', spread: '', time: '' }])
  }

  // Submit all new games for this week
  const submitNewGames = async () => {
    setStatus(null)
    setLoading(true)
    try {
      // Build array of insert objects, injecting selectedWeek
      const inserts = newGames.map((game) => ({
        home_team: game.home,
        away_team: game.away,
        spread: parseFloat(game.spread) || 0,
        kickoff_time: game.time,      // Save as‐is to avoid timezone shift
        week: selectedWeek
      }))
      const { error } = await supabase.from('games').insert(inserts)
      if (error) throw error

      // Refresh existingGames by refetching
      const { data: fresh, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('week', selectedWeek)
        .order('kickoff_time', { ascending: true })
      if (fetchError) throw fetchError
      setExistingGames(fresh || [])

      // Reset new‐game inputs to a single blank row
      setNewGames([{ home: '', away: '', spread: '', time: '' }])
      setStatus('✅ New games added successfully!')
    } catch (err) {
      console.error('Error inserting new games:', err)
      setStatus(`🚫 Error adding games: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload & Manage Week {selectedWeek} Games</h2>

      {/* Return Home */}
      <p>
        <Link href="/">
          <a style={{ color: '#0070f3', textDecoration: 'underline' }}>
            ← Return Home
          </a>
        </Link>
      </p>

      {/* Week Selector */}
      <div style={{ marginBottom: 16 }}>
        <label>
          Select Week:&nbsp;
          <input
            type="number"
            min="1"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10) || 1)}
            style={{ width: 60 }}
          />
        </label>
        &nbsp;
        <button onClick={() => setSelectedWeek(selectedWeek)} disabled={loading}>
          Load Games
        </button>
      </div>

      {/* Show Existing Games for This Week */}
      <div style={{ marginBottom: 20 }}>
        <h3>Existing Games (Week {selectedWeek})</h3>
        {loading ? (
          <p>Loading…</p>
        ) : existingGames.length ? (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Matchup</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Spread</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Kickoff Time</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {existingGames.map((g) => (
                <tr key={g.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {g.away_team} @ {g.home_team}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{g.spread}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {new Date(g.kickoff_time).toLocaleString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                    <button onClick={() => handleDeleteGame(g.id)} disabled={loading}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No games loaded for Week {selectedWeek}.</p>
        )}

        {/* Clear All Games for This Week */}
        {existingGames.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={handleClearWeek} disabled={loading}>
              🗑️ Clear All Games for Week {selectedWeek}
            </button>
          </div>
        )}
      </div>

      {/* Add New Games */}
      <div style={{ marginBottom: 16 }}>
        <h3>Add New Games for Week {selectedWeek}</h3>
        {newGames.map((game, idx) => (
          <div key={idx} style={{ marginBottom: 10 }}>
            <input
              placeholder="Home Team"
              value={game.home}
              onChange={(e) => handleNewGameChange(idx, 'home', e.target.value)}
              style={{ marginRight: 8 }}
            />
            <input
              placeholder="Away Team"
              value={game.away}
              onChange={(e) => handleNewGameChange(idx, 'away', e.target.value)}
              style={{ marginRight: 8 }}
            />
            <input
              placeholder="Spread"
              value={game.spread}
              onChange={(e) => handleNewGameChange(idx, 'spread', e.target.value)}
              style={{ width: 60, marginRight: 8 }}
            />
            <input
              type="datetime-local"
              placeholder="Kickoff Time"
              value={game.time}
              onChange={(e) => handleNewGameChange(idx, 'time', e.target.value)}
              style={{ marginRight: 8 }}
            />
          </div>
        ))}
        <button onClick={addNewGameRow} disabled={loading} style={{ marginRight: 12 }}>
          + Add Another Game
        </button>
        <button onClick={submitNewGames} disabled={loading}>
          Submit New Games
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <p style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{status}</p>
      )}
    </div>
  )
}
