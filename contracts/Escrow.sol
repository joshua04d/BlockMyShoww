// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TicketNFT.sol";

/// @title Escrow
/// @notice Holds ETH per event on ticket purchase.
///         Releases funds to organizer on completeEvent().
///         Allows manual per-ticket refunds on cancellation.
contract Escrow is Ownable, ReentrancyGuard {

    TicketNFT public ticketNFT;
    address   public eventManager;

    // ─── Storage ───────────────────────────────────────────────────────────────

    // eventId => total ETH held
    mapping(uint256 => uint256) public eventBalance;
    // eventId => organizer address (set when funds first received)
    mapping(uint256 => address) public eventOrganizer;
    // tokenId => refund claimed
    mapping(uint256 => bool)    public refundClaimed;
    // eventId => funds released
    mapping(uint256 => bool)    public released;

    // ─── Events ────────────────────────────────────────────────────────────────

    event FundsReceived(uint256 indexed eventId, uint256 amount);
    event FundsReleased(uint256 indexed eventId, address organizer, uint256 amount);
    event RefundIssued(uint256 indexed tokenId, address buyer, uint256 amount);

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyEventManager() {
        require(msg.sender == eventManager, "Caller is not EventManager");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _ticketNFT) Ownable() {
        require(_ticketNFT != address(0), "Zero address: NFT");
        ticketNFT = TicketNFT(_ticketNFT);
    }

    function setEventManager(address _eventManager) external onlyOwner {
        require(_eventManager != address(0), "Zero address");
        eventManager = _eventManager;
    }

    // ─── Receive ETH from EventManager ─────────────────────────────────────────

    /// @notice Called automatically when EventManager forwards ETH on buyTicket()
    /// @dev EventManager sends ETH via low-level call — we track per eventId
    function deposit(uint256 eventId, address organizer) external payable onlyEventManager {
        require(msg.value > 0, "No ETH sent");
        eventBalance[eventId] += msg.value;
        if (eventOrganizer[eventId] == address(0)) {
            eventOrganizer[eventId] = organizer;
        }
        emit FundsReceived(eventId, msg.value);
    }

    // ─── Release Funds ─────────────────────────────────────────────────────────

    /// @notice Owner releases all funds for a completed event to the organizer
    function release(uint256 eventId) external onlyOwner nonReentrant {
        require(!released[eventId], "Already released");
        require(eventBalance[eventId] > 0, "No funds to release");

        address organizer = eventOrganizer[eventId];
        require(organizer != address(0), "No organizer set");

        uint256 amount = eventBalance[eventId];
        released[eventId] = true;
        eventBalance[eventId] = 0;

        (bool sent, ) = organizer.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(eventId, organizer, amount);
    }

    // ─── Refunds ───────────────────────────────────────────────────────────────

    /// @notice Ticket holder claims refund for a cancelled event
    function claimRefund(uint256 tokenId) external nonReentrant {
        require(!refundClaimed[tokenId], "Refund already claimed");

        TicketNFT.TicketData memory ticket = ticketNFT.getTicket(tokenId);
        uint256 eventId = ticket.eventId;

        require(!released[eventId], "Funds already released");
        require(ticketNFT.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(eventBalance[eventId] >= ticket.originalPrice, "Insufficient escrow balance");

        refundClaimed[tokenId] = true;
        eventBalance[eventId] -= ticket.originalPrice;

        (bool sent, ) = msg.sender.call{value: ticket.originalPrice}("");
        require(sent, "Refund transfer failed");

        emit RefundIssued(tokenId, msg.sender, ticket.originalPrice);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getEventBalance(uint256 eventId) external view returns (uint256) {
        return eventBalance[eventId];
    }

    // ─── Safety ────────────────────────────────────────────────────────────────

    receive() external payable {}
}   