// pages/picks.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Supabase init
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase     = createClient(supabaseUrl, supabaseKey)

export default function PickSubmission() {
  const [games, setGames]       = useState([])
  const [email, setEmail]       = useState('')
  const [picks, setPicks]       = useState({})      // { gameId: teamName }
  const [lockPick, setLockPick] = useState(null)    // optional
  const [status, setStatus]     = useState(null)

  // Load week-1 games
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

  // Helpers for day checks
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // Toggle a pick: click to select or un-select
  const handlePick = (gid, team) => {
    if (picks[gid] === team) {
      const copy = { ...picks }
      delete copy[gid]
      setPicks(copy)
    } else {
      setPicks({ ...picks, [gid]: team })
    }
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
      setPicks({}); setLockPick(null)
    }
  }

  // Submission logic with category caps
  const submitPicks = () => {
    setStatus(null)
    const ids = Object.keys(picks)
    const total = ids.length

    // Category counts
    const thursCount = ids.filter((id) => isThursday(games.find(g=>g.id===id).kickoff_time)).length
    const monCount   = ids.filter((id) => isMonday  (games.find(g=>g.id===id).kickoff_time)).length
    const bestCount  = total - thursCount - monCount

    // Too many total
    if (total > 5) {
      setStatus('🚫 Too many picks: you can select at most 5 games.')
      return
    }

    // Too many in any category
    if (thursCount > 1) {
      setStatus('🚫 Too many Thursday picks: maximum 1 allowed.')
      return
    }
    if (monCount > 1) {
      setStatus('🚫 Too many Monday picks: maximum 1 allowed.')
      return
    }
    if (bestCount > 3) {
      setStatus('🚫 Too many “Best 3” picks: maximum 3 non-Thu/Mon games.')
      return
    }

    // Must include at least 1 Thursday and 1 Monday if submitting 5
    if (total === 5) {
      if (thursCount < 1 || monCount < 1) {
        setStatus('🚫 For 5 picks, include at least 1 Thursday and 1 Monday game.')
        return
      }
    }

    // Single pick always OK
    if (total === 1) {
      setStatus('⏳ Saving your pick…')
      return save()
    }

    // Best 3 exactly if total===3
    if (total === 3 && thursCount === 0 && monCount === 0) {
      setStatus('⏳ Saving “Best 3” picks…')
      return save()
    }

    // 5 picks case handled above
    if (total === 5) {
      setStatus('⏳ Saving 5 picks…')
      return save()
    }

    // Otherwise invalid combination
    setStatus(
      '🚫 Invalid selection. You may:\n' +
      '- Submit 1 pick (any game), OR\n' +
      '- Submit exactly 3 Best 3 picks (no Thu/Mon), OR\n' +
      '- Submit exactly 5 picks (must include ≥1 Thurs & ≥1 Mon).'
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />

      {games.map((g) => (
        <div key={g.id} style={{ marginBottom: 12 }}>
          <strong>
            {g.away_team} @ {g.home_team} ({g.spread}) —{' '}
            {new Date(g.kickoff_time).toLocaleString(undefined, {
              weekday:'short', hour:'2-digit', minute:'2-digit'
            })}
          </strong>
          <br/>
          <label>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id]===g.home_team}
              onClick={()=>handlePick(g.id, g.home_team)}
            />{' '}
            {g.home_team}
          </label>
          <label style={{ marginLeft:12 }}>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id]===g.away_team}
              onClick={()=>handlePick(g.id, g.away_team)}
            />{' '}
            {g.away_team}
          </label>
          <label style={{ marginLeft:12 }}>
            <input
              type="checkbox"
              checked={lockPick===g.id}
              onChange={()=>handleLock(g.id)}
            />{' '}
            Lock
          </label>
        </div>
      ))}

      <button onClick={submitPicks}>Submit Picks</button>

      {status && (
        <pre style={{ whiteSpace:'pre-wrap', marginTop:16 }}>{status}</pre>
      )}
    </div>
  )
}
