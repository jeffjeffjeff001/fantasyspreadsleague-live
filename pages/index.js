// pages/index.js
import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome to Fantasy Spreads League</h1>
      <p>This is the homepage. You can:</p>
      <ul>
        <li>
          <Link href="/admin">
            <a>Go to Admin (enter weekly games)</a>
          </Link>
        </li>
        <li>
          <Link href="/picks">
            <a>Submit Your Picks</a>
          </Link>
        </li>
        <li>
          <Link href="/profile">
            <a>View My Profile & Picks</a>
          </Link>
        </li>
      </ul>
    </div>
  )
}
