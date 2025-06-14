// pages/picks.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function PickSubmission() {
  const [games, setGames]       = useState([])
  const [email, setEmail]       = useState('')
  const [picks, setPicks]       = useState({})      // { gameId: team }
  const [lockPick, setLockPick] = useState(null)
  const [status, setStatus]     = useState(null)

  // Helper to filter only future games
  const filterFuture = (list) => {
    const now = new Date()
    return list.filter((g) => new Date(g.kickoff_time) > now)
  }

  // 1) Fetch all week-1 games on mount, keep only future ones
  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('week', 1)
        .order('kickoff_time', { ascending: true })
      if (error) {
        setStatus(`🚫 ${error.message}`)
      } else {
        setGames(filterFuture(data || []))
      }
    }
    fetchGames()
  }, [])

  // 2) Every 30s, remove any games whose kickoff_time has passed
  useEffect(() => {
    const tid = setInterval(() => {
      setGames((prev) => filterFuture(prev))
    }, 30000)
    return () => clearInterval(tid)
  }, [])

  // Day‐of‐week helpers
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // Count categories in a pick‐map
  const countCats = (map) => {
    let th = 0, mo = 0, be = 0
    Object.keys(map).forEach((id) => {
      const g = games.find((x) => x.id === id)
      if (!g) return
      if (isThursday(g.kickoff_time)) th++
      else if (isMonday(g.kickoff_time)) mo++
      else be++
    })
    return { th, mo, be }
  }

  // Toggle a pick (enforce caps)
  const handlePick = (gid, team) => {
    setStatus(null)
    const copy = { ...picks }

    // un-select if same
    if (copy[gid] === team) {
      delete copy[gid]
      setPicks(copy)
      return
    }

    // total cap
    if (Object.keys(copy).length >= 5) {
      setStatus('🚫 You can only pick up to 5 games.')
      return
    }

    // category caps
    const tmp = { ...copy, [gid]: team }
    const { th, mo, be } = countCats(tmp)
    if (th > 1)      { setStatus('🚫 Only 1 Thursday pick allowed.'); return }
    if (mo > 1)      { setStatus('🚫 Only 1 Monday pick allowed.');   return }
    if (be > 3)      { setStatus('🚫 Only 3 “Best Choice” picks allowed.'); return }

    copy[gid] = team
    setPicks(copy)
  }

  // Toggle lock
  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

  // Save & then remove submitted games
  const savePicks = async () => {
    const entries = Object.entries(picks)
    const inserts = entries.map(([gid, team]) => ({
      user_email: email,
      game_id: gid,
      selected_team: team,
      is_lock: gid === lockPick
    }))
    const { error } = await supabase.from('picks').insert(inserts)
    if (error) {
      setStatus(`🚫 ${error.message}`)
      return
    }
    // on success, remove those games from the list
    const submittedIds = entries.map(([gid]) => gid)
    setGames((prev) => prev.filter((g) => !submittedIds.includes(g.id)))
    setPicks({})
    setLockPick(null)
    setStatus('✅ Picks submitted—those games are now hidden.')
  }

  // Validate email & at least one pick, then save
  const submitPicks = () => {
    setStatus(null)
    if (!email) {
      setStatus('🚫 Please enter your email.')
      return
    }
    if (!Object.keys(picks).length) {
      setStatus('🚫 Please select at least one game.')
      return
    }
    savePicks()
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />

      {games.map((g) => (
        <div key={g.id} style={{ marginBottom: 12 }}>
          <strong>
            {g.away_team} @ {g.home_team} ({g.spread}) —{' '}
            {new Date(g.kickoff_time).toLocaleString(undefined, {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </strong>
          <br />
          <label>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id] === g.home_team}
              onClick={() => handlePick(g.id, g.home_team)}
            />{' '}
            {g.home_team}
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id] === g.away_team}
              onClick={() => handlePick(g.id, g.away_team)}
            />{' '}
            {g.away_team}
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={lockPick === g.id}
              onChange={() => handleLock(g.id)}
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
