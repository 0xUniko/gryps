"use server";
import { jitoClient, sendBundle } from "@/lib/jito";
import { mnemonicToKeypair } from "@/lib/utils";
import {
  type AmmV4Keys,
  type ComputeBudgetConfig,
  InstructionType,
  Owner,
  Raydium,
  TxBuilder,
  TxVersion,
  makeAMMSwapInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT, getAssociatedTokenAddress } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import Decimal from "decimal.js";
import { verifyAuth } from "./auth";

const connection = new Connection(process.env.HELIUS_RPC!);

const raydium = await Raydium.load({
  connection,
  cluster: "mainnet",
  disableFeatureCheck: true,
  disableLoadToken: true,
  blockhashCommitment: "confirmed",
});

const dataserver = `http://localhost:${process.env.DATASERVER_PORT}`;

async function getPoolInfo() {
  const data = await fetch(`${dataserver}/pool/info`, {
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
  const data = await fetch(`${dataserver}/pool/reserve`, {
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

async function getJitoTip() {
  const data = await fetch(`${dataserver}/jito/tip`, {
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
  const data = await fetch(`${dataserver}/jito/tip-account`, {
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

async function getWallets(user: string) {
  const data = await fetch(`${dataserver}/wallets/cache?user=${user}`, {
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

export async function batchSendTx(
  tokenMint: string,
  tradeParams: {
    walletId: number;
    param: {
      side: "sell" | "buy";
      // amountIn: bigint;
      amountIn: number;
    };
  }[],
  confirmed = false
) {
  const pubkey = await verifyAuth();

  const { msg: getJitoTipAccountMsg, data: jitoTipAccount } =
    await getJitoTipAccount();
  if (getJitoTipAccountMsg !== "success") {
    return {
      msg: `failed to get jito tip account: ${getJitoTipAccountMsg}`,
      data: null,
    };
  }

  const { msg: getJitoTipMsg, data: jitoTipAmount } = await getJitoTip();
  if (getJitoTipMsg !== "success") {
    return {
      msg: `failed to get jito tip: ${getJitoTipMsg}`,
      data: null,
    };
  }

  const { msg: getPoolInfoMsg, data: poolInfoData } = await getPoolInfo();
  if (getPoolInfoMsg !== "success") {
    return {
      msg: `failed to get pool info: ${getPoolInfoMsg}`,
      data: null,
    };
  }
  const { poolInfo, poolKeys } = poolInfoData;
  const baseIn = tokenMint === poolInfo.mintA.address;

  const { msg: getWalletsMsg, data: wallets } = await getWallets(pubkey);
  if (getWalletsMsg !== "success") {
    return {
      msg: `failed to get wallets: ${getWalletsMsg}`,
      data: null,
    };
  }

  if (
    tradeParams.filter((t) =>
      wallets.find((w: { id: number }) => w.id === t.walletId)
    ).length !== tradeParams.length
  ) {
    return {
      msg: "invalid wallet id",
      data: null,
    };
  }

  console.log(`start getting latest blockhash: ${Date.now() / 1000}`);
  const latestBlock = await connection.getLatestBlockhash("confirmed");

  console.log(`start getting pool info from rpc: ${Date.now() / 1000}`);
  const { msg: getReserveMsg, data: reserveData } = await getReserve();
  if (getReserveMsg !== "success") {
    return {
      msg: `failed to get reserve: ${getReserveMsg}`,
      data: null,
    };
  }
  console.log(`end getting pool info from rpc: ${Date.now() / 1000}`);

  const status = new BN(reserveData.status).toNumber();

  const trades = tradeParams.reduce(
    (acc, t) => {
      const mintIn =
        t.param.side === "buy" ? NATIVE_MINT : new PublicKey(tokenMint);
      const mintOut =
        t.param.side === "buy" ? new PublicKey(tokenMint) : NATIVE_MINT;

      const input: "base" | "quote" = baseIn
        ? t.param.side === "buy"
          ? "quote"
          : "base"
        : t.param.side === "buy"
        ? "base"
        : "quote";

      const amountIn = new BN(
        new Decimal(t.param.amountIn.toString())
          .mul(
            new Decimal(10).pow(
              new Decimal(
                input === "base"
                  ? poolInfo.mintA.decimals
                  : poolInfo.mintB.decimals
              )
            )
          )
          .toString()
      );

      // const amountIn = new BN(t.param.amountIn.toString());

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
          //   walletId: t.walletId,
          keypair: mnemonicToKeypair(
            wallets.find(
              (w: { id: number; mnemonic: string }) => w.id === t.walletId
            )?.mnemonic!
          ),
          amountIn,
          amountOut: out.minAmountOut,
          mintIn,
          mintOut,
        },
      ];
    },
    [
      {
        baseReserve: new BN(reserveData.baseReserve),
        quoteReserve: new BN(reserveData.quoteReserve),
        keypair: new Keypair(),
        // walletId: -1,
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
          i === array.length - 1
            ? {
                jitoTipAccount: new PublicKey(jitoTipAccount),
                jitoTipAmount,
              }
            : undefined
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
      return { msg: "success", data: result };
    } else {
      const { result } = await jitoClient.sendBundle([transactions]);
      console.log("Bundle ID:", result, `time: ${Date.now() / 1000}`);
      return { msg: "success", data: result };
    }
  }
  return { msg: "failed to send tx", data: null };
}

// console.log(
//   await batchSendTx("Bim7QGxe9c82wbbGWmdbqorGEzRtRJvECY4s8YSK8oMq", [
//     { walletId: 1, param: { side: "sell", amountIn: 100 } },
//   ])
// );
