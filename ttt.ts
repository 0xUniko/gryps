import { Database } from "bun:sqlite";

const db = Database.open("database.db");

let query = `
    SELECT id, mnemonic FROM wallet 
    WHERE closed_at IS NULL
    AND user = ?
    AND closed_at IS NULL
    ORDER BY created_at DESC
  `;

const wallets = db
  .prepare(query)
  .all("8NUzsBZK1Pejyy85PMiaRJHeSLuBDqFbqLMFaLVWCdwh") as {
  id: number;
  mnemonic: string;
}[];

const wallet = wallets[0];
console.log(new Map([[wallet.id, wallet.mnemonic]]));
