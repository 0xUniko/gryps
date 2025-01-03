"use client";
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
import assert from "assert";
import { useEffect, useState } from "react";

async function init(poolId: string) {
  const response = await fetch("/api/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ poolId }),
  });

  if (!response.ok) {
    throw new Error("初始化失败");
  }

  return response.json();
}

export default function Home() {
  const [poolId, setPoolId] = useState("");
  const [wallets, setWallets] = useState<
    Array<{ id: number; address: string; created_at: string }>
  >([]);
  const [newWallets, setNewWallets] = useState("");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [addingWallets, setAddingWallets] = useState(false);

  // 获取钱包列表
  const fetchWallets = async () => {
    try {
      const response = await fetch("/api/wallets");
      const data = await response.json();
      if (data.wallets) {
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error("获取钱包列表失败:", error);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  // 批量添加钱包
  const handleAddWallets = async () => {
    if (!newWallets.trim()) return;

    setAddingWallets(true);
    try {
      const addresses = newWallets
        .split("\n")
        .filter((address) => address.trim());
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ addresses }),
      });

      if (!response.ok) throw new Error("添加失败");

      toast({
        title: "成功",
        description: "钱包添加成功",
      });
      setNewWallets("");
      fetchWallets(); // 刷新列表
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
      const res = await init(poolId);
      assert(res.msg === "success", res.msg);
      toast({
        title: "成功",
        description: "初始化成功",
      });
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
