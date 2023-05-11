#! /usr/local/bin/node

const ethers = require("ethers")
// const optimismSDK = require("@eth-optimism/sdk")
const optimismSDK = require("@tokamak-network/tokamak-layer2-sdk")
const IERC20Artifact = require("./abis/IERC20.json");
require('dotenv').config()


const MessageDirection = {
  L1_TO_L2: 0,
  L2_TO_L1: 1,
}

const l1Url = `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`
const l2Url = `https://goerli.optimism.tokamak.network`
const receiver1 = "0x5b6e72248b19F2c5b88A4511A6994AD101d0c287"; // 계정1


// Contract addresses for OPTb tokens, taken
// from https://github.com/ethereum-optimism/ethereum-optimism.github.io/blob/master/data/OUTb/data.json

const bridge = {
  l1Bridge: "0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD",
  l2Bridge: "0x4200000000000000000000000000000000000010"
}

// TOS
// const erc20Addrs = {
//   l1Addr: "0x67F3bE272b1913602B191B3A68F7C238A2D81Bb9",
//   l2Addr: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"
// }

// TON
const erc20Addrs = {
  l1Addr: "0x68c1F9620aeC7F2913430aD6daC1bb16D8444F00",
  l2Addr: "0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2"
}

// USDC
// const erc20Addrs = {
//   l1Addr: "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
//   l2Addr: "0x713733bda7F5f9C15fd164242dF4d6292B412bAE"
// }

const greeter = {
  l1Greeter: "0x51aB33d511a74aBeFDce2d4AddB92991B73F8937",
  l2Greeter: "0xDe6b80f4700C2148Ba2aF81640a23E153C007C7F"
}

// To learn how to deploy an L2 equivalent to an L1 ERC-20 contract,
// see here:
// https://github.com/ethereum-optimism/optimism-tutorial/tree/main/standard-bridge-standard-token


// Global variable because we need them almost everywhere
let crossChainMessenger
let l1ERC20, l2ERC20    // OUTb contracts to show ERC-20 transfers
let ourAddr             // The address of the signer we use.
let l1Signer, l2Signer;

