"use server";

import { db } from "@/lib/db";
import { Res } from "@/lib/types";
import { Keypair } from "@solana/web3.js";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";

export type Wallet = {
  id: number;
  address: string;
  created_at: string;
};

export async function getWallets(user: string): Promise<Res<Wallet[]>> {
  try {
    let query = `
      SELECT * FROM wallet 
      WHERE closed_at IS NULL
      AND user = ?
      AND closed_at IS NULL
      ORDER BY created_at DESC
    `;

    const wallets = db.prepare(query).all(user) as Wallet[];
    return { msg: "success", data: wallets };
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "get wallets failed",
      data: null,
    };
  }
}

const mnemonicToKeypair = (mnemonic: string) => {
  const seed = mnemonicToSeedSync(mnemonic, "");
  const path = `m/44'/501'/0'/0'`;
  return Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
};

export async function createWallets(amount: number): Promise<
  Res<
    Array<{
      name: number;
      mnemonic: string;
      address: string;
    }>
  >
> {
  try {
    const wallets = [];
    for (let i = 0; i < amount; i++) {
      const mnemonic = generateMnemonic();
      const keypair = mnemonicToKeypair(mnemonic);
      wallets.push({
        name: i,
        mnemonic,
        address: keypair.publicKey.toString(),
      });
    }

    // 批量插入钱包地址
    for (const wallet of wallets) {
      db.prepare("INSERT INTO wallets (address, mnemonic) VALUES (?, ?)").run(
        wallet.address,
        wallet.mnemonic
      );
    }

    return { msg: "success", data: wallets };
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "create wallets failed",
      data: null,
    };
  }
}
