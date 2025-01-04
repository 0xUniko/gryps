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
