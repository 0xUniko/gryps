import { db } from "@/lib/db";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { Database } from "bun:sqlite";
import { derivePath } from "ed25519-hd-key";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const user = searchParams.get("user");

    let query = `
      SELECT * FROM wallet 
      WHERE closed_at IS NULL
      AND user = ?
      AND closed_at IS NULL
      ORDER BY created_at DESC
    `;

    const wallets = db.prepare(query).all(user);
    return NextResponse.json({
      msg: "success",
      data: wallets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        msg: error instanceof Error ? error.message : "获取钱包列表失败",
        data: null,
      },
      { status: 500 }
    );
  }
}

export const mnemonicToKeypair = (mnemonic: string) => {
  const seed = mnemonicToSeedSync(mnemonic, "");
  const path = `m/44'/501'/0'/0'`; // we assume it's first path
  // @ts-ignore
  return Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
};

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    const wallets = [];
    for (let i = 0; i < 10; i++) {
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

    return NextResponse.json({
      msg: "success",
      data: wallets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        msg: error instanceof Error ? error.message : "添加钱包失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
