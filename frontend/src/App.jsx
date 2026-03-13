import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import BuyTicket from './pages/BuyTicket'
import MyTickets from './pages/MyTickets'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buy/:eventId" element={<BuyTicket />} />
          <Route path="/my-tickets" element={<MyTickets />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App