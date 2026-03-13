import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { ADDRESSES, TICKET_NFT_ABI } from '../contracts/addresses'
import { useWallet } from '../hooks/useWallet'
import TicketQR from '../components/TicketQR'

export default function MyTickets() {
  const { signer, address, isConnected, isOnSepolia, connect, switchToSepolia } = useWallet()

  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [expandedQR, setExpandedQR] = useState(null)

  useEffect(() => {
    if (isConnected && isOnSepolia && signer) fetchTickets()
  }, [isConnected, isOnSepolia, signer])

  async function fetchTickets() {
    if (!ADDRESSES.TicketNFT) {
      setError('Contracts not deployed yet. Fill in addresses.js after deploying to Sepolia.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const provider = signer.provider
      const contract = new ethers.Contract(ADDRESSES.TicketNFT, TICKET_NFT_ABI, provider)

      // TicketNFT doesn't implement Enumerable — we scan Transfer events instead
      const filter   = contract.filters.Transfer(null, address)
      const logs     = await contract.queryFilter(filter, -100000)
      const tokenIds = [...new Set(logs.map(l => l.args.tokenId))]

      const owned = []
      for (const tokenId of tokenIds) {
        try {
          const owner = await contract.ownerOf(tokenId)
          if (owner.toLowerCase() === address.toLowerCase()) {
            const data = await contract.getTicket(tokenId)
            owned.push({ tokenId, ...data })
          }
        } catch { /* token burned or transferred away */ }
      }
      setTickets(owned)
    } catch (err) {
      setError(err.message || 'Failed to load tickets.')
    } finally {
      setLoading(false)
    }
  }

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!isConnected) return (
    <div className="empty-state">
      <h2>Wallet not connected</h2>
      <p style={{ marginBottom: '1.5rem' }}>Connect your wallet to view your tickets.</p>
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

  return (
    <div>
      <div className="page-header">
        <h1>🎟 My Tickets</h1>
        <p>Your on-chain NFT tickets. Show the QR at the gate.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      )}

      {!loading && tickets.length === 0 && !error && (
        <div className="empty-state">
          <h2>No tickets yet</h2>
          <p>Head to the Events page and grab one!</p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="card-grid">
          {tickets.map((ticket, i) => {
            const tokenId      = ticket.tokenId
            const isExpanded   = expandedQR === tokenId.toString()
            const priceEth     = ethers.formatEther(ticket.originalPrice)
            const statusLabel  = ticket.used ? '✅ Used' : '🟢 Valid'
            const statusColor  = ticket.used ? 'var(--text)' : 'var(--success)'

            return (
              <div className="card" key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>Token #{tokenId.toString()}</h3>
                  <span style={{ fontSize: '0.85rem', color: statusColor, fontWeight: 600 }}>
                    {statusLabel}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  🎪 Event #{ticket.eventId.toString()}
                </p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  💺 Seat: <strong style={{ color: 'var(--text-h)' }}>{ticket.seat}</strong>
                </p>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                  🏷 Tier: <strong style={{ color: 'var(--text-h)' }}>{ticket.tier}</strong>
                </p>
                <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  💰 Paid: {priceEth} ETH
                </p>

                {isExpanded && (
                  <TicketQR
                    tokenId={tokenId}
                    address={address}
                    eventId={ticket.eventId}
                    seat={ticket.seat}
                    tier={ticket.tier}
                  />
                )}

                <button
                  className={`btn ${isExpanded ? 'btn-outline' : 'btn-primary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setExpandedQR(isExpanded ? null : tokenId.toString())}
                  disabled={ticket.used}
                >
                  {ticket.used ? 'Ticket Used' : isExpanded ? 'Hide QR' : 'Show QR Code'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}