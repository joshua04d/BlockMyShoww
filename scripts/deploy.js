const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. TicketPricing
  const TicketPricing = await ethers.getContractFactory("TicketPricing");
  const ticketPricing = await TicketPricing.deploy();
  await ticketPricing.waitForDeployment();
  console.log("TicketPricing deployed to:", await ticketPricing.getAddress());

  // 2. TicketNFT
  const TicketNFT = await ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFT.deploy();
  await ticketNFT.waitForDeployment();
  console.log("TicketNFT deployed to:", await ticketNFT.getAddress());

  // 3. EventManager
  const EventManager = await ethers.getContractFactory("EventManager");
  const eventManager = await EventManager.deploy(
    await ticketNFT.getAddress(),
    await ticketPricing.getAddress()
  );
  await eventManager.waitForDeployment();
  console.log("EventManager deployed to:", await eventManager.getAddress());

  // 4. Escrow
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(await ticketNFT.getAddress());
  await escrow.waitForDeployment();
  console.log("Escrow deployed to:", await escrow.getAddress());

  // 5. TicketResale
  const TicketResale = await ethers.getContractFactory("TicketResale");
  const ticketResale = await TicketResale.deploy(await ticketNFT.getAddress());
  await ticketResale.waitForDeployment();
  console.log("TicketResale deployed to:", await ticketResale.getAddress());

  // ── Wire contracts together ──────────────────────────────────────────────

  await ticketNFT.setEventManager(await eventManager.getAddress());
  console.log("TicketNFT: EventManager set");

  await eventManager.setEscrow(await escrow.getAddress());
  console.log("EventManager: Escrow set");

  await escrow.setEventManager(await eventManager.getAddress());
  console.log("Escrow: EventManager set");

  console.log("\n✅ All contracts deployed and wired.");
  console.log({
    TicketPricing: await ticketPricing.getAddress(),
    TicketNFT:     await ticketNFT.getAddress(),
    EventManager:  await eventManager.getAddress(),
    Escrow:        await escrow.getAddress(),
    TicketResale:  await ticketResale.getAddress(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});