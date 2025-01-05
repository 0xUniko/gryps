"use client";
import { signOut } from "@/app/actions/auth";
import { initPool } from "@/app/actions/init";
import { batchSendTx } from "@/app/actions/swap";
import {
  createWallets,
  getBalance,
  getTokenBalance,
  getWallets,
  type Wallet,
} from "@/app/actions/wallet";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { NATIVE_MINT } from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [formDataList, setFormDataList] = useState([
    {
      walletId: 0,
      side: "buy" as "buy" | "sell",
      amount: 0,
    },
  ]);

  const { disconnecting } = useWallet();
  useEffect(() => {
    if (disconnecting) {
      signOut();
    }
  }, [disconnecting]);

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

  const addForm = () => {
    if (formDataList.length < 5) {
      setFormDataList([
        ...formDataList,
        {
          walletId: 0,
          side: "buy" as "buy" | "sell",
          amount: 0,
        },
      ]);
    }
  };

  const removeForm = (index: number) => {
    setFormDataList(formDataList.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      // 这里处理多个表单的提交
      // console.log("提交交易:", formDataList);
      const result = await batchSendTx(
        tokenMint,
        formDataList.map((d) => ({
          walletId: d.walletId,
          param: { side: d.side, amountIn: BigInt(d.amount) },
        }))
      );
    } catch (error) {
      console.error("交易错误:", error);
      toast({
        variant: "destructive",
        title: "错误",
        description: error instanceof Error ? error.message : "交易失败",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex justify-end mb-4">
        <WalletMultiButton />
      </div>

      <div className="mb-8 space-y-4">
        <h2 className="text-2xl font-bold">开始Raydium池子监听</h2>
        <div className="flex gap-4 max-w-md">
          <Input
            placeholder="输入代币地址"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
          />
          <Button onClick={handleInitClick} disabled={loading || !tokenMint}>
            {loading ? "开始..." : "开始监听"}
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

      <div className="space-y-4 p-4">
        {formDataList.map((formData, index) => (
          <div key={index} className="space-y-4 border p-4 rounded-lg relative">
            {formDataList.length > 1 && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => removeForm(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <div>
              <label className="text-sm font-medium">钱包 ID</label>
              <Input
                type="number"
                value={formData.walletId}
                onChange={(e) =>
                  setFormDataList(
                    formDataList.map((item, i) =>
                      i === index
                        ? { ...item, walletId: parseInt(e.target.value) }
                        : item
                    )
                  )
                }
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">交易类型</label>
              <ToggleGroup
                type="single"
                value={formData.side}
                onValueChange={(value: "buy" | "sell") => {
                  if (value) {
                    // 确保有值时才更新
                    setFormDataList(
                      formDataList.map((item, i) =>
                        i === index ? { ...item, side: value } : item
                      )
                    );
                  }
                }}
                className="mt-1 justify-start"
              >
                <ToggleGroupItem value="buy" aria-label="买入">
                  买入
                </ToggleGroupItem>
                <ToggleGroupItem value="sell" aria-label="卖出">
                  卖出
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div>
              <label className="text-sm font-medium">
                {formData.side === "buy" ? "wsol" : "代币"}数量
              </label>
              <Input
                type="number"
                step="0.000001"
                value={formData.amount}
                onChange={(e) =>
                  setFormDataList(
                    formDataList.map((item, i) =>
                      i === index
                        ? { ...item, amount: parseFloat(e.target.value) }
                        : item
                    )
                  )
                }
                className="mt-1"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-4">
          <Button
            onClick={addForm}
            disabled={formDataList.length >= 5}
            variant="outline"
            className="w-full"
          >
            添加交易表单 ({formDataList.length}/5)
          </Button>

          <Button onClick={handleSubmit} className="w-full">
            批量提交交易
          </Button>
        </div>
      </div>
    </div>
  );
}
