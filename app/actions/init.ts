"use server";
import { Res } from "@/lib/types";

export async function initPool(tokenMint: string): Promise<Res<any>> {
  if (tokenMint !== "Bim7QGxe9c82wbbGWmdbqorGEzRtRJvECY4s8YSK8oMq") {
    return {
      msg: "only support token Bim7QGxe9c82wbbGWmdbqorGEzRtRJvECY4s8YSK8oMq now",
      data: null,
    };
  }
  const poolId = "4ZRWV4zp9C5BxSgUVMAj4fqpJ2h1azL4yBWASjisoEbL";
  try {
    const data = await fetch("http://localhost:8333/pool/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Buffer.from(process.env.HELIUS_RPC!).toString(
          "base64"
        )}`,
      },
      body: JSON.stringify({ pool_id: poolId }),
    });

    const responseData = await data.json();
    return { msg: "success", data: responseData };
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "init pool failed",
      data: null,
    };
  }
}
