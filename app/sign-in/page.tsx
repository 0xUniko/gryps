"use client";
import {
  checkAndUpdateSession,
  verifySignature,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import assert from "assert";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignIn() {
  const { signMessage, publicKey, connected } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const isAuth = await checkAndUpdateSession();
      setIsAuthenticated(isAuth);
      if (isAuth) {
        router.push("/");
      }
    };

    checkSession();
  }, [router]);

  const handleWalletConnect = async () => {
    assert(signMessage !== undefined, "signMessage is undefined");
    assert(publicKey !== null, "publicKey is null");

    const timestamp = Date.now();
    const message = `login ${timestamp}`;

    let errmsg = "";
    try {
      const signature = await signMessage(new TextEncoder().encode(message));

      const { msg, data } = await verifySignature(
        publicKey.toBase58(),
        Buffer.from(signature).toString("hex"),
        message
      );

      if (data) {
        setIsAuthenticated(true);
        router.push("/");
      } else {
        errmsg = msg;
      }
    } catch (error) {
      errmsg = error instanceof Error ? error.message : "Authentication failed";
    }

    toast({
      variant: "destructive",
      title: "Authentication failed",
      description: errmsg,
    });
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold">请连接并验证您的钱包</h1>
      {connected && (
        <Button
          onClick={handleWalletConnect}
          className="bg-blue-600 hover:bg-blue-700"
        >
          点击进行签名验证
        </Button>
      )}
      <WalletMultiButton />
    </div>
  );
}
