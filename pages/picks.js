// pages/picks.js
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default function PickSubmission() {
  const [games, setGames] = useState([])
  const [email, setEmail] = useState('')
  const [picks, setPicks] = useState({})
  const [lockPick, setLockPick] = useState(null)
  const [status, setStatus] = useState(null)

  // Fetch Week 1 games from Supabase
  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('week', 1)           // hard‐coded for now; later you can make this dynamic
        .order('kickoff_time', { ascending: true })

      if (error) {
        console.error('Error fetching games:', error)
      } else {
        setGames(data)
      }
    }
    fetchGames()
  }, [])

  // When a user picks a team
  const handlePick = (gameId, team) => {
    setPicks({ ...picks, [gameId]: team })
  }

  // When a user marks the lock pick
  const handleLockChange = (gameId) => {
    setLockPick(gameId)
  }

  // Validate & submit picks to Supabase
  const submitPicks = async () => {
    // Ensure exactly 5 picks
    if (Object.keys(picks).length !== 5) {
      setStatus('You must make exactly 5 picks.')
      return
    }
    // Ensure one lock pick
    if (!lockPick) {
      setStatus('You must choose one “lock” pick.')
      return
    }
    // Ensure lockPick is among the 5 picks
    if (!picks[lockPick]) {
      setStatus('Your lock pick must be one of your 5 picks.')
      return
    }

    setStatus('Submitting picks…')

    try {
      // Prepare insert array
      const inserts = Object.entries(picks).map(([game_id, selected_team]) => ({
        user_email: email,
        game_id,
        selected_team,
        is_lock: game_id === lockPick
      }))

      const { error } = await supabase.from('picks').insert(inserts)
      if (error) throw error

      setStatus('Picks submitted successfully!')
      // Optionally clear the form:
      setPicks({})
      setLockPick(null)
    } catch (err) {
      console.error('Error inserting picks:', err)
      setStatus(`Error: ${err.message}`)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />
      {games.map((game) => (
        <div key={game.id} style={{ marginBottom: 12 }}>
          <strong>
            {game.away_team} @ {game.home_team} ({game.spread})
          </strong>
          <br />
          <label>
            <input
              type="radio"
              name={`pick-${game.id}`}
              checked={picks[game.id] === game.home_team}
              onChange={() => handlePick(game.id, game.home_team)}
            />{' '}
            {game.home_team}
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="radio"
              name={`pick-${game.id}`}
              checked={picks[game.id] === game.away_team}
              onChange={() => handlePick(game.id, game.away_team)}
            />{' '}
            {game.away_team}
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={lockPick === game.id}
              onChange={() => handleLockChange(game.id)}
            />{' '}
            Lock
          </label>
        </div>
      ))}
      <button onClick={submitPicks}>Submit Picks</button>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </div>
  )
}
