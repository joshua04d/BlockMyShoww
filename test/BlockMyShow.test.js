const { expect }  = require("chai");
const { ethers }  = require("hardhat");

describe("BlockMyShow", function () {
  let owner, admin, buyer, buyer2;
  let ticketPricing, ticketNFT, eventManager, escrow, ticketResale;

  const TIER        = "VIP";
  const SEAT        = "A1";
  const PRICE       = ethers.parseEther("0.1");
  const FUTURE_DATE = Math.floor(Date.now() / 1000) + 86400; // tomorrow

  beforeEach(async () => {
    [owner, admin, buyer, buyer2] = await ethers.getSigners();

    // Deploy
    const TicketPricing = await ethers.getContractFactory("TicketPricing");
    ticketPricing = await TicketPricing.deploy();

    const TicketNFT = await ethers.getContractFactory("TicketNFT");
    ticketNFT = await TicketNFT.deploy();

    const EventManager = await ethers.getContractFactory("EventManager");
    eventManager = await EventManager.deploy(await ticketNFT.getAddress(), await ticketPricing.getAddress());

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(await ticketNFT.getAddress());

    const TicketResale = await ethers.getContractFactory("TicketResale");
    ticketResale = await TicketResale.deploy(await ticketNFT.getAddress());

    // Wire
    await ticketNFT.setEventManager(await eventManager.getAddress());
    await eventManager.setEscrow(await escrow.getAddress());
    await escrow.setEventManager(await eventManager.getAddress());

    // Setup
    await ticketPricing.setTierPrice(TIER, PRICE);
    await eventManager.approveAdmin(admin.address);
  });

  // ─── TicketPricing ──────────────────────────────────────────────────────────

  describe("TicketPricing", () => {
    it("sets and gets tier price", async () => {
      expect(await ticketPricing.getPrice(TIER)).to.equal(PRICE);
    });

    it("reverts on unconfigured tier", async () => {
      await expect(ticketPricing.getPrice("GENERAL")).to.be.revertedWith("Tier not configured");
    });
  });

  // ─── EventManager ───────────────────────────────────────────────────────────

  describe("EventManager", () => {
    it("approves admin correctly", async () => {
      expect(await eventManager.approvedAdmins(admin.address)).to.be.true;
    });

    it("admin can create event", async () => {
    const tx = await eventManager.connect(admin).createEvent("Concert", "Mumbai", FUTURE_DATE, 100);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return eventManager.interface.parseLog(l).name === "EventCreated"; } catch { return false; }
    });
    expect(event).to.not.be.undefined;
    expect(await eventManager.totalEvents()).to.equal(1n);
  });

  it("owner can activate event", async () => {
    await eventManager.connect(admin).createEvent("Concert", "Mumbai", FUTURE_DATE, 100);
    const tx = await eventManager.activateEvent(1);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return eventManager.interface.parseLog(l).name === "EventActivated"; } catch { return false; }
    });
    expect(event).to.not.be.undefined;
  });

    it("non-admin cannot create event", async () => {
      await expect(
        eventManager.connect(buyer).createEvent("Concert", "Mumbai", FUTURE_DATE, 100)
      ).to.be.revertedWith("Not an approved admin");
    });
  });

  // ─── Ticket Purchase ────────────────────────────────────────────────────────

  describe("Ticket Purchase", () => {
    beforeEach(async () => {
      await eventManager.connect(admin).createEvent("Concert", "Mumbai", FUTURE_DATE, 100);
      await eventManager.setTierSeats(1, TIER, 50);
      await eventManager.activateEvent(1);
    });

    it("buyer can purchase a ticket", async () => {
      await eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: PRICE });
      expect(await ticketNFT.ownerOf(1)).to.equal(buyer.address);
    });

    it("escrow receives ETH", async () => {
      await eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: PRICE });
      expect(await escrow.getEventBalance(1)).to.equal(PRICE);
    });

    it("cannot buy same seat twice", async () => {
      await eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: PRICE });
      await expect(
        eventManager.connect(buyer2).buyTicket(1, SEAT, TIER, { value: PRICE })
      ).to.be.revertedWith("Seat already taken");
    });

    it("reverts on wrong ETH amount", async () => {
      await expect(
        eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Incorrect ETH amount");
    });
  });

  // ─── Escrow ─────────────────────────────────────────────────────────────────

  describe("Escrow", () => {
    beforeEach(async () => {
      await eventManager.connect(admin).createEvent("Concert", "Mumbai", FUTURE_DATE, 100);
      await eventManager.setTierSeats(1, TIER, 50);
      await eventManager.activateEvent(1);
      await eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: PRICE });
    });

    it("owner can release funds after event complete", async () => {
      await eventManager.completeEvent(1);
      const before = await ethers.provider.getBalance(admin.address);
      await escrow.release(1);
      const after = await ethers.provider.getBalance(admin.address);
      expect(after).to.be.gt(before);
    });

    it("buyer can claim refund on cancelled event", async () => {
      await eventManager.cancelEvent(1);
      const before = await ethers.provider.getBalance(buyer.address);
      await escrow.connect(buyer).claimRefund(1);
      const after = await ethers.provider.getBalance(buyer.address);
      expect(after).to.be.gt(before);
    });

    it("cannot release twice", async () => {
      await eventManager.completeEvent(1);
      await escrow.release(1);
      await expect(escrow.release(1)).to.be.revertedWith("Already released");
    });
  });

  // ─── TicketResale ───────────────────────────────────────────────────────────

  describe("TicketResale", () => {
    beforeEach(async () => {
      await eventManager.connect(admin).createEvent("Concert", "Mumbai", FUTURE_DATE, 100);
      await eventManager.setTierSeats(1, TIER, 50);
      await eventManager.activateEvent(1);
      await eventManager.connect(buyer).buyTicket(1, SEAT, TIER, { value: PRICE });
      // buyer approves resale contract
      await ticketNFT.connect(buyer).approve(await ticketResale.getAddress(), 1);
    });

    it("seller can list ticket within 10% cap", async () => {
      const listPrice = ethers.parseEther("0.11"); // 10% above 0.1
      await ticketResale.connect(buyer).listTicket(1, listPrice);
      expect(await ticketResale.isListed(1)).to.be.true;
    });

    it("reverts listing above 10% cap", async () => {
      const overPrice = ethers.parseEther("0.12");
      await expect(
        ticketResale.connect(buyer).listTicket(1, overPrice)
      ).to.be.revertedWith("Price exceeds 10% resale cap");
    });

    it("buyer2 can purchase listed ticket", async () => {
      const listPrice = ethers.parseEther("0.11");
      await ticketResale.connect(buyer).listTicket(1, listPrice);
      await ticketResale.connect(buyer2).buyTicket(1, { value: listPrice });
      expect(await ticketNFT.ownerOf(1)).to.equal(buyer2.address);
    });

    it("seller can cancel listing", async () => {
      await ticketResale.connect(buyer).listTicket(1, PRICE);
      await ticketResale.connect(buyer).cancelListing(1);
      expect(await ticketResale.isListed(1)).to.be.false;
    });
  });
});