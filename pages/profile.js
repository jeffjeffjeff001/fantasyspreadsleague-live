// pages/profile.js
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function UserProfile() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [email, setEmail]               = useState('')
  const [picks, setPicks]               = useState([])
  const [warning, setWarning]           = useState('')
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(false)

  const getDow = (iso) => new Date(iso).getUTCDay()

  const loadPicks = async () => {
    setLoading(true)
    setError(null)
    setWarning('')
    setPicks([])

    try {
      const { data, error } = await supabase
        .from('picks')
        .select(`
          id,
          selected_team,
          is_lock,
          games (
            id,
            home_team,
            away_team,
            spread,
            kickoff_time,
            week
          )
        `)
        .eq('user_email', email)
        .eq('games.week', selectedWeek)
        .order('kickoff_time', { ascending: true, foreignTable: 'games' })

      if (error) throw error

      // Bucket into Thu(1), Mon(1), Best(3)
      const thu = [], mon = [], best = []
      data.forEach((pick) => {
        const dow = getDow(pick.games.kickoff_time)
        if (dow === 4 && thu.length < 1) thu.push(pick)
        else if (dow === 1 && mon.length < 1) mon.push(pick)
        else if (dow !== 4 && dow !== 1 && best.length < 3) best.push(pick)
      })

      // Only one lock allowed
      let lockFound = false
      const filtered = [...thu, ...mon, ...best].map((pick) => {
        if (pick.is_lock && !lockFound) {
          lockFound = true
          return pick
        }
        return { ...pick, is_lock: false }
      })

      if (filtered.length < data.length) {
        setWarning(
          '⚠️ Showing max of 1 Thursday + 1 Monday + 3 Best-Choice picks.'
        )
      }
      setPicks(filtered)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Your Profile & Picks</h2>
      <p><Link href="/"><a>← Return Home</a></Link></p>

      {/* Week selector */}
      <div style={{ marginBottom: 16 }}>
        <label>
          Week:&nbsp;
          <input
            type="number" min="1"
            value={selectedWeek}
            onChange={(e)=>
              setSelectedWeek(parseInt(e.target.value,10)||1)
            }
            style={{ width: 60 }}
          />
        </label>
      </div>

      {/* Email + load */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          style={{ marginRight:8, width:260 }}
        />
        <button onClick={loadPicks} disabled={!email||loading}>
          {loading ? 'Loading…' : `Load Week ${selectedWeek} Picks`}
        </button>
      </div>

      {error && <p style={{ color:'red',marginTop:12 }}>Error: {error}</p>}
      {warning && <p style={{ color:'#a67c00',marginTop:12 }}>{warning}</p>}

      {picks.length > 0 ? (
        <table style={{ marginTop:20,borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{border:'1px solid #ccc',padding:8}}>Game</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Spread</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Your Pick</th>
              <th style={{border:'1px solid #ccc',padding:8}}>Lock?</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick)=> {
              const g = pick.games
              return (
                <tr key={pick.id}>
                  <td style={{border:'1px solid #ccc',padding:8}}>
                    {g.away_team} @ {g.home_team}
                    <br/>
                    <small>
                      {new Date(g.kickoff_time).toLocaleString(undefined,{
                        weekday:'short',hour:'2-digit',minute:'2-digit'
                      })}
                    </small>
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8}}>{g.spread}</td>
                  <td style={{border:'1px solid #ccc',padding:8}}>
                    {pick.selected_team}
                  </td>
                  <td style={{border:'1px solid #ccc',padding:8,textAlign:'center'}}>
                    {pick.is_lock ? '✅' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        !loading && <p>No picks found for Week {selectedWeek}.</p>
      )}
    </div>
  )
}
