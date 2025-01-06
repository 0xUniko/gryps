"use server";

import { connection, db } from "@/lib/instances";
import { Res } from "@/lib/types";
import { mnemonicToKeypair } from "@/lib/utils";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Keypair, PublicKey, SolanaJSONRPCError } from "@solana/web3.js";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { verifyAuth } from "./auth";

export type Wallet = {
  id: number;
  address: string;
  created_at: string;
};

export async function getWallets(): Promise<Res<Wallet[]>> {
  const pubkey = await verifyAuth();

  try {
    const data = await fetch(`http://localhost:8333/wallets?user=${pubkey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Buffer.from(process.env.HELIUS_RPC!).toString(
          "base64"
        )}`,
      },
    });
    const { msg, data: wallets } = await data.json();
    if (msg === "success") {
      return {
        msg: "success",
        data: wallets.map(({ id, address, created_at }: Wallet) => ({
          id,
          address,
          created_at,
        })),
      };
    } else {
      return {
        msg,
        data: null,
      };
    }
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "get wallets failed",
      data: null,
    };
  }
}

type Signer = {
  id: number;
  address: string;
  mnemonic: string;
};

export async function createWallets(amount: number): Promise<Res<string>> {
  const pubkey = await verifyAuth();
  try {
    const wallets = [];
    for (let i = 0; i < amount; i++) {
      const mnemonic = generateMnemonic();
      const keypair = mnemonicToKeypair(mnemonic);
      wallets.push({
        mnemonic,
        address: keypair.publicKey.toString(),
      });
    }

    // 使用单条SQL批量插入并返回插入的数据
    const placeholders = wallets.map(() => "(?, ?, ?)").join(", ");
    const values = wallets.flatMap((wallet) => [
      wallet.address,
      wallet.mnemonic,
      pubkey,
    ]);
    const insertedWallets = db
      .prepare(
        `
      INSERT INTO wallet (address, mnemonic, user) 
      VALUES ${placeholders}
      RETURNING id, address, mnemonic
    `
      )
      .all(...values) as Signer[];

    // 生成CSV内容
    const csvContent = generateCSVContent(insertedWallets as Signer[]);
    return { msg: "success", data: csvContent };
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "create wallets failed",
      data: null,
    };
  }
}

function generateCSVContent(wallets: Signer[]): string {
  // CSV 标题行
  const headers = ["Id", "Address", "Mnemonic"];

  // 转换数据为CSV格式
  const rows = wallets.map((wallet) => [
    wallet.id,
    wallet.address,
    wallet.mnemonic,
  ]);

  // 组合标题和数据行
  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export async function getTokenBalance(
  wallet: string,
  mint: string
): Promise<Res<bigint>> {
  const walletAddress = new PublicKey(wallet);
  const mintAddress = new PublicKey(mint);
  try {
    const metadataAddress = await getAssociatedTokenAddress(
      mintAddress,
      walletAddress
    );
    const tokenAmount = await connection.getTokenAccountBalance(
      metadataAddress
    );
    return { msg: "success", data: BigInt(tokenAmount.value.amount) };
  } catch (e) {
    if (e instanceof SolanaJSONRPCError) {
      return { msg: "success", data: 0n };
    } else {
      return {
        msg: e instanceof Error ? e.message : "get token balance failed",
        data: null,
      };
    }
  }
}

export async function getBalance(publicKey: string) {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return { msg: "success", data: balance };
  } catch (e) {
    return {
      msg: e instanceof Error ? e.message : "get balance failed",
      data: null,
    };
  }
}
