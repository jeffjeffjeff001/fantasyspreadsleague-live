// pages/picks.js  (UPDATED)
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function PickSubmission() {
  const { session, profile } = useAuth()
  const email = session?.user?.email
  const username = profile?.username

  const [selectedWeek, setSelectedWeek] = useState(1)
  const [games, setGames]               = useState([])
  const [picks, setPicks]               = useState({})
  const [lockPick, setLockPick]         = useState(null)
  const [status, setStatus]             = useState(null)

  useEffect(() => {
    if (!email) return
    setStatus(null)
    setPicks({})
    setLockPick(null)
    supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .gt('kickoff_time', new Date().toISOString())
      .order('kickoff_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) setStatus(`🚫 ${error.message}`)
        else setGames(data)
      })
  }, [selectedWeek, email])

  // ... your existing handlePick, handleLock, savePicks, submitPicks ...

  return (
    <div style={{ padding: 20 }}>
      <h2>Submit Your Picks</h2>
      <p><Link href="/"><a>← Home</a></Link></p>

      {!session ? (
        <p>
          <Link href="/auth"><a>Sign in to submit picks</a></Link>
        </p>
      ) : (
        <>
          <p>Logged in as <strong>{username}</strong></p>
          {/* remove email input; use username/email from context */}
          {/* ... rest of your form ... */}
        </>
      )}
    </div>
  )
}
