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
    const data = await fetch(
      `http://localhost:${process.env.DATASERVER_PORT}/pool/init`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Buffer.from(
            process.env.HELIUS_RPC!
          ).toString("base64")}`,
        },
        body: JSON.stringify({ pool_id: poolId }),
      }
    );

    return await data.json();
  } catch (error) {
    return {
      msg: error instanceof Error ? error.message : "init pool failed",
      data: null,
    };
  }
}
