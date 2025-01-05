"use client";
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
import { NATIVE_MINT } from "@solana/spl-token";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useState } from "react";

export default function Home() {
  const [tokenMint, setTokenMint] = useState(
    "Bim7QGxe9c82wbbGWmdbqorGEzRtRJvECY4s8YSK8oMq"
  );
  const [wallets, setWallets] = useState<
    (Wallet & {
      solBalance: string;
      wsolBalance: string;
      tokenBalance: string;
    })[]
  >([]);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addingWallets, setAddingWallets] = useState(false);
  const [walletAmount, setWalletAmount] = useState<number>(1);

  // 获取钱包列表
  const fetchWallets = async () => {
    const result = await getWallets();
    if (result.data) {
      setWallets(
        result.data.map((wallet) => ({
          ...wallet,
          solBalance: "获取中...",
          wsolBalance: "获取中...",
          tokenBalance: "获取中...",
        }))
      );

      const wallets = await Promise.all(
        result.data.map(async (wallet) => {
          const solBalance = await getBalance(wallet.address);
          const wsolBalance = await getTokenBalance(
            wallet.address,
            NATIVE_MINT.toBase58()
          );
          const tokenBalance = await getTokenBalance(wallet.address, tokenMint);
          return {
            ...wallet,
            solBalance:
              solBalance.data === null
                ? solBalance.msg
                : (solBalance.data / LAMPORTS_PER_SOL).toString(),
            wsolBalance:
              wsolBalance.data === null
                ? wsolBalance.msg
                : (Number(wsolBalance.data) / LAMPORTS_PER_SOL).toString(),
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

  const downloadCSV = (csvContent: string) => {
    // 创建Blob对象
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    // 创建下载链接
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    // 设置下载属性
    link.setAttribute("href", url);
    link.setAttribute("download", `wallets_${Date.now()}.csv`);

    // 添加到文档并触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 批量添加钱包
  const handleAddWallets = async () => {
    if (walletAmount <= 0 || walletAmount > 500) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入1-500之间的数量",
      });
      return;
    }

    setAddingWallets(true);
    try {
      const result = await createWallets(walletAmount);

      if (result.data) {
        downloadCSV(result.data);
        setWalletAmount(1);
        // fetchWallets(); // 刷新列表
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
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>钱包地址</TableHead>
                  <TableHead>SOL余额</TableHead>
                  <TableHead>WSOL余额</TableHead>
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
                    <TableCell>{wallet.solBalance} SOL</TableCell>
                    <TableCell>{wallet.wsolBalance} WSOL</TableCell>
                    <TableCell>{wallet.tokenBalance}</TableCell>
                    <TableCell>
                      {new Date(wallet.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-4 items-center">
            <Input
              type="number"
              min={1}
              max={500}
              value={walletAmount}
              onChange={(e) => setWalletAmount(Number(e.target.value))}
              placeholder="输入创建钱包数量（最大500个）"
              className="max-w-[100px]"
            />
            <Button onClick={handleAddWallets} disabled={addingWallets}>
              {addingWallets ? "创建中..." : "批量添加钱包"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
