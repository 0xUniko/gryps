import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { poolId } = await request.json();

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
    return NextResponse.json(await data.json());
    // return NextResponse.json({ message: "API路由测试成功" });
  } catch (error) {
    return NextResponse.json(
      { error: "初始化失败", details: String(error) },
      { status: 500 }
    );
  }
}
