"use server";

import { db } from "@/lib/db";
import { createSession, decrypt, updateSession } from "@/lib/session";
import { Res } from "@/lib/types";
import { PublicKey } from "@solana/web3.js";
import { cookies } from "next/headers";
import nacl from "tweetnacl";

export async function verifySignature(
  publicKey: string,
  signature: string,
  message: string
): Promise<Res<boolean>> {
  // 验证签名
  const verified = nacl.sign.detached.verify(
    Buffer.from(message, "hex"),
    Buffer.from(signature, "hex"),
    new PublicKey(publicKey).toBytes()
  );

  if (!verified) {
    return { msg: "fail to verify signature", data: null };
  }

  // 检查用户是否在白名单中
  const user = db.query("SELECT * FROM user WHERE address = $1").all(publicKey);

  if (!user.length) {
    return { msg: "not in whitelist", data: null };
  }

  // 创建session
  await createSession(publicKey);

  return { msg: "success", data: true };
}

export async function verifyAuth() {
  const session = (await cookies()).get("session")?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return { msg: "unauthorized", data: null };
  }

  // 检查用户是否仍在白名单中
  const user = db
    .query("SELECT * FROM user WHERE address = $1")
    .all(payload.publicKey);

  if (!user.length) {
    return { msg: "user not found in whitelist", data: null };
  }

  return { msg: "success", data: payload };
}

export async function checkAndUpdateSession(): Promise<boolean> {
  const { msg, data } = await verifyAuth();
  if (msg === "success" && data) {
    await updateSession();
    return true;
  }
  return false;
}


