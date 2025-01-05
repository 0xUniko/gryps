"use server";

import { db } from "@/lib/instances";
import { createSession, decrypt, updateSession } from "@/lib/session";
import { Res } from "@/lib/types";
import { PublicKey } from "@solana/web3.js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import nacl from "tweetnacl";

export async function verifySignature(
  publicKey: string,
  signature: string,
  message: string
): Promise<Res<boolean>> {
  const timestamp = message.split(" ").at(-1);
  if (
    !timestamp ||
    Date.now() - Number(timestamp) > 1000 * 60 ||
    Date.now() - Number(timestamp) <= 0
  ) {
    return { msg: "timestamp invalid", data: null };
  }
  // 验证签名
  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
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

export const verifyAuth = cache(async () => {
  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  if (!session?.publicKey) {
    redirect("/sign-in");
  } else {
    //   // 检查用户是否仍在白名单中
    const user = db
      .query("SELECT * FROM user WHERE address = $1")
      .all(session.publicKey as string);

    if (!user.length) {
      redirect("/sign-in");
    }

    return session.publicKey as string;
  }
});

export async function checkAndUpdateSession(): Promise<string> {
  const publicKey = await verifyAuth();
  if (publicKey) {
    await updateSession();
    return publicKey;
  }
  return "";
}

// sign out
export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/sign-in");
}
