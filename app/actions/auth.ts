"use server";

import { db } from "@/lib/db";
import { PublicKey } from "@solana/web3.js";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function verifySignature(
  publicKey: string,
  signature: string,
  message: string
) {
  // 验证签名
  const verified = nacl.sign.detached.verify(
    Buffer.from(message, "hex"),
    Buffer.from(signature, "hex"),
    new PublicKey(publicKey).toBytes()
  );

  if (!verified) {
    //   throw new Error("");
    return { msg: "fail to verify signature", data: null };
  }

  // 检查用户是否在白名单中
  const user = db.query("SELECT * FROM user WHERE address = $1").all(publicKey);

  if (!user.length) {
    return { msg: "not in whitelist", data: null };
  }

  // 生成 JWT token
  const token = jwt.sign({ publicKey }, JWT_SECRET, { expiresIn: "7d" });

  return { msg: "success", data: token };
}

export async function verifyAuthToken(token: string) {
  try {
    // 验证 JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // 检查解码后的数据是否包含 publicKey
    if (!decoded || typeof decoded !== "object" || !("publicKey" in decoded)) {
      return { msg: "invalid token format", data: null };
    }

    // 检查用户是否仍在白名单中
    const user = db
      .query("SELECT * FROM user WHERE address = $1")
      .all(decoded.publicKey);

    if (!user.length) {
      return { msg: "user not found in whitelist", data: null };
    }

    return { msg: "success", data: decoded };
  } catch (error) {
    // 处理验证失败的情况
    return { msg: "invalid token", data: null };
  }
}
