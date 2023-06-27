#! /usr/local/bin/node

// ERC-20 transfers between L1 and L2 using the Optimism SDK

const ethers = require("ethers")
// const optimismSDK = require("@eth-optimism/sdk")
const optimismSDK = require("@tokamak-network/tokamak-layer2-sdk")
const IERC20Artifact = require("./abis/IERC20.json");
require('dotenv').config()

const MessageDirection = {
  L1_TO_L2: 0,
  L2_TO_L1: 1,
}

const l1Url = `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`
const l2Url = `https://rpc.titan.tokamak.network`

const bridge = {
  l1Bridge: "0x59aa194798Ba87D26Ba6bEF80B85ec465F4bbcfD",
  l2Bridge: "0x4200000000000000000000000000000000000010"
}

let l1RpcProvider;

// to. deterministic deployment proxy
const toAddress = "0x3fab184622dc19b6109349b94811493bf2a45362"
const depositAmount = ethers.BigNumber.from("10000000000000000")

// to. justin
// const toAddress = "0xB68AA9E398c054da7EBAaA446292f611CA0CD52B"
// const depositAmount = ethers.BigNumber.from("140000000000000000")

const approveAmount = ethers.utils.parseEther("1")

const decimals = -18;

// Global variable because we need them almost everywhere
let crossChainMessenger
let l1ERC20, l2ERC20    // OUTb contracts to show ERC-20 transfers
let ourAddr             // The address of the signer we use.
let l1Signer, l2Signer;

// Get signers on L1 and L2 (for the same address). Note that
// this address needs to have ETH on it, both on Optimism and
// Optimism Georli
const getSigners = async () => {
  l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const privateKey = process.env.PRIVATE_KEY
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

    return [l1Wallet, l2Wallet]
}   // getSigners

// The ABI fragment for the contract. We only need to know how to do two things:
// 1. Get an account's balance
// 2. Call the faucet to get more (only works on L1). Of course, production
//    ERC-20 tokens tend to be a bit harder to acquire.
const erc20ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // approve
  {
    constant: true,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  // faucet
  {
    inputs: [],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
]    // erc20ABI

const BridgeABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "deposits",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

const setup = async() => {
  [l1Signer, l2Signer] = await getSigners()
  ourAddr = l1Signer.address

  crossChainMessenger = new optimismSDK.CrossChainMessenger({
      l1ChainId: 1,    // Goerli value, 1 for mainnet
      l2ChainId: 55004,  // Goerli value, 10 for mainnet
      l1SignerOrProvider: l1Signer,
      l2SignerOrProvider: l2Signer
  })

  // console.log('crossChainMessenger',crossChainMessenger);

  l1Bridge = new ethers.Contract(bridge.l1Bridge, BridgeABI, l1Signer)

}    // setup

const reportBalances = async () => {
  const l1Balance = (await crossChainMessenger.l1Signer.getBalance()).toString().slice(0,-9)
  const l2Balance = (await crossChainMessenger.l2Signer.getBalance()).toString().slice(0,-9)

  console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
}

const reportBridgeBalances = async () => {
  const deposits = await l1RpcProvider.getBalance(bridge.l1Bridge)
  console.log(`ETH in Bridge : ${deposits} `)

  return

}    // reportBridgeBalances


const depositETH = async () => {

  console.log("Deposit ETH")
  await reportBalances()

  await reportBridgeBalances()

  const start = new Date()

  const response = await crossChainMessenger.depositETH(depositAmount,
    {
      recipient: toAddress
    })
  console.log(`Transaction hash (on L1): ${response.hash}`)
  await response.wait()
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  // await crossChainMessenger.waitForMessageStatus(response.hash,
  //                                                 optimismSDK.MessageStatus.RELAYED)

  // await reportBalances()
  // console.log(`depositETH took ${(new Date()-start)/1000} seconds\n\n`)
  // await reportBridgeBalances()

}     // depositETH()


const withdrawETH = async () => {

  console.log("Withdraw ETH")
  const start = new Date()
  await reportBalances()

  const response = await crossChainMessenger.withdrawETH(centieth)
  console.log(`Transaction hash (on L2): ${response.hash}`)
  console.log(`\tFor more information: https://goerli-optimism.etherscan.io/tx/${response.hash}`)
  await response.wait()

  console.log("Waiting for status to be READY_TO_PROVE")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash,
    optimismSDK.MessageStatus.READY_TO_PROVE)
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.proveMessage(response.hash)


  console.log("In the challenge period, waiting for status READY_FOR_RELAY")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash,
                                                optimismSDK.MessageStatus.READY_FOR_RELAY)
  console.log("Ready for relay, finalizing message now")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.finalizeMessage(response.hash)

  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response,
    optimismSDK.MessageStatus.RELAYED)

  await reportBalances()
  console.log(`withdrawETH took ${(new Date()-start)/1000} seconds\n\n\n`)
}     // withdrawETH()

const main = async () => {
  await setup()
  await depositETH()
  // await withdrawETH()

}  // main

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

