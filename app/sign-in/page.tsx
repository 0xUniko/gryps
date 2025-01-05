"use client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignIn() {
  const { isAuthenticated, authenticate } = useAuth();
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleWalletConnect = async () => {
    const success = await authenticate();
    if (success) {
      router.push("/");
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold">请连接并验证您的钱包</h1>
      {connected && !isAuthenticated && (
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
