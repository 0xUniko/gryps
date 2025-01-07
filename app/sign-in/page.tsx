"use client";
import { verifySignature } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import assert from "assert";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function SignIn() {
  const { signMessage, publicKey, connected } = useWallet();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleWalletConnect = async () => {
    assert(signMessage !== undefined, "signMessage is undefined");
    assert(publicKey !== null, "publicKey is null");

    setIsLoading(true);
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

      setIsLoading(false);

      if (data) {
        router.push("/");
      } else {
        errmsg = msg;
      }
    } catch (error) {
      setIsLoading(false);
      errmsg = error instanceof Error ? error.message : "Authentication failed";
    }
    if (errmsg) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: errmsg,
      });
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-2xl font-bold">请连接并验证您的钱包</h1>
      {connected && (
        <Button
          onClick={handleWalletConnect}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isLoading}
        >
          {isLoading ? "验证中..." : "点击进行签名验证"}
        </Button>
      )}
      <WalletMultiButton />
    </div>
  );
}