// Get signers on L1 and L2 (for the same address). Note that
// this address needs to have ETH on it, both on Optimism and
// Optimism Georli
const getSigners = async () => {
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
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

const GreeterABI = [
  {
    "inputs": [
    ],
    "name": "greet",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    constant: true,
    inputs: [
      { name: "_greeting", type: "string" } ],
    name: "setGreeting",
    outputs: [],
    type: "function",
  },
]
const setup = async() => {
  [l1Signer, l2Signer] = await getSigners()
  ourAddr = l1Signer.address

  crossChainMessenger = new optimismSDK.CrossChainMessenger({
      l1ChainId: 5,    // Goerli value, 1 for mainnet
      l2ChainId: 5050,  // Goerli value, 10 for mainnet
      l1SignerOrProvider: l1Signer,
      l2SignerOrProvider: l2Signer
  })

  // console.log('crossChainMessenger',crossChainMessenger);

  l1Bridge = new ethers.Contract(bridge.l1Bridge, BridgeABI, l1Signer)
  l2Bridge = new ethers.Contract(bridge.l2Bridge, BridgeABI, l2Signer)
  l1ERC20 = new ethers.Contract(erc20Addrs.l1Addr, IERC20Artifact.abi, l1Signer)
  l2ERC20 = new ethers.Contract(erc20Addrs.l2Addr, IERC20Artifact.abi, l2Signer)
  l1Greeter = new ethers.Contract(greeter.l1Greeter, GreeterABI, l1Signer)
  l2Greeter = new ethers.Contract(greeter.l2Greeter, GreeterABI, l2Signer)

}    // setup


const reportGreet = async () => {
  const l1greet = await l1Greeter["greet()"]()
  const l2greet = await l2Greeter.greet()

  console.log(`l1greet:${l1greet} `)
  console.log(`l2greet:${l2greet} `)

  return
}    // reportGreet


const reportBridgeBalances = async () => {
  const deposits = (await l1Bridge.deposits(erc20Addrs.l1Addr, erc20Addrs.l2Addr)).toString().slice(0,-18)
  // const deposits = (await l1Bridge.deposits(erc20Addrs.l1Addr, erc20Addrs.l2Addr)).toString()

  console.log(`deposits in Bridge : ${deposits} `)
  return

}    // reportBridgeBalances


const reportERC20Balances = async () => {
  const l1Balance = (await l1ERC20.balanceOf(ourAddr)).toString().slice(0,-18)
  const l2Balance = (await l2ERC20.balanceOf(ourAddr)).toString().slice(0,-18)
  // const l1Balance = (await l1ERC20.balanceOf(ourAddr)).toString()
  // const l2Balance = (await l2ERC20.balanceOf(ourAddr)).toString()

  console.log(`ourAddr:${ourAddr} `)
  console.log(`OUTb on L1:${l1Balance}     OUTb on L2:${l2Balance}`)

  if (l1Balance != 0) {
    return
  }

}    // reportGreet


const oneToken = BigInt(1e18)
// const tenToken = ethers.utils.parseEther("10 ")

// const depositAmount = ethers.utils.parseEther("60000")
const depositAmount = ethers.utils.parseEther("1")
const approveAmount = ethers.utils.parseEther("100000")

// for USDC
// const depositAmount = ethers.BigNumber.from("5000000000")
// const approveAmount = ethers.BigNumber.from("1000000000000")


const allowanceERC20 = async () => {
  console.log(`\n`)
  console.log("allowanceERC20 ")
  console.log(`\n`, l1Signer.address)

  const allowance = await l1ERC20.allowance(l1Signer.address, bridge.l1Bridge);
  console.log(`allowance `,allowance )

  console.log(`\n`)

}

const approveERC20 = async () => {
    const [l1Signer, l2Signer] = await getSigners()

    const tx = await l1ERC20.approve(
      l1Signer.address,
      bridge.l1Bridge
      ,{
        gasLimit: 200000
      }
    );

    console.log("tx", tx);
    await tx.wait();
}


const depositERC20 = async () => {
  console.log(`\n`)
  console.log("Deposit ERC20")
  await reportERC20Balances()
  console.log(`\n`)
  const start = new Date()

  // Need the l2 address to know which bridge is responsible
  const allowanceResponse = await crossChainMessenger.approveERC20(
    erc20Addrs.l1Addr, erc20Addrs.l2Addr, approveAmount)
  await allowanceResponse.wait()
  console.log(`Allowance given by tx ${allowanceResponse.hash}`)
  console.log(`\tMore info: https://goerli.etherscan.io/tx/${allowanceResponse.hash}`)
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  console.log(`\n`)
  const response = await crossChainMessenger.depositERC20(
    erc20Addrs.l1Addr, erc20Addrs.l2Addr, depositAmount)
  console.log(`Deposit transaction hash (on L1): ${response.hash}`)
  console.log(`\tMore info: https://goerli.etherscan.io/tx/${response.hash}`)
  await response.wait()
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, optimismSDK.MessageStatus.RELAYED)

  console.log(`depositERC20 took ${(new Date()-start)/1000} seconds\n\n`)
  await reportERC20Balances()
  console.log(`\n`)

}     // depositERC20()


const withdrawERC20 = async (to) => {
  console.log(`\n`)
  console.log("Withdraw ERC20")
  const start = new Date()
  await reportERC20Balances()
  console.log(`\n`)

  const response = await crossChainMessenger.withdrawERC20(
    erc20Addrs.l1Addr, erc20Addrs.l2Addr, depositAmount,
    )
  console.log(`Transaction hash (on L2): ${response.hash}`)
  console.log(`\tFor more information: https://goerli.explorer.tokamak.network/tx/${response.hash}`)
  await response.wait()

  console.log(`\n`)
  console.log("Checking the current Status")
  const eventSendMessage = await crossChainMessenger.toCrossChainMessage(response.hash)
  console.log(`eventSendMessage : `, eventSendMessage)
  const currentStatus = await crossChainMessenger.getMessageStatus(eventSendMessage)
  console.log(`currentStatus : `, currentStatus)

  console.log(`\n`)
  console.log("Waiting for status to change to IN_CHALLENGE_PERIOD")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, optimismSDK.MessageStatus.IN_CHALLENGE_PERIOD)
  console.log("In the challenge period, waiting for status READY_FOR_RELAY")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response.hash, optimismSDK.MessageStatus.READY_FOR_RELAY)
  console.log("Ready for relay, finalizing message now")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.finalizeMessage(response)
  console.log("Waiting for status to change to RELAYED")
  console.log(`Time so far ${(new Date()-start)/1000} seconds`)
  await crossChainMessenger.waitForMessageStatus(response, optimismSDK.MessageStatus.RELAYED)

  console.log(`withdrawERC20 took ${(new Date()-start)/1000} seconds\n\n\n`)

  await reportERC20Balances()
}     // withdrawERC20()



const main = async () => {
    await setup()

    await reportBridgeBalances();
    await withdrawERC20()
    await reportBridgeBalances();

}  // main

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

