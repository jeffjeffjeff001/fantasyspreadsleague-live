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
  const [picks, setPicks]       = useState({})
  const [lockPick, setLockPick] = useState(null)
  const [status, setStatus]     = useState(null)

  // load week 1 games
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

  // day helpers
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // toggle pick
  const handlePick = (gid, team) => {
    if (picks[gid] === team) {
      const c = { ...picks }
      delete c[gid]
      setPicks(c)
    } else {
      setPicks({ ...picks, [gid]: team })
    }
  }

  // toggle lock
  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

  // save to Supabase
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
      setStatus('✅ Saved!')
      setPicks({}); setLockPick(null)
    }
  }

  // submit logic
  const submitPicks = () => {
    setStatus(null)
    const ids = Object.keys(picks), cnt = ids.length

    // 1) Any single pick OK
    if (cnt === 1) {
      const only = ids[0]
      if (lockPick && lockPick !== only) {
        setStatus('🚫 If you lock, it must match your single pick.')
        return
      }
      setStatus('⏳ Saving single pick…'); return save()
    }

    // 2) Best 3: exactly 3 AND none Thu/Mon
    if (cnt === 3) {
      const bad = ids.some(id => {
        const g = games.find(x => x.id === id)
        return g && (isThursday(g.kickoff_time) || isMonday(g.kickoff_time))
      })
      if (!bad) {
        if (lockPick && !ids.includes(lockPick)) {
          setStatus('🚫 Lock must be one of your three picks.')
          return
        }
        setStatus('⏳ Saving 3 picks…'); return save()
      }
    }

    // 3) Five picks: require ≥1 Thurs & ≥1 Mon
    if (cnt === 5) {
      const hasThu = ids.some(id => isThursday(games.find(g=>g.id===id).kickoff_time))
      const hasMon = ids.some(id => isMonday(games.find(g=>g.id===id).kickoff_time))
      if (!hasThu || !hasMon) {
        setStatus('🚫 5 picks must include at least 1 Thursday and 1 Monday game.')
        return
      }
      if (lockPick && !ids.includes(lockPick)) {
        setStatus('🚫 Lock must be one of your five picks.')
        return
      }
      setStatus('⏳ Saving 5 picks…'); return save()
    }

    // else invalid
    setStatus(
      '🚫 Invalid. You may:\n' +
      '- Submit exactly 1 pick, OR\n' +
      '- Submit exactly 3 non-Thu/Mon picks, OR\n' +
      '- Submit exactly 5 picks (must include ≥1 Thu & ≥1 Mon).'
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks (Week 1)</h2>
      <p>
        <Link href="/"><a>← Return Home</a></Link>
      </p>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />

      {games.map((g) => (
        <div key={g.id} style={{ marginBottom: 12 }}>
          <strong>
            {g.away_team} @ {g.home_team} ({g.spread}) —{' '}
            {new Date(g.kickoff_time).toLocaleString(undefined,{
              weekday:'short', hour:'2-digit', minute:'2-digit'
            })}
          </strong>
          <br />
          <label>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id]===g.home_team}
              onClick={()=>handlePick(g.id, g.home_team)}
            /> {g.home_team}
          </label>
          <label style={{ marginLeft:12 }}>
            <input
              type="radio"
              name={`pick-${g.id}`}
              checked={picks[g.id]===g.away_team}
              onClick={()=>handlePick(g.id, g.away_team)}
            /> {g.away_team}
          </label>
          <label style={{ marginLeft:12 }}>
            <input
              type="checkbox"
              checked={lockPick===g.id}
              onChange={()=>handleLock(g.id)}
            /> Lock
          </label>
        </div>
      ))}

      <button onClick={submitPicks}>Submit Picks</button>
      {status && <pre style={{ whiteSpace:'pre-wrap', marginTop:16 }}>{status}</pre>}
    </div>
  )
}
