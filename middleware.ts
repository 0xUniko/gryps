import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: typeof NextRequest) {
  // 排除不需要验证的路径
  if (request.nextUrl.pathname === "/sign-in") {
    return NextResponse.next();
  }

  const session = request.cookies.get("session");

  // 如果没有 session，重定向到登录页
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

// 配置需要进行中间件处理的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * /api (API 路由)
     * /_next (Next.js 内部路由)
     * /_static (静态文件)
     * /favicon.ico, /sitemap.xml 等静态文件
     */
    "/((?!api|_next|_static|favicon.ico).*)",
  ],
};
