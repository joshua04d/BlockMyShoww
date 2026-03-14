// ── Deployed contract addresses on Sepolia ───────────────────────────────
// Fill these in after running: npx hardhat run scripts/deploy.js --network sepolia

export const ADDRESSES = {
  TicketPricing: "0x03ffE6E9964CFd780687eDF8002B8BcB6989F3B3",
  TicketNFT:     "0x72FE433D93bC0B0BF8CcbcAcc59a5b24EEAa9CbD",
  EventManager:  "0xA96831F15AC3e4D350527c6D9924cf98c48f12D3",
  Escrow:        "0x928bDD0a6E920601b6aFa054Beb363A498F60b83",
  TicketResale:  "0x5F8A19C207468e004b1274fd073170fDc2fd44e3",
}

// ── ABIs (minimal — only functions we call from the frontend) ────────────

export const EVENT_MANAGER_ABI = [
  "function totalEvents() view returns (uint256)",
  "function getEvent(uint256 eventId) view returns (tuple(uint256 id, string name, string venue, uint256 date, uint256 totalSeats, uint256 seatsSold, uint8 status, address organizer))",
  "function buyTicket(uint256 eventId, string seat, string tier) payable",
  "function approvedAdmins(address) view returns (bool)",
  "function createEvent(string name, string venue, uint256 date, uint256 totalSeats) returns (uint256)",
  "function activateEvent(uint256 eventId)",
  "function completeEvent(uint256 eventId)",
  "function cancelEvent(uint256 eventId)",
  "function setTierSeats(uint256 eventId, string tier, uint256 seats)",
  "event TicketPurchased(uint256 indexed eventId, uint256 tokenId, address buyer, string seat, string tier)",
]

export const TICKET_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getTicket(uint256 tokenId) view returns (tuple(uint256 eventId, string seat, string tier, uint256 originalPrice, bool used))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
]

export const TICKET_PRICING_ABI = [
  "function getPrice(string tier) view returns (uint256)",
  "function setTierPrice(string tier, uint256 priceInWei)",
]

export const ESCROW_ABI = [
  "function getEventBalance(uint256 eventId) view returns (uint256)",
  "function release(uint256 eventId)",
  "function claimRefund(uint256 tokenId)",
]

export const TICKET_RESALE_ABI = [
  "function listTicket(uint256 tokenId, uint256 price) returns (uint256)",
  "function buyTicket(uint256 listingId) payable",
  "function cancelListing(uint256 listingId)",
  "function getListing(uint256 listingId) view returns (tuple(uint256 tokenId, address seller, uint256 price, uint8 status))",
  "function isListed(uint256 tokenId) view returns (bool)",
  "function totalListings() view returns (uint256)",
]