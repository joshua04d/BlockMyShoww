import { Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'

export default function Navbar() {
  const {
    isConnected,
    isOnSepolia,
    shortAddress,
    connecting,
    connect,
    disconnect,
    switchToSepolia,
  } = useWallet()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Block<span>MyShow</span>
      </Link>

      <div className="navbar-links">
        <Link to="/">Events</Link>
        <Link to="/my-tickets">My Tickets</Link>

        {!isConnected ? (
          <button
            className="btn btn-primary"
            onClick={() => connect()}
            disabled={connecting}
          >
            {connecting ? <span className="spinner" /> : '🦊 Connect Wallet'}
          </button>
        ) : !isOnSepolia ? (
          <button className="btn btn-danger" onClick={switchToSepolia}>
            ⚠️ Switch to Sepolia
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="wallet-address">{shortAddress}</span>
            <button className="btn btn-outline" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}