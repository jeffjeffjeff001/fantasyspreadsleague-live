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

  // Load Week 1 games once
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

  // Count how many picks fall in each category
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

  // Toggle a pick (no removal of games yet)
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
    const { th, mo, be } = countCats(tmp)
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

    // commit pick
    copy[gid] = team
    setPicks(copy)
  }

  // Toggle lock on/off
  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

  // Persist picks to Supabase, then remove those games from the list
  const savePicks = async () => {
    const entries = Object.entries(picks)
    if (!entries.length) return

    // build insert payload
    const inserts = entries.map(([gid, team]) => ({
      user_email: email,
      game_id: gid,
      selected_team: team,
      is_lock: gid === lockPick
    }))

    // insert
    const { error } = await supabase.from('picks').insert(inserts)
    if (error) {
      setStatus(`🚫 ${error.message}`)
      return
    }

    // success: remove those games from our local list
    const submittedIds = entries.map(([gid]) => gid)
    setGames((prev) => prev.filter((g) => !submittedIds.includes(g.id)))

    // reset picks + lock
    setPicks({})
    setLockPick(null)
    setStatus('✅ Picks submitted and removed from list.')
  }

  // Validate then save
  const submitPicks = () => {
    setStatus(null)
    if (!email) {
      setStatus('🚫 Please enter your email.')
      return
    }
    const total = Object.keys(picks).length
    if (total === 0) {
      setStatus('🚫 Please select at least one game.')
      return
    }
    // all constraints are enforced on pick action, so just save
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
          <br/>
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
