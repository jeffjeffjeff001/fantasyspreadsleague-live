// pages/profile.js
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY
const supabase    = createClient(supabaseUrl, supabaseKey)

export default function UserProfile() {
  const [email, setEmail]         = useState('')
  const [picks, setPicks]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  const loadPicks = async () => {
    setLoading(true)
    setError(null)
    setPicks([])

    try {
      // ── IMPORTANT CHANGE HERE ── 
      // Use `order('kickoff_time', { foreignTable: 'games' })` instead of
      // `order('games.kickoff_time', ...)`.
      const { data, error } = await supabase
        .from('picks')
        .select(`
          *,
          games (
            home_team,
            away_team,
            spread,
            kickoff_time,
            week
          )
        `)
        .eq('user_email', email)
        .eq('games.week', 1)
        .order('kickoff_time', { ascending: true, foreignTable: 'games' })

      if (error) throw error
      setPicks(data || [])
    } catch (err) {
      console.error('Error loading picks:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Your Profile & Picks (Week 1)</h2>
      <p>
        <Link href="/">
          <a style={{ color: '#0070f3', textDecoration: 'underline' }}>← Return Home</a>
        </Link>
      </p>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ marginRight: 8, width: 300 }}
      />
      <button onClick={loadPicks} disabled={!email || loading}>
        {loading ? 'Loading…' : 'Load My Picks'}
      </button>
      {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}

      {picks.length > 0 ? (
        <table style={{ marginTop: 20, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Game</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Spread</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Your Pick</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Lock?</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick) => {
              const g = pick.games
              const matchup = `${g.away_team} @ ${g.home_team}`
              return (
                <tr key={pick.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {matchup}
                    <br />
                    <small>
                      {new Date(g.kickoff_time).toLocaleString(undefined, {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </small>
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {g.spread}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>
                    {pick.selected_team}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                    {pick.is_lock ? '✅' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        !loading && <p style={{ marginTop: 20 }}>No picks found for this email.</p>
      )}
    </div>
  )
}
