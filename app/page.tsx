"use client";
import { initPool } from "@/app/actions/init";
import { createWallets, getWallets, type Wallet } from "@/app/actions/wallets";
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
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import assert from "assert";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkAndUpdateSession } from "./actions/auth";

export default function Home() {
  const [poolId, setPoolId] = useState(
    "4ZRWV4zp9C5BxSgUVMAj4fqpJ2h1azL4yBWASjisoEbL"
  );
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [newWallets, setNewWallets] = useState("");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addingWallets, setAddingWallets] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAndUpdateSession().then((isAuthenticated) => {
      if (!isAuthenticated) {
        router.push("/sign-in");
      }
    });
  }, [checkAndUpdateSession, router]);

  // 获取钱包列表
  const fetchWallets = async () => {
    try {
      const result = await getWallets(user);
      if (result.data) {
        setWallets(result.data);
      }
    } catch (error) {
      console.error("获取钱包列表失败:", error);
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
    if (!poolId) return;

    setLoading(true);
    try {
      const result = await initPool(poolId);
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
        <h2 className="text-2xl font-bold">初始化池子</h2>
        <div className="flex gap-4 max-w-md">
          <Input
            placeholder="输入Pool ID"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
          />
          <Button onClick={handleInitClick} disabled={loading || !poolId}>
            {loading ? "初始化中..." : "初始化"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">钱包管理</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>钱包地址</TableHead>
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
