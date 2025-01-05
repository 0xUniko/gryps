"use server";
import { Res } from "@/lib/types";

export async function initPool(poolId: string): Promise<Res<any>> {
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
