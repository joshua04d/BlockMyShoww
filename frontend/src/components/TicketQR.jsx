import { QRCodeSVG } from 'qrcode.react'

export default function TicketQR({ tokenId, address, eventId, seat, tier }) {
  // QR payload — signed by wallet address for gate verification
  const payload = JSON.stringify({
    tokenId: tokenId.toString(),
    eventId: eventId.toString(),
    seat,
    tier,
    holder: address,
    ts: Date.now(),
  })

  return (
    <div className="qr-wrapper">
      <QRCodeSVG
        value={payload}
        size={200}
        level="H"
        includeMargin={false}
      />
      <div style={{ textAlign: 'center', color: '#111', fontSize: '0.8rem' }}>
        <p style={{ fontWeight: 600 }}>Token #{tokenId.toString()}</p>
        <p>{tier} — Seat {seat}</p>
      </div>
    </div>
  )
}