import { Connection } from "@solana/web3.js";
import { Database } from "bun:sqlite";

// 创建单例数据库连接
class DatabaseConnection {
  private static instance: Database;

  public static getInstance(): Database {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new Database("database.db");
    }
    return DatabaseConnection.instance;
  }
}

export const db = DatabaseConnection.getInstance();

// 创建Solana连接单例
class SolanaConnection {
  private static instance: Connection;
  private static readonly ENDPOINT = process.env.HELIUS_RPC!;

  public static getInstance(): Connection {
    if (!SolanaConnection.instance) {
      SolanaConnection.instance = new Connection(SolanaConnection.ENDPOINT);
    }
    return SolanaConnection.instance;
  }
}

export const connection = SolanaConnection.getInstance();
