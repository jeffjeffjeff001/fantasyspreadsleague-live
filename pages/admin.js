// pages/admin.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabaseClient'

export default function AdminPanel() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading]   = useState(false)

  // load all league members
  const loadProfiles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('email, username, first_name, last_name')
      .order('username', { ascending: true })
    if (error) {
      alert('Error loading members: ' + error.message)
    } else {
      setProfiles(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  // call our API to delete a profile
  const handleDelete = async (email) => {
    if (!confirm(`Really delete ${email}? This cannot be undone.`)) return
    const res = await fetch('/api/delete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    const { error } = await res.json()
    if (error) {
      alert('Delete failed: ' + error)
    } else {
      alert('User deleted.')
      loadProfiles()
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Panel</h1>
      <p><Link href="/"><a>← Home</a></Link></p>

      <h2>League Members</h2>
      {loading ? (
        <p>Loading members…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Username</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Email</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.email}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.username}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>
                  {p.first_name} {p.last_name}
                </td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{p.email}</td>
                <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                  <button
                    onClick={() => handleDelete(p.email)}
                    style={{ color: 'white', background: 'red', border: 'none', padding: '6px 12px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 8, textAlign: 'center' }}>
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
