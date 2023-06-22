#! /usr/local/bin/node

// Estimate the costs of an Optimistic (L2) transaction
const ethers = require("ethers")
const optimismSDK = require("@tokamak-network/tokamak-layer2-sdk")

require('dotenv').config()

const L1StandardBridgeAbi = require("./abis/L1StandardBridge.json");
const L2StandardBridgeAbi = require("./abis/L1StandardBridge.json");
const IERC20Artifact = require("./abis/IERC20.json");
const CanonicalTransactionChainAbi = require("./abis/CanonicalTransactionChain.json");

const l1Url = `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`
const l2Url = `https://goerli.optimism.tokamak.network`

const bridge = {
    l1Bridge: "0x7377F3D0F64d7a54Cf367193eb74a052ff8578FD",
    l2Bridge: "0x4200000000000000000000000000000000000010"
  }
const ctc= '0x1D288952363B14B6BEEFA6A5fB2990203963F399'

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



const setup = async() => {
    [l1Signer, l2Signer] = await getSigners()
    ourAddr = l1Signer.address

    l1Bridge = new ethers.Contract(bridge.l1Bridge, L1StandardBridgeAbi, l1Signer)
    l2Bridge = new ethers.Contract(bridge.l2Bridge, L2StandardBridgeAbi, l2Signer)

  }    // setup

const tx = "0x7c0c1a222ed4073ea2ba3c447e883eaf0eef8edae477ca04bac565131c44a0ab"
const main = async () => {
    await setup();
   console.log('ourAddr', ourAddr)

   const CanonicalTransactionChain = new ethers.Contract(ctc, CanonicalTransactionChainAbi.abi, l1Signer)

   const provider = new ethers.providers.JsonRpcProvider(l1Url)

   const topic = CanonicalTransactionChain.interface.getEventTopic('TransactionEnqueued');

    let receipt = await provider.getTransactionReceipt(tx);
    const log = receipt.logs.find(x => x.topics.indexOf(topic) >= 0);
    const deployedEvent = CanonicalTransactionChain.interface.parseLog(log);

    console.log('deployedEvent.args', deployedEvent.args)


}  // main


main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })