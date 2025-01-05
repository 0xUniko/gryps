import { Keypair } from "@solana/web3.js";
import { mnemonicToSeedSync } from "bip39";
import { clsx, type ClassValue } from "clsx";
import { derivePath } from "ed25519-hd-key";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const mnemonicToKeypair = (mnemonic: string) => {
  const seed = mnemonicToSeedSync(mnemonic, "");
  const path = `m/44'/501'/0'/0'`;
  return Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
};
