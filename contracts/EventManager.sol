// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEscrow {
    function deposit(uint256 eventId, address organizer) external payable;
}

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TicketNFT.sol";
import "./TicketPricing.sol";

/// @title EventManager
/// @notice Core orchestrator. Handles event lifecycle, admin approval,
///         ticket purchasing, and event completion triggering.
contract EventManager is Ownable, ReentrancyGuard {

    TicketNFT     public ticketNFT;
    TicketPricing public ticketPricing;
    address       public escrow; // set after Escrow.sol is deployed

    // ─── Structs ───────────────────────────────────────────────────────────────

    enum EventStatus { Pending, Active, Completed, Cancelled }

    struct Event {
        uint256     id;
        string      name;
        string      venue;
        uint256     date;        // unix timestamp
        uint256     totalSeats;
        uint256     seatsSold;
        EventStatus status;
        address     organizer;   // admin who created the event
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    uint256 private _eventCounter;

    mapping(uint256 => Event)            public events;
    mapping(address => bool)             public approvedAdmins;
    // eventId => seat => taken
    mapping(uint256 => mapping(string => bool)) public seatTaken;
    // eventId => tier => seats available
    mapping(uint256 => mapping(string => uint256)) public tierSeats;

    // ─── Events ────────────────────────────────────────────────────────────────

    event AdminApproved(address indexed admin);
    event AdminRevoked(address indexed admin);
    event EventCreated(uint256 indexed eventId, string name, address organizer);
    event EventActivated(uint256 indexed eventId);
    event EventCompleted(uint256 indexed eventId);
    event EventCancelled(uint256 indexed eventId);
    event TicketPurchased(uint256 indexed eventId, uint256 tokenId, address buyer, string seat, string tier);

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(approvedAdmins[msg.sender] || msg.sender == owner(), "Not an approved admin");
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == escrow, "Caller is not Escrow");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(eventId > 0 && eventId <= _eventCounter, "Event does not exist");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _ticketNFT, address _ticketPricing) Ownable() {
        require(_ticketNFT != address(0), "Zero address: NFT");
        require(_ticketPricing != address(0), "Zero address: Pricing");
        ticketNFT     = TicketNFT(_ticketNFT);
        ticketPricing = TicketPricing(_ticketPricing);
    }

    // ─── Admin Management ──────────────────────────────────────────────────────

    function approveAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Zero address");
        approvedAdmins[admin] = true;
        emit AdminApproved(admin);
    }

    function revokeAdmin(address admin) external onlyOwner {
        approvedAdmins[admin] = false;
        emit AdminRevoked(admin);
    }

    // ─── Escrow Linking ────────────────────────────────────────────────────────

    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "Zero address");
        escrow = _escrow;
    }

    // ─── Event Lifecycle ───────────────────────────────────────────────────────

    /// @notice Admin creates an event — starts as Pending, owner must activate
    function createEvent(
        string calldata name,
        string calldata venue,
        uint256 date,
        uint256 totalSeats
    ) external onlyAdmin returns (uint256) {
        require(date > block.timestamp, "Event date must be in future");
        require(totalSeats > 0, "Must have at least 1 seat");

        _eventCounter++;
        uint256 eventId = _eventCounter;

        events[eventId] = Event({
            id:         eventId,
            name:       name,
            venue:      venue,
            date:       date,
            totalSeats: totalSeats,
            seatsSold:  0,
            status:     EventStatus.Pending,
            organizer:  msg.sender
        });

        emit EventCreated(eventId, name, msg.sender);
        return eventId;
    }

    /// @notice Configure seat count per tier for an event
    function setTierSeats(
        uint256 eventId,
        string calldata tier,
        uint256 seats
    ) external onlyAdmin eventExists(eventId) {
        require(events[eventId].status == EventStatus.Pending, "Event already active");
        tierSeats[eventId][tier] = seats;
    }

    /// @notice Owner activates event — opens ticket sales
    function activateEvent(uint256 eventId) external onlyOwner eventExists(eventId) {
        require(events[eventId].status == EventStatus.Pending, "Not pending");
        events[eventId].status = EventStatus.Active;
        emit EventActivated(eventId);
    }

    /// @notice Owner marks event complete — triggers escrow release
    function completeEvent(uint256 eventId) external onlyOwner eventExists(eventId) {
        require(events[eventId].status == EventStatus.Active, "Not active");
        events[eventId].status = EventStatus.Completed;
        emit EventCompleted(eventId);
        // Escrow listens for this or owner calls Escrow.release(eventId) separately
    }

    /// @notice Owner cancels event — enables refunds in Escrow
    function cancelEvent(uint256 eventId) external onlyOwner eventExists(eventId) {
        EventStatus s = events[eventId].status;
        require(s == EventStatus.Pending || s == EventStatus.Active, "Cannot cancel");
        events[eventId].status = EventStatus.Cancelled;
        emit EventCancelled(eventId);
    }

    // ─── Ticket Purchase ───────────────────────────────────────────────────────

    /// @notice Buy a ticket — ETH forwarded to Escrow
    function buyTicket(
        uint256 eventId,
        string calldata seat,
        string calldata tier
    ) external payable nonReentrant eventExists(eventId) {
        Event storage ev = events[eventId];
        require(ev.status == EventStatus.Active, "Event not active");
        require(ev.seatsSold < ev.totalSeats, "Sold out");
        require(!seatTaken[eventId][seat], "Seat already taken");
        require(tierSeats[eventId][tier] > 0, "No seats left in tier");
        require(escrow != address(0), "Escrow not configured");

        uint256 price = ticketPricing.getPrice(tier);
        require(msg.value == price, "Incorrect ETH amount");

        // Mark seat
        seatTaken[eventId][seat] = true;
        tierSeats[eventId][tier]--;
        ev.seatsSold++;

        // Mint NFT
        uint256 tokenId = ticketNFT.mint(msg.sender, eventId, seat, tier, price);

        // Forward ETH to Escrow with eventId + organizer
        IEscrow(escrow).deposit{value: msg.value}(eventId, events[eventId].organizer);

        emit TicketPurchased(eventId, tokenId, msg.sender, seat, tier);
    }

    // ─── QR Verification ──────────────────────────────────────────────────────

    /// @notice Mark ticket as used at gate — only admin
    function useTicket(uint256 tokenId) external onlyAdmin {
        ticketNFT.markUsed(tokenId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getEvent(uint256 eventId) external view returns (Event memory) {
        return events[eventId];
    }

    function totalEvents() external view returns (uint256) {
        return _eventCounter;
    }
}