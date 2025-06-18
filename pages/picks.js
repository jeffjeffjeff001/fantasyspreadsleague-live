// pages/picks.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function PickSubmission() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames]               = useState([])      // always an array
  const [email, setEmail]               = useState('')
  const [picks, setPicks]               = useState({})      // { gameId: team }
  const [lockPick, setLockPick]         = useState(null)
  const [status, setStatus]             = useState(null)

  // get current ISO timestamp
  const nowISO = () => new Date().toISOString()

  // load only future games for the selected week
  useEffect(() => {
    setStatus(null)
    setPicks({})
    setLockPick(null)

    supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .gt('kickoff_time', nowISO())
      .order('kickoff_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setStatus(`🚫 ${error.message}`)
          setGames([])
        } else {
          setGames(data)
        }
      })
  }, [selectedWeek])

  // helpers
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  const countCats = (map) => {
    let th = 0, mo = 0, be = 0
    Object.keys(map).forEach((id) => {
      const g = games.find(x => x.id === id)
      if (!g) return
      if (isThursday(g.kickoff_time)) th++
      else if (isMonday(g.kickoff_time)) mo++
      else be++
    })
    return { th, mo, be }
  }

  const handlePick = (gid, team) => {
    setStatus(null)
    const copy = { ...picks }

    if (copy[gid] === team) {
      delete copy[gid]
      return setPicks(copy)
    }

    if (Object.keys(copy).length >= 5) {
      return setStatus('🚫 You can only pick up to 5 games total.')
    }

    const tmp = { ...copy, [gid]: team }
    const { th, mo, be } = countCats(tmp)
    if (th > 1) return setStatus('🚫 Only 1 Thursday pick allowed.')
    if (mo > 1) return setStatus('🚫 Only 1 Monday pick allowed.')
    if (be > 3) return setStatus('🚫 Only 3 “Best Choice” picks allowed.')

    copy[gid] = team
    setPicks(copy)
  }

  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

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
    const submittedIds = entries.map(([gid]) => gid)
    setGames(prev => prev.filter(g => !submittedIds.includes(g.id)))
    setPicks({})
    setLockPick(null)
    setStatus('✅ Picks submitted—those games are now hidden.')
  }

  const submitPicks = () => {
    setStatus(null)
    if (!email) return setStatus('🚫 Please enter your email.')
    if (!Object.keys(picks).length) return setStatus('🚫 Please select at least one game.')
    savePicks()
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks</h2>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      {status && <pre style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{status}</pre>}

      <div style={{ marginBottom: 16 }}>
        <label>
          Week:&nbsp;
          <input
            type="number"
            min="1"
            value={selectedWeek}
            onChange={e => setSelectedWeek(parseInt(e.target.value, 10) || 1)}
            style={{ width: 60 }}
          />
        </label>
      </div>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />

      {games.length === 0 ? (
        <p>No upcoming games for Week {selectedWeek}.</p>
      ) : (
        games.map(g => (
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
        ))
      )}

      <button onClick={submitPicks}>Submit Picks</button>
    </div>
  )
}
