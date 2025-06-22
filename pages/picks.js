// pages/picks.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function PickSubmission() {
  const { session, profile } = useAuth()
  const username = profile?.username
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames]               = useState([])
  const [picks, setPicks]               = useState({})
  const [lockPick, setLockPick]         = useState(null)
  const [status, setStatus]             = useState(null)

  // Load only future games for the chosen week once user is signed in
  useEffect(() => {
    if (!session) return

    const loadGames = async () => {
      setStatus(null)
      setPicks({})
      setLockPick(null)
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('week', selectedWeek)
        .gt('kickoff_time', now)
        .order('kickoff_time', { ascending: true })
      if (error) setStatus(`🚫 ${error.message}`)
      else setGames(data || [])
    }

    loadGames()
  }, [selectedWeek, session])

  // Helper functions...
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
      user_email: session.user.email,
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
    if (!session) {
      setStatus('🚫 Please sign in first.')
      return
    }
    if (!Object.keys(picks).length) {
      setStatus('🚫 Please select at least one game.')
      return
    }
    savePicks()
  }

  if (!session) {
    return (
      <div style={{ padding: 20 }}>
        <p>
          <Link href="/auth"><a>Please sign in to submit picks →</a></Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks</h2>
      <p>Logged in as <strong>{username}</strong> | <Link href="/"><a>Home</a></Link></p>

      {status && (
        <pre style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{status}</pre>
      )}

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
              /> {g.home_team}
            </label>
            <label style={{ marginLeft: 12 }}>
              <input
                type="radio"
                name={`pick-${g.id}`}
                checked={picks[g.id] === g.away_team}
                onClick={() => handlePick(g.id, g.away_team)}
              /> {g.away_team}
            </label>
            <label style={{ marginLeft: 12 }}>
              <input
                type="checkbox"
                checked={lockPick === g.id}
                onChange={() => handleLock(g.id)}
              /> Lock
            </label>
          </div>
        ))
      )}

      <button onClick={submitPicks}>Submit Picks</button>
    </div>
  )
}
