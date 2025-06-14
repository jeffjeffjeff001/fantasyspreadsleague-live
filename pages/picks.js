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

  // load Week 1 games
  useEffect(() => {
    supabase
      .from('games')
      .select('*')
      .eq('week', 1)
      .order('kickoff_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) setStatus(`🚫 ${error.message}`)
        else setGames(data || [])
      })
  }, [])

  // Helpers
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // Count categories
  const counts = (map) => {
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

  // Toggle pick & auto-hide game when picked
  const handlePick = (gid, team) => {
    setStatus(null)
    const copy = { ...picks }

    // un-select
    if (copy[gid] === team) {
      delete copy[gid]
      setPicks(copy)
      return
    }

    // enforce total ≤5
    if (Object.keys(copy).length >= 5) {
      setStatus('🚫 You can only pick up to 5 games total.')
      return
    }

    // enforce category caps
    const tmp = { ...copy, [gid]: team }
    const { th, mo, be } = counts(tmp)
    if (th > 1) {
      setStatus('🚫 Only 1 Thursday pick allowed.')
      return
    }
    if (mo > 1) {
      setStatus('🚫 Only 1 Monday pick allowed.')
      return
    }
    if (be > 3) {
      setStatus('🚫 Only 3 “Best Choice” picks allowed.')
      return
    }

    // commit pick (and game will auto-disappear)
    copy[gid] = team
    setPicks(copy)
  }

  // Toggle lock
  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

  // Save picks
  const save = async () => {
    const inserts = Object.entries(picks).map(([gid, team]) => ({
      user_email: email,
      game_id: gid,
      selected_team: team,
      is_lock: gid === lockPick
    }))
    const { error } = await supabase.from('picks').insert(inserts)
    if (error) setStatus(`🚫 ${error.message}`)
    else {
      setStatus('✅ Picks saved!')
      setPicks({})
      setLockPick(null)
    }
  }

  // Submit
  const submitPicks = () => {
    if (!email) {
      setStatus('🚫 Please enter your email!')
      return
    }
    if (Object.keys(picks).length === 0) {
      setStatus('🚫 Please select at least one game.')
      return
    }
    save()
  }

  // Only show games not already picked
  const available = games.filter((g) => !(g.id in picks))

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

      {available.map((g) => (
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
