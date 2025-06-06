// pages/admin.js
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default function AdminUpload() {
  // Each game row will hold: home, away, spread, time, week
  const [games, setGames] = useState([
    { home: '', away: '', spread: '', time: '', week: '' }
  ])
  const [status, setStatus] = useState(null)

  // Update a field in one of the game rows
  const handleChange = (index, field, value) => {
    const updatedGames = [...games]
    updatedGames[index][field] = value
    setGames(updatedGames)
  }

  // Add a blank row at the bottom
  const addGameRow = () => {
    setGames([...games, { home: '', away: '', spread: '', time: '', week: '' }])
  }

  // Submit all game rows to Supabase
  const submitGames = async () => {
    setStatus('Saving…')
    try {
      // Build an array of objects to insert
      const inserts = games.map((game) => ({
        home_team: game.home,
        away_team: game.away,
        spread: parseFloat(game.spread),
        // ── UPDATED LINE BELOW: use game.time directly to avoid timezone shifts ──
        kickoff_time: game.time,
        week: parseInt(game.week, 10)
      }))

      const { error } = await supabase.from('games').insert(inserts)
      if (error) throw error

      setStatus('✅ Games saved successfully!')
      // Reset to a single blank row
      setGames([{ home: '', away: '', spread: '', time: '', week: '' }])
    } catch (err) {
      console.error(err)
      setStatus(`🚫 Error: ${err.message}`)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Week Games</h2>

      {/* Return Home Link */}
      <p>
        <Link href="/">
          <a style={{ color: '#0070f3', textDecoration: 'underline' }}>
            ← Return Home
          </a>
        </Link>
      </p>

      {games.map((game, idx) => (
        <div key={idx} style={{ marginBottom: 10 }}>
          <input
            placeholder="Home Team"
            value={game.home}
            onChange={(e) => handleChange(idx, 'home', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Away Team"
            value={game.away}
            onChange={(e) => handleChange(idx, 'away', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Spread"
            value={game.spread}
            onChange={(e) => handleChange(idx, 'spread', e.target.value)}
            style={{ width: 60, marginRight: 8 }}
          />
          <input
            type="datetime-local"
            placeholder="Kickoff Time"
            value={game.time}
            onChange={(e) => handleChange(idx, 'time', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Week #"
            value={game.week}
            onChange={(e) => handleChange(idx, 'week', e.target.value)}
            style={{ width: 60 }}
          />
        </div>
      ))}

      <button onClick={addGameRow} style={{ marginRight: 12 }}>
        Add Game
      </button>
      <button onClick={submitGames}>Submit Games</button>

      {status && (
        <p style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{status}</p>
      )}
    </div>
  )
}
