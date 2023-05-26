#! /usr/local/bin/node

// Estimate the costs of an Optimistic (L2) transaction

const ethers = require("ethers")
const optimismSDK = require("@tokamak-network/tokamak-layer2-sdk")

require('dotenv').config()

const L1StandardBridgeAbi = require("./abis/L1StandardBridge.json");
const L2StandardBridgeAbi = require("./abis/L1StandardBridge.json");
const IERC20Artifact = require("./abis/IERC20.json");


const l1Url = `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`
const l2Url = `https://goerli.optimism.tokamak.network`

const bridge = {
    l1Bridge: "0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD",
    l2Bridge: "0x4200000000000000000000000000000000000010"
  }

// TON
const erc20Addrs = {
    l1Addr: "0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00",
    l2Addr: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2"
  }

let ourAddr             // The address of the signer we use.
let l1Signer, l2Signer;
let l1Bridge, l2Bridge;

const depositAmount = ethers.utils.parseEther("1")
const approveAmount = ethers.utils.parseEther("10")

const getSigners = async () => {
    // const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    // const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1RpcProvider =  optimismSDK.asL2Provider(new ethers.providers.JsonRpcProvider(l1Url))
    const l2RpcProvider = optimismSDK.asL2Provider(new ethers.providers.JsonRpcProvider(l2Url))

    const privateKey = process.env.PRIVATE_KEY
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

     return [l1Wallet, l2Wallet]
}   // getSigners


// Get estimates from the SDK
const getEstimates = async (provider, tx) => {
  return {
    totalCost: await provider.estimateTotalGasCost(tx),
    l1Cost: await provider.estimateL1GasCost(tx),
    l2Cost: await provider.estimateL2GasCost(tx),
    l1Gas: await provider.estimateL1Gas(tx)
  }
}    // getEstimates


const setup = async() => {
    [l1Signer, l2Signer] = await getSigners()
    ourAddr = l1Signer.address

    l1Bridge = new ethers.Contract(bridge.l1Bridge, L1StandardBridgeAbi, l1Signer)
    l2Bridge = new ethers.Contract(bridge.l2Bridge, L2StandardBridgeAbi, l2Signer)

  }    // setup


const main = async () => {
    await setup();


    ///=========== TONContract
    const TONContract_ = new ethers.ContractFactory(IERC20Artifact.abi, IERC20Artifact.bytecode, l1Signer)
    const TONContract = TONContract_.attach(erc20Addrs.l1Addr)

    let balanceBeforeTON = await TONContract.balanceOf(l1Signer.address);
    console.log("balanceBeforeTON", balanceBeforeTON.toString());

    let allowance = await TONContract.allowance(l1Signer.address, l1Bridge.address);
    console.log("allowance 1 TON ", allowance.toString());
    console.log("approveAmount ", approveAmount);

    if(allowance.lt(approveAmount)){
        const tx = await TONContract.approve(
            l1Bridge.address,
            approveAmount
        );
        console.log("tx", tx);
        await tx.wait();

        console.log("l1Signer.address ", l1Signer.address);
        console.log("l1Bridge.address ", l1Bridge.address);
    }

    //======================

    const fakeTx1 = await l1Signer.populateTransaction(
        await l1Bridge.populateTransaction.depositERC20(
            erc20Addrs.l1Addr,
            erc20Addrs.l2Addr,
            approveAmount,
            2000000,
            '0x'
        )
    )

    console.log("About to get estimates using L1 signer ")
    console.log("fakeTx1 ", fakeTx1)

    let estimated1 = await getEstimates(l2Signer.provider, fakeTx1)
    console.log('estimated', estimated1)

    console.log('estimated.totalCost', estimated1.totalCost.toString())
    console.log('estimated.l1Cost', estimated1.l1Cost.toString())
    console.log('estimated.l2Cost', estimated1.l2Cost.toString())
    console.log('estimated.l1Gas', estimated1.l1Gas.toString())


}  // main


main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })