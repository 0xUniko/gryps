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
    const responseData = await data.json();
    return NextResponse.json({
      msg: "success",
      data: responseData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        msg: error instanceof Error ? error.message : "初始化失败",
        data: null,
      },
      { status: 500 }
    );
  }
}
