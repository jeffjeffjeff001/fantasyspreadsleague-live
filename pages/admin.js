// pages/admin.js
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default function AdminUpload() {
  const [games, setGames] = useState([
    { home: '', away: '', spread: '', time: '', week: '' }
  ])
  const [status, setStatus] = useState(null)

  const handleChange = (index, field, value) => {
    const updated = [...games]
    updated[index][field] = value
    setGames(updated)
  }

  const addGameRow = () => {
    setGames([...games, { home: '', away: '', spread: '', time: '', week: '' }])
  }

  const submitGames = async () => {
    setStatus('Saving…')
    try {
      const inserts = games.map(game => ({
        home_team: game.home,
        away_team: game.away,
        spread: parseFloat(game.spread),
        kickoff_time: new Date(game.time).toISOString(),
        week: parseInt(game.week, 10)
      }))
      const { error } = await supabase.from('games').insert(inserts)
      if (error) throw error
      setStatus('Games saved successfully!')
      setGames([{ home: '', away: '', spread: '', time: '', week: '' }])
    } catch (err) {
      console.error(err)
      setStatus(`Error: ${err.message}`)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Week Games</h2>
      {games.map((game, idx) => (
        <div key={idx} style={{ marginBottom: 12 }}>
          <input
            placeholder="Home Team"
            value={game.home}
            onChange={e => handleChange(idx, 'home', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Away Team"
            value={game.away}
            onChange={e => handleChange(idx, 'away', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Spread"
            value={game.spread}
            onChange={e => handleChange(idx, 'spread', e.target.value)}
            style={{ width: 60, marginRight: 8 }}
          />
          <input
            type="datetime-local"
            placeholder="Kickoff Time"
            value={game.time}
            onChange={e => handleChange(idx, 'time', e.target.value)}
            style={{ marginRight: 8 }}
          />
          <input
            placeholder="Week #"
            value={game.week}
            onChange={e => handleChange(idx, 'week', e.target.value)}
            style={{ width: 60 }}
          />
        </div>
      ))}
      <button onClick={addGameRow} style={{ marginRight: 12 }}>
        Add Game
      </button>
      <button onClick={submitGames}>Save All to Database</button>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </div>
  )
}
