import { connection } from "@/lib/instances";
import { getTip, jitoClient, sendBundle } from "@/lib/jito";
import {
  type AmmV4Keys,
  type ComputeBudgetConfig,
  InstructionType,
  Owner,
  Raydium,
  TxBuilder,
  TxVersion,
  confirmTransaction,
  makeAMMSwapInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";
import assert from "assert";
import BN from "bn.js";
import bs58 from "bs58";
import Decimal from "decimal.js";
import { getTokenBalance, mnemonicToKeypair } from "./wallet";


const raydium = await Raydium.load({
  // @ts-ignore
  connection,
  cluster: "mainnet",
  disableFeatureCheck: true,
  disableLoadToken: true,
  blockhashCommitment: "confirmed",
});

async function getPoolInfo() {
  const data = await fetch("http://localhost:8333/pool-info", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Buffer.from(process.env.HELIUS_RPC!).toString(
        "base64"
      )}`,
    },
  });
  return await data.json();
}

async function getReserve() {
  const data = await fetch("http://localhost:8333/reserve", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Buffer.from(process.env.HELIUS_RPC!).toString(
        "base64"
      )}`,
    },
  });
  return await data.json();
}

async function getJitoTipAccount() {
  const data = await fetch("http://localhost:8333/jito-tip-account", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Buffer.from(process.env.HELIUS_RPC!).toString(
        "base64"
      )}`,
    },
  });
  return await data.json();
}

// const baseIn = tokenMint.toBase58() === poolInfo.mintA.address;

async function buildSwapTx(
  owner: Owner,
  poolKeys: AmmV4Keys,
  amountIn: BN,
  amountOut: BN,
  inputMint: PublicKey,
  outputMint: PublicKey,
  recentBlockhash: string,
  jito?: {
    jitoTipAccount: PublicKey;
    jitoTipAmount: number;
  },
  fixedSide: "in" | "out" = "in",
  computeBudgetConfig?: ComputeBudgetConfig
  // txVersion?: TxVersion
) {
  const _tokenAccountIn = await getAssociatedTokenAddress(
    inputMint,
    owner.publicKey
  );

  const _tokenAccountOut = await getAssociatedTokenAddress(
    outputMint,
    owner.publicKey
  );

  const txBuilder = new TxBuilder({
    connection,
    feePayer: owner.publicKey,
    cluster: "mainnet",
    owner,
    blockhashCommitment: "confirmed",
  });

  txBuilder.addInstruction({
    instructions: [
      makeAMMSwapInstruction({
        version: 4,
        poolKeys,
        userKeys: {
          tokenAccountIn: _tokenAccountIn,
          tokenAccountOut: _tokenAccountOut,
          owner: owner.publicKey,
        },
        amountIn,
        amountOut,
        fixedSide,
      }),
    ],
    instructionTypes: [InstructionType.AmmV4SwapBaseIn],
  });

  if (jito !== undefined)
    txBuilder.addInstruction({
      instructions: [
        SystemProgram.transfer({
          fromPubkey: owner.publicKey,
          toPubkey: jito.jitoTipAccount,
          lamports: jito.jitoTipAmount,
        }),
      ],
    });

  txBuilder.addCustomComputeBudget(computeBudgetConfig);

  return await txBuilder.versionBuild({
    txVersion: TxVersion.V0,
    extInfo: {
      recentBlockhash,
    },
  });
}

async function batchSendTx(
  tradeParams: {
    keypair: Keypair;
    param: { side: "sell" | "buy"; amountIn: bigint };
  }[],
  confirmed = false
) {
  const jitoTipAccount = await getJitoTipAccount();
  const {
    data: { poolKeys },
  } = await getPoolInfo();
  console.log(`start getting jito tip account: ${Date.now() / 1000}`);
  const jitoTipAmount = await getTip();
  console.log(`jito tip amount: ${jitoTipAmount}`);

  console.log(`start getting latest blockhash: ${Date.now() / 1000}`);
  const latestBlock = await connection.getLatestBlockhash("confirmed");

  console.log(`start getting pool info from rpc: ${Date.now() / 1000}`);

  const response = await getReserve();

  console.log(`end getting pool info from rpc: ${Date.now() / 1000}`);

  const status = new BN(response.status).toNumber();

  const trades = tradeParams.reduce(
    (acc, t) => {
      const mintIn = t.param.side === "buy" ? NATIVE_MINT : tokenMint;
      const mintOut = t.param.side === "buy" ? tokenMint : NATIVE_MINT;

      const amountIn = new BN(t.param.amountIn.toString());

      const { baseReserve, quoteReserve } = acc.at(-1)!;

      const out = raydium.liquidity.computeAmountOut({
        poolInfo: {
          ...poolInfo,
          baseReserve,
          quoteReserve,
          status,
          version: 4,
        },
        amountIn,
        mintIn,
        mintOut,
        slippage: 0.01, // range: 1 ~ 0.0001, means 100% ~ 0.01%
      });

      const input: "base" | "quote" = baseIn
        ? t.param.side === "buy"
          ? "quote"
          : "base"
        : t.param.side === "buy"
        ? "base"
        : "quote";
      return [
        ...acc,
        {
          baseReserve:
            input === "base"
              ? baseReserve.add(amountIn)
              : baseReserve.sub(out.amountOut),
          quoteReserve:
            input === "base"
              ? quoteReserve.sub(out.amountOut)
              : quoteReserve.add(amountIn),
          keypair: t.keypair,
          amountIn,
          amountOut: out.minAmountOut,
          mintIn,
          mintOut,
        },
      ];
    },
    [
      {
        baseReserve: new BN(response.base_reserve),
        quoteReserve: new BN(response.quote_reserve),
        keypair: new Keypair(),
        amountIn: new BN(0),
        amountOut: new BN(0),
        mintIn: NATIVE_MINT,
        mintOut: NATIVE_MINT,
      },
    ]
  );

  const txs = await Promise.all(
    trades
      .slice(1)
      .filter(({ amountIn }) => !amountIn.isZero())
      .map(({ keypair, amountIn, amountOut, mintIn, mintOut }, i, array) =>
        buildSwapTx(
          new Owner(keypair),
          poolKeys,
          amountIn,
          amountOut,
          mintIn,
          mintOut,
          latestBlock.blockhash,
          i === array.length - 1 ? { jitoTipAccount, jitoTipAmount } : undefined
        )
      )
  );

  console.log(`start sending tx: ${Date.now() / 1000}`);
  const transactions = txs.map((tx) =>
    // @ts-ignore
    bs58.encode(tx.transaction.serialize())
  );

  if (transactions.length > 0) {
    if (confirmed) {
      const result = await sendBundle(transactions);
      return result;
    } else {
      const { result } = await jitoClient.sendBundle([transactions]);
      console.log("Bundle ID:", result, `time: ${Date.now() / 1000}`);
      return result;
    }
  }
  return null;
}

// await batchSendTx([
//   // {
//   //   keypair: keypairs[1],
//   //   param: {
//   //     // side: "buy",
//   //     // amountIn: BigInt(0.5 * LAMPORTS_PER_SOL),
//   //     side: "sell",
//   //     amountIn: 28962199444098253n,
//   //   },
//   // },
//   // {
//   //   keypair: keypairs[2],
//   //   param: {
//   //     // side: "buy",
//   //     // amountIn: BigInt(0.5 * LAMPORTS_PER_SOL),
//   //     side: "sell",
//   //     amountIn: 70013924715166649n,
//   //   },
//   // },
//   // {
//   //   keypair: keypairs[3],
//   //   param: {
//   //     // side: "buy",
//   //     // amountIn: BigInt(0.5 * LAMPORTS_PER_SOL),
//   //     side: "sell",
//   //     amountIn: 43722937532352373n,
//   //   },
//   // },
//   {
//     keypair: keypairs[5],
//     param: {
//       // side: "buy",
//       // amountIn: BigInt(0.5 * LAMPORTS_PER_SOL),
//       side: "sell",
//       amountIn: 70013924715166649n,
//     },
//   },
//   // {
//   //   keypair: keypairs[0],
//   //   param: {
//   //     side: "buy",
//   //     amountIn: BigInt(0.7 * LAMPORTS_PER_SOL),
//   //   },
//   // },
// ]);
