import { verifySignature } from "@/app/actions/auth";
import { useWallet } from "@solana/wallet-adapter-react";
import assert from "assert";
import { useEffect, useState } from "react";
import { useToast } from "./use-toast";

export function useAuth() {
  const { signMessage, publicKey } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 初始化时检查 localStorage 中是否存在有效的 authToken
    return !!localStorage.getItem("authToken");
  });
  const { toast } = useToast();

  // 监听 publicKey 变化，当钱包断开或更换时重置认证状态
  useEffect(() => {
    if (!publicKey) {
      setIsAuthenticated(false);
      localStorage.removeItem("authToken");
    }
  }, [publicKey]);

  const authenticate = async () => {
    const token = localStorage.getItem("authToken");
    if (token) {
      setIsAuthenticated(true);
      return token;
    }
    if (!signMessage || !publicKey) return null;

    // 创建包含时间戳的消息
    const timestamp = Date.now();
    const message = new TextEncoder().encode(`login ${timestamp}`);

    const signature = await signMessage(message);

    const { msg, data } = await verifySignature(
      publicKey.toBase58(),
      Buffer.from(signature).toString("hex"),
      Buffer.from(message).toString("hex")
    );
    if (msg !== "success") {
      toast({
        variant: "destructive",
        title: "verify signature failed",
        description: msg,
      });
      return null;
    }
    // toast({
    //   variant: "default",
    //   title: "verify signature success",
    //   description: "token: " + data,
    // });
    assert(data !== null, "data is null");

    localStorage.setItem("authToken", data);

    setIsAuthenticated(true);
    return data;
  };

  return { isAuthenticated, authenticate };
}
