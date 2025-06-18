// pages/picks.js
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function PickSubmission() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames]               = useState(null)
  const [email, setEmail]               = useState('')
  const [picks, setPicks]               = useState({})
  const [lockPick, setLockPick]         = useState(null)
  const [status, setStatus]             = useState(null)
  const [error, setError]               = useState(null)

  // Helper for ISO now
  const nowISO = () => new Date().toISOString()

  // Fetch future games for the week
  useEffect(() => {
    setError(null)
    setStatus(null)
    setPicks({})
    setLockPick(null)

    (async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('week', selectedWeek)
          .gt('kickoff_time', nowISO())
          .order('kickoff_time', { ascending: true })

        if (error) throw error
        setGames(data)
      } catch (err) {
        console.error('Error loading games:', err)
        setError(err.message)
        setGames([])        // so render can continue
      }
    })()
  }, [selectedWeek])

  // Clean up expired games every 30s
  useEffect(() => {
    const tid = setInterval(() => {
      setGames((prev) => (prev || []).filter((g) => new Date(g.kickoff_time) > new Date()))
    }, 30000)
    return () => clearInterval(tid)
  }, [])

  // Day‐of‐week tests
  const isThursday = (iso) => new Date(iso).getUTCDay() === 4
  const isMonday   = (iso) => new Date(iso).getUTCDay() === 1

  // Count cats
  const countCats = (map) => {
    let th = 0, mo = 0, be = 0
    Object.keys(map).forEach((id) => {
      const g = (games || []).find((x) => x.id === id)
      if (!g) return
      if (isThursday(g.kickoff_time)) th++
      else if (isMonday(g.kickoff_time)) mo++
      else be++
    })
    return { th, mo, be }
  }

  const handlePick = (gid, team) => {
    setStatus(null)
    try {
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
      if (th > 1)      return setStatus('🚫 Only 1 Thursday pick allowed.')
      if (mo > 1)      return setStatus('🚫 Only 1 Monday pick allowed.')
      if (be > 3)      return setStatus('🚫 Only 3 Best-Choice picks allowed.')
      copy[gid] = team
      setPicks(copy)
    } catch (err) {
      console.error('Error in handlePick:', err)
      setError(err.message)
    }
  }

  const handleLock = (gid) => {
    setLockPick(lockPick === gid ? null : gid)
  }

  const savePicks = async () => {
    try {
      const entries = Object.entries(picks)
      const inserts = entries.map(([gid, team]) => ({
        user_email: email,
        game_id: gid,
        selected_team: team,
        is_lock: gid === lockPick
      }))
      const { error } = await supabase.from('picks').insert(inserts)
      if (error) throw error
      const submittedIds = entries.map(([gid]) => gid)
      setGames((prev) => (prev || []).filter((g) => !submittedIds.includes(g.id)))
      setPicks({})
      setLockPick(null)
      setStatus('✅ Picks submitted—those games are now hidden.')
    } catch (err) {
      console.error('Error saving picks:', err)
      setStatus(`🚫 ${err.message}`)
    }
  }

  const submitPicks = () => {
    setStatus(null)
    if (!email)         return setStatus('🚫 Please enter your email.')
    if (!Object.keys(picks).length) return setStatus('🚫 Please select at least one game.')
    savePicks()
  }

  // If games is null, we’re still loading
  if (games === null) {
    return <p style={{ padding: 20 }}>Loading games…</p>
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks</h2>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      {/* Show any error */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Week selector */}
      <div style={{ marginBottom: 16 }}>
        <label>
          Week:&nbsp;
          <input
            type="number" min="1"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value,10)||1)}
            style={{ width: 60 }}
          />
        </label>
      </div>

      {/* Email input */}
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginBottom: 16, width: 300 }}
      />

      {/* Games list */}
      {(games || []).length === 0 ? (
        <p>No upcoming games for Week {selectedWeek}.</p>
      ) : (
        games.map((g) => (
          <div key={g.id} style={{ marginBottom: 12 }}>
            <strong>
              {g.away_team} @ {g.home_team} ({g.spread}) —{' '}
              {new Date(g.kickoff_time).toLocaleString(undefined, {
                weekday: 'short', hour:'2-digit', minute:'2-digit'
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
            <label style={{ marginLeft:12 }}>
              <input
                type="radio"
                name={`pick-${g.id}`}
                checked={picks[g.id] === g.away_team}
                onClick={() => handlePick(g.id, g.away_team)}
              />{' '}
              {g.away_team}
            </label>
            <label style={{ marginLeft:12 }}>
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

      {/* Submit */}
      <button onClick={submitPicks}>Submit Picks</button>
      {status && (
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{status}</pre>
      )}
    </div>
  )
}
