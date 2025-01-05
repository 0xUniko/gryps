"use client";
import { signOut } from "@/app/actions/auth";
import { initPool } from "@/app/actions/init";
import {
  createWallets,
  getBalance,
  getTokenBalance,
  getWallets,
  type Wallet,
} from "@/app/actions/wallets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkAndUpdateSession } from "./actions/auth";

export default function Home() {
  const [tokenMint, setTokenMint] = useState(
    "Bim7QGxe9c82wbbGWmdbqorGEzRtRJvECY4s8YSK8oMq"
  );
  const [wallets, setWallets] = useState<
    (Wallet & {
      solBalance: string;
      tokenBalance: string;
    })[]
  >([]);
  const [newWallets, setNewWallets] = useState("");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addingWallets, setAddingWallets] = useState(false);
  const router = useRouter();
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    if (!connected || !publicKey) {
      // 当钱包断开连接时，删除会话并重定向到登录页
      signOut();
    }
  }, [connected, publicKey]);

  // 获取钱包列表
  const fetchWallets = async () => {
    const result = await getWallets(publicKey?.toBase58()!);
    if (result.data) {
      setWallets(
        result.data.map((wallet) => ({
          ...wallet,
          solBalance: "获取中...",
          tokenBalance: "获取中...",
        }))
      );

      const wallets = await Promise.all(
        result.data.map(async (wallet) => {
          const solBalance = await getBalance(wallet.address);
          const tokenBalance = await getTokenBalance(wallet.address, tokenMint);
          return {
            ...wallet,
            solBalance:
              solBalance.data === null
                ? solBalance.msg
                : (solBalance.data / LAMPORTS_PER_SOL).toString(),
            tokenBalance:
              tokenBalance.data === null
                ? tokenBalance.msg
                : (Number(tokenBalance.data) / 10 ** 6).toString(),
          };
        })
      );
      setWallets(wallets);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.msg || "get wallets failed",
      });
    }
  };

  // 批量添加钱包
  const handleAddWallets = async () => {
    if (!newWallets.trim()) return;

    setAddingWallets(true);
    try {
      const amount = newWallets
        .split("\n")
        .filter((address) => address.trim()).length;
      const result = await createWallets(amount);

      if (result.msg === "success") {
        toast({
          title: "成功",
          description: "钱包添加成功",
        });
        setNewWallets("");
        fetchWallets(); // 刷新列表
      } else {
        throw new Error(result.msg);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "错误",
        description: error instanceof Error ? error.message : "添加钱包失败",
      });
    } finally {
      setAddingWallets(false);
    }
  };

  const handleInitClick = async () => {
    if (!tokenMint) return;

    setLoading(true);
    try {
      const result = await initPool(tokenMint);
      if (result.msg === "success") {
        toast({
          title: "成功",
          description: "初始化成功",
        });
      } else {
        throw new Error(result.msg);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "错误",
        description: error instanceof Error ? error.message : "初始化失败",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex justify-end mb-4">
        <WalletMultiButton />
      </div>

      <div className="mb-8 space-y-4">
        <h2 className="text-2xl font-bold">初始化Raydium池子监听</h2>
        <div className="flex gap-4 max-w-md">
          <Input
            placeholder="输入代币地址"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
          />
          <Button onClick={handleInitClick} disabled={loading || !tokenMint}>
            {loading ? "初始化中..." : "初始化"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">钱包管理</h2>
          <Button onClick={fetchWallets} disabled={loading}>
            获取钱包列表和余额
          </Button>
          <Button onClick={handleAddWallets} disabled={addingWallets}>
            批量添加钱包
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>钱包地址</TableHead>
                  <TableHead>SOL余额</TableHead>
                  <TableHead>代币余额</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet) => (
                  <TableRow key={wallet.id}>
                    <TableCell>{wallet.id}</TableCell>
                    <TableCell className="font-mono">
                      {wallet.address}
                    </TableCell>
                    <TableCell>{wallet.solBalance ?? "0"} SOL</TableCell>
                    <TableCell>{wallet.tokenBalance ?? "0"}</TableCell>
                    <TableCell>
                      {new Date(wallet.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
