import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export function middleware(request: NextRequest) {
  // 排除不需要验证的路径
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new NextResponse(JSON.stringify({ error: "未授权" }), {
      status: 401,
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return new NextResponse(JSON.stringify({ error: "无效的 token" }), {
      status: 401,
    });
  }
}

export const config = {
  matcher: "/api/:path*",
};
