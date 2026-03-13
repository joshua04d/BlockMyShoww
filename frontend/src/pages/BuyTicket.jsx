import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { ADDRESSES, EVENT_MANAGER_ABI, TICKET_PRICING_ABI } from '../contracts/addresses'
import { useWallet } from '../hooks/useWallet'

const TIERS = ['VIP', 'GENERAL', 'BACKSTAGE']

const STATUS_MAP = {
  0: 'Pending',
  1: 'Active',
  2: 'Completed',
  3: 'Cancelled',
}

export default function BuyTicket() {
  const { eventId }            = useParams()
  const navigate               = useNavigate()
  const { signer, isConnected, isOnSepolia, connect, switchToSepolia } = useWallet()

  const [event, setEvent]       = useState(null)
  const [seat, setSeat]         = useState('')
  const [tier, setTier]         = useState('VIP')
  const [price, setPrice]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [txHash, setTxHash]     = useState(null)

  useEffect(() => {
    if (isConnected && signer) fetchEvent()
  }, [isConnected, signer, eventId])

  useEffect(() => {
    if (isConnected && signer && tier) fetchPrice()
  }, [tier, isConnected, signer])

  async function fetchEvent() {
    try {
      setFetching(true)
      setError(null)
      const provider = signer.provider
      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
      const ev       = await contract.getEvent(BigInt(eventId))
      setEvent(ev)
    } catch (err) {
      setError('Failed to load event details.')
    } finally {
      setFetching(false)
    }
  }

  async function fetchPrice() {
    try {
      const provider  = signer.provider
      const contract  = new ethers.Contract(ADDRESSES.TicketPricing, TICKET_PRICING_ABI, provider)
      const p         = await contract.getPrice(tier)
      setPrice(p)
    } catch {
      setPrice(null)
    }
  }

  async function handleBuy() {
    if (!seat.trim()) { setError('Please enter a seat number.'); return }
    if (!price)       { setError('Could not fetch price for this tier.'); return }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, signer)
      const tx       = await contract.buyTicket(BigInt(eventId), seat.trim(), tier, { value: price })
      setTxHash(tx.hash)
      await tx.wait()
      setSuccess(`🎉 Ticket purchased! Your NFT is in your wallet.`)
      setSeat('')
    } catch (err) {
      setError(err.reason || err.message || 'Transaction failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!isConnected) return (
    <div className="empty-state">
      <h2>Wallet not connected</h2>
      <p style={{ marginBottom: '1.5rem' }}>Connect your wallet to buy tickets.</p>
      <button className="btn btn-primary" onClick={() => connect()}>Connect Wallet</button>
    </div>
  )

  if (!isOnSepolia) return (
    <div className="empty-state">
      <h2>Wrong Network</h2>
      <p style={{ marginBottom: '1.5rem' }}>Please switch to Sepolia testnet.</p>
      <button className="btn btn-danger" onClick={switchToSepolia}>Switch to Sepolia</button>
    </div>
  )

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
    </div>
  )

  if (!event) return (
    <div className="empty-state">
      <h2>Event not found</h2>
      <button className="btn btn-outline" onClick={() => navigate('/')}>Back to Events</button>
    </div>
  )

  const dateStr = new Date(Number(event.date) * 1000).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const priceEth = price ? ethers.formatEther(price) : '...'
  const seatsLeft = Number(event.totalSeats) - Number(event.seatsSold)

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <button className="btn btn-outline" onClick={() => navigate('/')} style={{ marginBottom: '1.5rem' }}>
        ← Back
      </button>

      {/* Event Summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>{event.name}</h2>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>📍 {event.venue}</p>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>🗓 {dateStr}</p>
        <p style={{ fontSize: '0.9rem' }}>🎟 {seatsLeft} seats remaining</p>
      </div>

      {/* Purchase Form */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem' }}>Select Your Ticket</h3>

        <div className="form-group">
          <label>Tier</label>
          <select value={tier} onChange={e => setTier(e.target.value)}>
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Seat Number</label>
          <input
            type="text"
            placeholder="e.g. A1, B12, GA-001"
            value={seat}
            onChange={e => setSeat(e.target.value)}
          />
        </div>

        <div className="divider" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ color: 'var(--text)' }}>Price</span>
          <span style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '1.1rem' }}>
            {priceEth} ETH
          </span>
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            {success}
            {txHash && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                  View on Etherscan ↗
                </a>
              </div>
            )}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          onClick={handleBuy}
          disabled={loading || !price || Number(event.status) !== 1}
        >
          {loading ? <><span className="spinner" /> Processing...</> : `Buy for ${priceEth} ETH`}
        </button>

        {Number(event.status) !== 1 && (
          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
            This event is {STATUS_MAP[Number(event.status)] ?? 'unavailable'} — tickets cannot be purchased.
          </p>
        )}
      </div>
    </div>
  )
}