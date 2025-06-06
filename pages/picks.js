// pages/picks.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase     = createClient(supabaseUrl, supabaseKey)

export default function PickSubmission() {
  const [games, setGames]       = useState([])
  const [email, setEmail]       = useState('')
  const [picks, setPicks]       = useState({})
  const [lockPick, setLockPick] = useState(null)
  const [status, setStatus]     = useState(null)

  // Fetch Week 1 games from Supabase
  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('week', 1)
        .order('kickoff_time', { ascending: true })

      if (error) {
        console.error('Error fetching games:', error)
      } else {
        setGames(data)
      }
    }
    fetchGames()
  }, [])

  // Helpers to detect day of week (UTC)
  function isThursday(iso) {
    const d = new Date(iso)
    return d.getUTCDay() === 4
  }
  function isMonday(iso) {
    const d = new Date(iso)
    return d.getUTCDay() === 1
  }

  const handlePick = (gameId, team) => {
    setPicks({ ...picks, [gameId]: team })
  }
  const handleLockChange = (gameId) => {
    setLockPick(gameId === lockPick ? null : gameId)
  }

  async function savePicksToDatabase() {
    try {
      const inserts = Object.entries(picks).map(([game_id, selected_team]) => ({
        user_email: email,
        game_id,
        selected_team,
        is_lock: game_id === lockPick
      }))
      const { error } = await supabase.from('picks').insert(inserts)
      if (error) throw error

      setStatus('✅ Picks saved successfully!')
      setPicks({})
      setLockPick(null)
    } catch (err) {
      console.error('Error inserting picks:', err)
      setStatus(`🚫 Error: ${err.message}`)
    }
  }

  const submitPicks = async () => {
    setStatus(null)
    const pickedIds = Object.keys(picks)
    const count = pickedIds.length

    // Case 1: Only one game, and it’s on Thursday
    if (count === 1) {
      const onlyId   = pickedIds[0]
      const onlyGame = games.find((g) => g.id === onlyId)
      if (onlyGame && isThursday(onlyGame.kickoff_time)) {
        if (lockPick && lockPick !== onlyId) {
          setStatus('🚫 If you lock, it must be that same Thursday game.')
          return
        }
        setStatus('⏳ Saving Thursday‐only pick…')
        return await savePicksToDatabase()
      }
    }

    // Case 3: Only one game, and it’s on Monday
    if (count === 1) {
      const onlyId   = pickedIds[0]
      const onlyGame = games.find((g) => g.id === onlyId)
      if (onlyGame && isMonday(onlyGame.kickoff_time)) {
        if (lockPick && lockPick !== onlyId) {
          setStatus('🚫 If you lock, it must be that same Monday game.')
          return
        }
        setStatus('⏳ Saving Monday‐only pick…')
        return await savePicksToDatabase()
      }
    }

    // Case 2: Exactly 3 non‐Thu/Mon games (“Best Choice”)
    if (count === 3) {
      const invalid = pickedIds.some((id) => {
        const g = games.find((gg) => gg.id === id)
        return g ? (isThursday(g.kickoff_time) || isMonday(g.kickoff_time)) : true
      })
      if (!invalid) {
        if (lockPick && !pickedIds.includes(lockPick)) {
          setStatus('🚫 If you lock, it must be one of the three selected games.')
          return
        }
        setStatus('⏳ Saving “Best Choice” 3 picks…')
        return await savePicksToDatabase()
      }
    }

    // Case 4 & 5: Exactly 5 games (lock optional)
    if (count === 5) {
      if (lockPick && !pickedIds.includes(lockPick)) {
        setStatus('🚫 Your lock must be one of the five games you selected.')
        return
      }
      setStatus('⏳ Saving 5 picks…')
      return await savePicksToDatabase()
    }

    // Otherwise invalid
    setStatus(
      '🚫 Invalid submission. You must:\n' +
        '- Pick exactly one Thursday game, OR\n' +
        '- Pick exactly one Monday game, OR\n' +
        '- Pick exactly three games (none on Thursday or Monday), OR\n' +
        '- Pick exactly five games.'
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>
      {/* Return Home Button */}
      <p>
        <Link href="/">
          <a style={{ color: '#0070f3', textDecoration: 'underline' }}>← Return Home</a>
        </Link>
      </p>

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
            {game.away_team} @ {game.home_team} ({game.spread}) —{' '}
            <small>
              {new Date(game.kickoff_time).toLocaleString(undefined, {
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </small>
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

      {status && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{status}</pre>
      )}
    </div>
  )
}
