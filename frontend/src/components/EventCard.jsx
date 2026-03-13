import { Link } from 'react-router-dom'

const STATUS_MAP = {
  0: { label: 'Pending',   cls: 'badge-pending'  },
  1: { label: 'Active',    cls: 'badge-active'   },
  2: { label: 'Completed', cls: 'badge-complete' },
  3: { label: 'Cancelled', cls: 'badge-cancelled'},
}

export default function EventCard({ event }) {
  const { id, name, venue, date, totalSeats, seatsSold, status } = event
  const { label, cls } = STATUS_MAP[Number(status)] ?? STATUS_MAP[0]

  const dateStr = new Date(Number(date) * 1000).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  })

  const seatsLeft = Number(totalSeats) - Number(seatsSold)
  const soldOut   = seatsLeft === 0

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <span className={`badge ${cls}`}>{label}</span>
      </div>

      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        📍 {venue}
      </p>
      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        🗓 {dateStr}
      </p>
      <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        🎟 {soldOut ? <span style={{ color: 'var(--danger)' }}>Sold Out</span> : `${seatsLeft} / ${totalSeats} seats left`}
      </p>

      {status === 1n || Number(status) === 1 ? (
        soldOut ? (
          <button className="btn btn-outline" disabled>Sold Out</button>
        ) : (
          <Link to={`/buy/${id}`} className="btn btn-primary">
            Buy Ticket
          </Link>
        )
      ) : (
        <button className="btn btn-outline" disabled>Unavailable</button>
      )}
    </div>
  )
}