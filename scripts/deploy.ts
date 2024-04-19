import { ethers } from "hardhat";

async function main() {
  const tokenName = process.env.TOKEN_NAME;
  const tokenSymbol = process.env.TOKEN_SYMBOL;
  const tokenCurrency = process.env.TOKEN_CURRENCY;
  const tokenDecimals = process.env.TOKEN_DECIMALS;

  const impl =
    process.env.FIAT_TOKEN_IMPLEMENTATION_ADDRESS ||
    "0x0000000000000000000000000000000000000000";
  const proxyAdmin = process.env.PROXY_ADMIN_ADDRESS;
  const masterMinterOwner = process.env.MASTER_MINTER_OWNER_ADDRESS;
  const owner = process.env.OWNER_ADDRESS;

  // Pauser, blacklister, and lost and found addresses can default to owner address
  const pauser = process.env.PAUSER_ADDRESS || owner;
  const blacklister = process.env.BLACKLISTER_ADDRESS || owner;
  const lostAndFound = process.env.LOST_AND_FOUND_ADDRESS || owner;

  console.log("TOKEN_NAME: '%s'", tokenName);
  console.log("TOKEN_SYMBOL: '%s'", tokenSymbol);
  console.log("TOKEN_CURRENCY: '%s'", tokenCurrency);
  console.log("TOKEN_DECIMALS: '%s'", tokenDecimals);
  console.log("FIAT_TOKEN_IMPLEMENTATION_ADDRESS: '%s'", impl);
  console.log("PROXY_ADMIN_ADDRESS: '%s'", proxyAdmin);
  console.log("MASTER_MINTER_OWNER_ADDRESS: '%s'", masterMinterOwner);
  console.log("OWNER_ADDRESS: '%s'", owner);
  console.log("PAUSER_ADDRESS: '%s'", pauser);
  console.log("BLACKLISTER_ADDRESS: '%s'", blacklister);
  console.log("LOST_AND_FOUND_ADDRESS: '%s'", lostAndFound);

  // const [deployer] = await ethers.getSigners();

  // deploy implementation
  console.log("Deploy FiatTokenV2_2 implementation...");
  const signatureChecker = await ethers.deployContract("SignatureChecker");
  await signatureChecker.waitForDeployment();
  const THROWAWAY_ADDRESS = "0x0000000000000000000000000000000000000001";
  let fiatTokenV2_2 = null;
  if (impl == "0x0000000000000000000000000000000000000000") {
    fiatTokenV2_2 = await ethers.deployContract("FiatTokenV2_2", {
      libraries: {
        SignatureChecker: signatureChecker.target,
      },
    });
    await fiatTokenV2_2.waitForDeployment();
    let tx = await fiatTokenV2_2.initialize(
      "",
      "",
      "",
      0,
      THROWAWAY_ADDRESS,
      THROWAWAY_ADDRESS,
      THROWAWAY_ADDRESS,
      THROWAWAY_ADDRESS
    );
    await tx.wait();
    tx = await fiatTokenV2_2.initializeV2("");
    await tx.wait();
    tx = await fiatTokenV2_2.initializeV2_1(THROWAWAY_ADDRESS);
    await tx.wait();
    tx = await fiatTokenV2_2.initializeV2_2([], "");
    await tx.wait();
  } else {
    fiatTokenV2_2 = await ethers.getContractAt("FiatTokenV2_2", impl);
  }
  console.log(`FiatTokenV2_2 implementation address: ${fiatTokenV2_2.target}`);

  const proxy = await ethers.deployContract("FiatTokenProxy", [
    fiatTokenV2_2.target,
  ]);
  await proxy.waitForDeployment();
  console.log(`FiatTokenProxy address: ${proxy.target}`);

  const masterMinter = await ethers.deployContract("MasterMinter", [
    proxy.target,
  ]);
  await masterMinter.waitForDeployment();
  console.log(`MasterMinter address: ${masterMinter.target}`);

  let tx = await masterMinter.transferOwnership(masterMinterOwner);
  await tx.wait();

  tx = await proxy.changeAdmin(proxyAdmin);
  await tx.wait();

  const proxyAsV2_2 = await ethers.getContractAt("FiatTokenV2_2", proxy.target);
  tx = await proxyAsV2_2.initialize(
    tokenName,
    tokenSymbol,
    tokenCurrency,
    tokenDecimals,
    masterMinter.target,
    pauser,
    blacklister,
    owner
  );
  await tx.wait();

  tx = await proxyAsV2_2.initializeV2(tokenName);
  await tx.wait();
  tx = await proxyAsV2_2.initializeV2_1(lostAndFound);
  await tx.wait();
  tx = await proxyAsV2_2.initializeV2_2([], tokenSymbol);
  await tx.wait();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
