import { verifySignature } from "@/app/actions/auth";
import { useWallet } from "@solana/wallet-adapter-react";
import assert from "assert";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "./use-toast";

export function useAuth() {
  const { signMessage, publicKey } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const authenticate = async () => {
    assert(signMessage !== undefined, "signMessage is undefined");
    assert(publicKey !== null, "publicKey is null");

    // 创建包含时间戳的消息
    const timestamp = Date.now();
    const message = new TextEncoder().encode(`login ${timestamp}`);

    const signature = await signMessage(message);

    const { msg, data } = await verifySignature(
      publicKey.toBase58(),
      Buffer.from(signature).toString("hex"),
      Buffer.from(message).toString("hex")
    );

    if (msg === "success" && data) {
      setIsAuthenticated(true);
      router.refresh(); // 刷新页面以更新session状态
      return true;
    }

    toast({
      variant: "destructive",
      title: "Authentication failed",
      description: msg,
    });

    return false;
  };

  return { isAuthenticated, authenticate };
}
