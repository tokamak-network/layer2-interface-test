#! /usr/local/bin/node

// Estimate the costs of an Optimistic (L2) transaction

const ethers = require("ethers")
const optimismSDK = require("@tokamak-network/tokamak-layer2-sdk")

require('dotenv').config()


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

const l1Url = `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`
const l2Url = `https://goerli.optimism.tokamak.network`

const greeter = {
    l1Greeter: "0x51aB33d511a74aBeFDce2d4AddB92991B73F8937",
    l2Greeter: "0xDe6b80f4700C2148Ba2aF81640a23E153C007C7F"
  }

let ourAddr             // The address of the signer we use.
let l1Signer, l2Signer;


const getSigners = async () => {
    // const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)
    // const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const l1RpcProvider =  new ethers.providers.JsonRpcProvider(l1Url)
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

    l1Greeter = new ethers.Contract(greeter.l1Greeter, GreeterABI, l1Signer)
    l2Greeter = new ethers.Contract(greeter.l2Greeter, GreeterABI, l2Signer)

  }    // setup


const main = async () => {
    await setup();

    const greeting = "Hello!"

    let real = {}

    const fakeTxReq = await l2Greeter.populateTransaction.setGreeting(greeting)
    const fakeTx = await l2Signer.populateTransaction(fakeTxReq)
    console.log("About to get estimates")
    let estimated = await getEstimates(l2Signer.provider, fakeTx)
    console.log('estimated', estimated)
    console.log('estimated.totalCost', estimated.totalCost.toString())
    console.log('estimated.l1Cost', estimated.l1Cost.toString())
    console.log('estimated.l2Cost', estimated.l2Cost.toString())
    console.log('estimated.l1Gas', estimated.l1Gas.toString())

}  // main


main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })