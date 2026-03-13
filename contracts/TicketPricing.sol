// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TicketPricing
/// @notice Static pricing per tier. Swap-in architecture — replace this contract
///         later with a dynamic pricing implementation without changing EventManager.
contract TicketPricing is Ownable {
    // tierName => price in wei
    mapping(string => uint256) private tierPrices;

    event TierPriceSet(string tier, uint256 price);

    constructor() Ownable() {}

    /// @notice Set or update the price for a tier
    function setTierPrice(string calldata tier, uint256 priceInWei) external onlyOwner {
        require(priceInWei > 0, "Price must be > 0");
        tierPrices[tier] = priceInWei;
        emit TierPriceSet(tier, priceInWei);
    }

    /// @notice Get the price for a tier — called by EventManager on purchase
    function getPrice(string calldata tier) external view returns (uint256) {
        uint256 price = tierPrices[tier];
        require(price > 0, "Tier not configured");
        return price;
    }
}