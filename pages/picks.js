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
  const [picks, setPicks]       = useState({})      // { gameId: teamName }
  const [lockPick, setLockPick] = useState(null)    // gameId or null
  const [status, setStatus]     = useState(null)

  // Fetch Week 1 games on load (you can modify for dynamic week later)
  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('week', 1)
        .order('kickoff_time', { ascending: true })

      if (error) {
        console.error('Error fetching games:', error)
        setStatus(`🚫 Error loading games: ${error.message}`)
      } else {
        setGames(data || [])
      }
    }
    fetchGames()
  }, [])

  // Helpers to detect day of week (UTC)
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // Clicking a radio toggles selection/un-selection
  const handlePick = (gameId, team) => {
    if (picks[gameId] === team) {
      // already selected, so un-select
      const copy = { ...picks }
      delete copy[gameId]
      setPicks(copy)
    } else {
      // select this team for that game
      setPicks({ ...picks, [gameId]: team })
    }
  }

  // Toggle lockPick (checkbox)
  const handleLockChange = (gameId) => {
    setLockPick(gameId === lockPick ? null : gameId)
  }

  // Insert picks into Supabase
  const savePicksToDatabase = async () => {
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

  // Main validation & submission logic
  const submitPicks = async () => {
    setStatus(null)
    const pickedIds = Object.keys(picks)
    const count = pickedIds.length

    // Case 1: Exactly one pick, and it must be either Thursday OR Monday
    if (count === 1) {
      const onlyId   = pickedIds[0]
      const onlyGame = games.find((g) => g.id === onlyId)
      if (onlyGame && (isThursday(onlyGame.kickoff_time) || isMonday(onlyGame.kickoff_time))) {
        // Lock optional. If checked, must match that same game
        if (lockPick && lockPick !== onlyId) {
          setStatus('🚫 If you lock, it must be that same Thursday or Monday game.')
          return
        }
        setStatus('⏳ Saving one pick…')
        return await savePicksToDatabase()
      }
    }

    // Case 2: Exactly three picks, and none are Thursday or Monday (“Best Choice”)
    if (count === 3) {
      const anyThuMon = pickedIds.some((id) => {
        const g = games.find((gg) => gg.id === id)
        return g ? (isThursday(g.kickoff_time) || isMonday(g.kickoff_time)) : true
      })
      if (!anyThuMon) {
        // Lock optional. If checked, it must match one of the three picks
        if (lockPick && !pickedIds.includes(lockPick)) {
          setStatus('🚫 If you lock, pick one of the three selected games.')
          return
        }
        setStatus('⏳ Saving three “Best Choice” picks…')
        return await savePicksToDatabase()
      }
    }

    // Case 3 & 4: Exactly five picks. Must include >=1 Thursday AND >=1 Monday
    if (count === 5) {
      // Check at least one Thursday and one Monday in those five
      const hasThu = pickedIds.some((id) => {
        const g = games.find((gg) => gg.id === id)
        return g ? isThursday(g.kickoff_time) : false
      })
      const hasMon = pickedIds.some((id) => {
        const g = games.find((gg) => gg.id === id)
        return g ? isMonday(g.kickoff_time) : false
      })
      if (!hasThu || !hasMon) {
        setStatus('🚫 For five picks, you must include at least one Thursday and one Monday game.')
        return
      }

      // Lock OPTIONAL. If checked, must be one of the five
      if (lockPick && !pickedIds.includes(lockPick)) {
        setStatus('🚫 If you lock, it must be one of the five games you selected.')
        return
      }

      setStatus('⏳ Saving five picks…')
      return await savePicksToDatabase()
    }

    // Otherwise invalid
    setStatus(
      '🚫 Invalid submission. Your options are:\n' +
      '  • Exactly one pick (Thurs or Mon only), OR\n' +
      '  • Exactly three picks (none on Thurs/Monday), OR\n' +
      '  • Exactly five picks (must include ≥1 Thurs and ≥1 Mon).'
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>

      {/* Return Home Link */}
      <p>
        <Link href="/">
          <a style={{ color: '#0070f3', textDecoration: 'underline' }}>
            ← Return Home
          </a>
        </Link>
      </p>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 320 }}
      />

      {games.map((game) => (
        <div key={game.id} style={{ marginBottom: 12 }}>
          <strong>
            {game.away_team} @ {game.home_team} (Spread {game.spread}) —{' '}
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
              onClick={() => handlePick(game.id, game.home_team)}
            />{' '}
            {game.home_team}
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="radio"
              name={`pick-${game.id}`}
              checked={picks[game.id] === game.away_team}
              onClick={() => handlePick(game.id, game.away_team)}
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

      <button onClick={submitPicks} style={{ marginTop: 8 }}>
        Submit Picks
      </button>

      {status && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{status}</pre>
      )}
    </div>
  )
}
