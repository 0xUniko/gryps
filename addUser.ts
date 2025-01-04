import { Database } from "bun:sqlite";

const db = new Database("database.db");

// 只使用 PRIMARY KEY 就足够了，因为它已经隐含了 UNIQUE 约束
db.run(`
  CREATE TABLE IF NOT EXISTS user (
    address TEXT PRIMARY KEY
  )
`);

// 插入新用户
try {
  db.run(
    `
    INSERT INTO user (address) 
    VALUES (?)
  `,
    ["8NUzsBZK1Pejyy85PMiaRJHeSLuBDqFbqLMFaLVWCdwh"]
  );

  console.log("用户添加成功");
} catch (error: unknown) {
  // 如果地址已存在，会抛出唯一性约束违反的错误
  if (error instanceof Error) {
    console.error("添加用户失败：", error.message);
  } else {
    console.error("添加用户失败：", String(error));
  }
}
