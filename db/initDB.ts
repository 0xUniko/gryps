import { Database } from "bun:sqlite";

// 创建数据库连接
const db = new Database("database.db");

// 创建钱包表
db.run(`
  CREATE TABLE IF NOT EXISTS wallet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    mnemonic TEXT NOT NULL,
    user TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP DEFAULT NULL
  )
`);

// 只使用 PRIMARY KEY 就足够了，因为它已经隐含了 UNIQUE 约束
db.run(`
  CREATE TABLE IF NOT EXISTS user (
    address TEXT PRIMARY KEY
  )
`);
