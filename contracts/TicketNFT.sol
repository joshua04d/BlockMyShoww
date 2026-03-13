// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title TicketNFT
/// @notice ERC-721 ticket. Only EventManager can mint.
///         Core metadata stored on-chain: eventId, seat, tier, originalPrice.
contract TicketNFT is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    /// @notice The EventManager contract — only address allowed to mint
    address public eventManager;

    struct TicketData {
        uint256 eventId;
        string  seat;
        string  tier;
        uint256 originalPrice; // in wei, used by TicketResale for 10% cap
        bool    used;          // marked true after QR verification at gate
    }

    // tokenId => TicketData
    mapping(uint256 => TicketData) private _tickets;

    event TicketMinted(uint256 indexed tokenId, address indexed to, uint256 eventId, string seat, string tier);
    event TicketUsed(uint256 indexed tokenId);

    modifier onlyEventManager() {
        require(msg.sender == eventManager, "Caller is not EventManager");
        _;
    }

    constructor() ERC721("BlockMyShow Ticket", "BMST") Ownable() {}

    /// @notice Set the EventManager address — called once after deployment
    function setEventManager(address _eventManager) external onlyOwner {
        require(_eventManager != address(0), "Zero address");
        eventManager = _eventManager;
    }

    /// @notice Mint a ticket NFT — only callable by EventManager
    function mint(
        address to,
        uint256 eventId,
        string calldata seat,
        string calldata tier,
        uint256 originalPrice
    ) external onlyEventManager returns (uint256) {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();

        _safeMint(to, tokenId);
        _tickets[tokenId] = TicketData({
            eventId:       eventId,
            seat:          seat,
            tier:          tier,
            originalPrice: originalPrice,
            used:          false
        });

        emit TicketMinted(tokenId, to, eventId, seat, tier);
        return tokenId;
    }

    /// @notice Mark ticket as used — only callable by EventManager
    function markUsed(uint256 tokenId) external onlyEventManager {
        require(_exists(tokenId), "Token does not exist");
        require(!_tickets[tokenId].used, "Already used");
        _tickets[tokenId].used = true;
        emit TicketUsed(tokenId);
    }

    /// @notice Read on-chain ticket metadata
    function getTicket(uint256 tokenId) external view returns (TicketData memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tickets[tokenId];
    }

    /// @notice Get original price — used by TicketResale for cap enforcement
    function getOriginalPrice(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        return _tickets[tokenId].originalPrice;
    }
}