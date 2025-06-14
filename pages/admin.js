// pages/admin.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

export default function AdminUpload() {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [gamesList, setGamesList] = useState([])
  const [newGames, setNewGames] = useState([{ home:'', away:'', spread:'', time:'' }])
  const [userEmail, setUserEmail] = useState('')
  const [userPicks, setUserPicks] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  // load games when week changes
  useEffect(() => {
    setLoading(true)
    supabase
      .from('games')
      .select('*')
      .eq('week', selectedWeek)
      .order('kickoff_time', { ascending: true })
      .then(({ data, error }) => {
        if (error) setStatus(`🚫 ${error.message}`)
        else setGamesList(data || [])
        setLoading(false)
      })
  }, [selectedWeek])

  // delete game + its picks
  const deleteGame = async (id) => {
    if (!confirm('Delete this game and its picks?')) return
    setLoading(true)
    try {
      await supabase.from('picks').delete().eq('game_id', id)
      await supabase.from('games').delete().eq('id', id)
      setGamesList((g) => g.filter((x) => x.id !== id))
      setStatus('✅ Game & picks deleted.')
    } catch (e) {
      setStatus(`🚫 ${e.message}`)
    }
    setLoading(false)
  }

  // clear all games & picks for week
  const clearWeek = async () => {
    if (!confirm('Clear ALL games & picks for this week?')) return
    setLoading(true)
    try {
      const ids = gamesList.map((g) => g.id)
      if (ids.length) {
        await supabase.from('picks').delete().in('game_id', ids)
        await supabase.from('games').delete().in('id', ids)
        setGamesList([])
      }
      setStatus('✅ Cleared week.')
    } catch (e) {
      setStatus(`🚫 ${e.message}`)
    }
    setLoading(false)
  }

  // add new game rows
  const addRow = () => setNewGames([...newGames, { home:'', away:'', spread:'', time:'' }])
  const changeNew = (i, f, v) => {
    const c = [...newGames]; c[i][f] = v; setNewGames(c)
  }

  // submit new games
  const submitNew = async () => {
    setLoading(true)
    try {
      const ins = newGames.map((g) => ({
        home_team:g.home, away_team:g.away,
        spread:parseFloat(g.spread)||0, kickoff_time:g.time,
        week:selectedWeek
      }))
      await supabase.from('games').insert(ins)
      setNewGames([{ home:'', away:'', spread:'', time:'' }])
      // refresh
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('week', selectedWeek)
        .order('kickoff_time', { ascending: true })
      setGamesList(data||[])
      setStatus('✅ Games added.')
    } catch (e) {
      setStatus(`🚫 ${e.message}`)
    }
    setLoading(false)
  }

  // load a specific user’s picks
  const loadUserPicks = () => {
    setLoading(true)
    supabase
      .from('picks')
      .select('id,user_email,selected_team,is_lock,games(id,home_team,away_team,kickoff_time)')
      .eq('user_email', userEmail)
      .eq('games.week', selectedWeek)
      .order('kickoff_time', { foreignTable:'games', ascending:true })
      .then(({ data, error }) => {
        if (error) setStatus(`🚫 ${error.message}`)
        else setUserPicks(data||[])
        setLoading(false)
      })
  }

  // delete a user pick
  const deleteUserPick = async (id) => {
    if (!confirm('Delete this pick?')) return
    setLoading(true)
    try {
      await supabase.from('picks').delete().eq('id', id)
      setUserPicks((p) => p.filter((x) => x.id !== id))
      setStatus('✅ Pick deleted.')
    } catch (e) {
      setStatus(`🚫 ${e.message}`)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding:20 }}>
      <h2>Admin: Week {selectedWeek}</h2>
      <p><Link href="/"><a>← Home</a></Link></p>

      <label>
        Week:&nbsp;
        <input
          type="number"
          min="1"
          value={selectedWeek}
          onChange={(e)=>setSelectedWeek(+e.target.value||1)}
          style={{width:60}}
        />
      </label>
      <button onClick={()=>setSelectedWeek(selectedWeek)} disabled={loading}>Load</button>

      {/* Games */}
      <h3>Games</h3>
      {gamesList.map((g)=>(
        <div key={g.id} style={{marginBottom:4}}>
          {g.away_team} @ {g.home_team} –{' '}
          {new Date(g.kickoff_time).toLocaleString()}
          <button onClick={()=>deleteGame(g.id)} disabled={loading} style={{marginLeft:8}}>X</button>
        </div>
      ))}
      {gamesList.length>0 && (
        <button onClick={clearWeek} disabled={loading}>Clear Week</button>
      )}

      {/* Add */}
      <h3>Add Games</h3>
      {newGames.map((g,i)=>(
        <div key={i} style={{marginBottom:4}}>
          <input placeholder="Home" value={g.home} onChange={e=>changeNew(i,'home',e.target.value)} />
          <input placeholder="Away" value={g.away} onChange={e=>changeNew(i,'away',e.target.value)} style={{marginLeft:4}}/>
          <input placeholder="Spread" value={g.spread} onChange={e=>changeNew(i,'spread',e.target.value)} style={{width:60,marginLeft:4}}/>
          <input type="datetime-local" value={g.time} onChange={e=>changeNew(i,'time',e.target.value)} style={{marginLeft:4}}/>
        </div>
      ))}
      <button onClick={addRow} disabled={loading}>+ Row</button>
      <button onClick={submitNew} disabled={loading} style={{marginLeft:4}}>Submit Games</button>

      {/* Manage User Picks */}
      <h3>Manage User Picks</h3>
      <input
        placeholder="User email"
        value={userEmail}
        onChange={(e)=>setUserEmail(e.target.value)}
        style={{marginRight:4}}
      />
      <button onClick={loadUserPicks} disabled={loading}>Load Picks</button>
      {userPicks.map((p)=>(
        <div key={p.id} style={{marginBottom:4}}>
          {p.user_email}: {p.games.away_team}@{p.games.home_team} → {p.selected_team}
          {p.is_lock && ' 🔒'}
          <button onClick={()=>deleteUserPick(p.id)} disabled={loading} style={{marginLeft:8}}>X</button>
        </div>
      ))}

      {status && <p style={{marginTop:20}}>{status}</p>}
    </div>
  )
}
