import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { ADDRESSES, EVENT_MANAGER_ABI } from '../contracts/addresses'
import { useWallet } from '../hooks/useWallet'
import EventCard from '../components/EventCard'

export default function Home() {
  const { provider, isConnected, connect } = useWallet()
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (isConnected && provider) fetchEvents()
  }, [isConnected, provider])

  async function fetchEvents() {
    if (!ADDRESSES.EventManager) {
      setError('Contracts not deployed yet. Fill in addresses.js after deploying to Sepolia.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
      const total    = await contract.totalEvents()
      const fetched  = []
      for (let i = 1; i <= Number(total); i++) {
        const ev = await contract.getEvent(i)
        fetched.push(ev)
      }
      setEvents(fetched)
    } catch (err) {
      setError(err.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>🎟 Upcoming Events</h1>
        <p>Buy tickets as NFTs — yours forever on-chain.</p>
      </div>

      {!isConnected && (
        <div className="alert alert-info">
          Connect your wallet to view and purchase tickets.
          <button className="btn btn-primary" style={{ marginLeft: '1rem' }} onClick={() => connect()}>
            Connect Wallet
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      )}

      {!loading && isConnected && events.length === 0 && !error && (
        <div className="empty-state">
          <h2>No events yet</h2>
          <p>Check back soon or deploy an event via the admin scripts.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="card-grid">
          {events.map((ev, i) => (
            <EventCard key={i} event={ev} />
          ))}
        </div>
      )}
    </div>
  )
}