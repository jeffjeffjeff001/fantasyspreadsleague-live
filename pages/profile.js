// pages/profile.js  (UPDATED)
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function UserProfile() {
  const { session, profile } = useAuth()
  const email = session?.user?.email
  const username = profile?.username

  const [selectedWeek, setSelectedWeek] = useState(1)
  const [picks, setPicks]               = useState([])
  const [warning, setWarning]           = useState('')
  const [loading, setLoading]           = useState(false)

  const loadPicks = async () => {
    if (!email) return
    setLoading(true)
    const { data } = await supabase
      .from('picks')
      .select(`
        id, selected_team, is_lock,
        games(id,home_team,away_team,spread,kickoff_time,week)
      `)
      .eq('user_email', email)
      .eq('games.week', selectedWeek)
      .order('kickoff_time', { ascending: true, foreignTable: 'games' })
    // ... filter logic ...
    setPicks(data || [])
    setLoading(false)
  }

  if (!session) {
    return (
      <div style={{ padding: 20 }}>
        <p>
          <Link href="/auth"><a>Sign in to view your profile</a></Link>
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>My Profile & Picks</h2>
      <p>Logged in as <strong>{username}</strong></p>
      {/* week selector + Load button */}
      {/* table exactly as before, using `picks` */}
    </div>
  )
}
