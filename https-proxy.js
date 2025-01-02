const https = require("https");
const http = require("http");
const fs = require("fs");

// HTTPS 证书配置
const httpsOptions = {
  key: fs.readFileSync("./localhost-key.pem"),
  cert: fs.readFileSync("./localhost.pem"),
};

// 目标 HTTP 服务器配置
const targetConfig = {
  host: "localhost",
  port: 3000, // 你的 HTTP 服务端口
};

// 创建 HTTPS 代理服务器
const proxyServer = https.createServer(httpsOptions, (req, res) => {
  console.log(`代理请求: ${req.method} ${req.url}`);

  // 转发请求配置
  const options = {
    hostname: targetConfig.host,
    port: targetConfig.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  // 创建代理请求
  const proxyReq = http.request(options, (proxyRes) => {
    // 复制响应头
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    // 转发响应数据
    proxyRes.pipe(res);
  });

  // 转发请求数据
  req.pipe(proxyReq);

  // 错误处理
  proxyReq.on("error", (error) => {
    console.error("代理请求错误:", error);
    res.writeHead(500);
    res.end("代理请求错误");
  });
});

// 启动代理服务器
const PROXY_PORT = 3001; // 或其他端口，如 8443
proxyServer.listen(PROXY_PORT, () => {
  console.log(`HTTPS 代理服务器运行在 https://localhost:${PROXY_PORT}`);
  console.log(`将请求转发到 http://localhost:${targetConfig.port}`);
});

// 错误处理
proxyServer.on("error", (error) => {
  console.error("服务器错误:", error);
});
