import {
  AmmV4Keys,
  AmmV5Keys,
  ApiV3PoolInfoStandardItem,
  Raydium,
  liquidityStateV4Layout,
} from "@raydium-io/raydium-sdk-v2";
import { AccountLayout } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import assert from "assert";
import BN from "bn.js";
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { getTip, jitoClient } from "../lib/jito";

const db = Database.open("database.db");

const connection = new Connection(process.env.HELIUS_RPC!);

const raydium = await Raydium.load({
  connection,
  cluster: "mainnet",
  disableFeatureCheck: true,
  disableLoadToken: true,
  blockhashCommitment: "confirmed",
});

class PoolReserve {
  baseReserve?: BN;
  quoteReserve?: BN;
  lpInfo?: ReturnType<typeof liquidityStateV4Layout.decode>;
  poolInfo?: ApiV3PoolInfoStandardItem;
  poolKeys?: AmmV4Keys | AmmV5Keys;
  baseVaultListener?: number;
  quoteVaultListener?: number;
  lpInfoListener?: number;

  async cleanup() {
    if (this.baseVaultListener !== undefined) {
      await connection.removeAccountChangeListener(this.baseVaultListener);
      this.baseVaultListener = undefined;
    }
    if (this.quoteVaultListener !== undefined) {
      await connection.removeAccountChangeListener(this.quoteVaultListener);
      this.quoteVaultListener = undefined;
    }
    if (this.lpInfoListener !== undefined) {
      await connection.removeAccountChangeListener(this.lpInfoListener);
      this.lpInfoListener = undefined;
    }
  }

  async init(poolId: string) {
    await this.cleanup();

    const { poolRpcData, poolInfo, poolKeys } =
      await raydium.liquidity.getPoolInfoFromRpc({
        poolId,
      });
    this.baseReserve = poolRpcData.baseReserve;
    this.quoteReserve = poolRpcData.quoteReserve;
    this.lpInfo = poolRpcData;
    this.poolInfo = poolInfo;
    this.poolKeys = poolKeys;

    this.baseVaultListener = connection.onAccountChange(
      poolRpcData.baseVault,
      (accountInfo) => {
        this.updateBaseReserve(accountInfo.data);
      },
      {
        commitment: "confirmed",
      }
    );

    this.quoteVaultListener = connection.onAccountChange(
      poolRpcData.quoteVault,
      (accountInfo) => {
        this.updateQuoteReserve(accountInfo.data);
      },
      {
        commitment: "confirmed",
      }
    );

    this.lpInfoListener = connection.onAccountChange(
      new PublicKey(poolId),
      async (accountInfo) => {
        const lpInfo = liquidityStateV4Layout.decode(accountInfo.data);
        const { baseVault, quoteVault } = lpInfo;

        if (this.lpInfo?.baseVault.toBase58() !== baseVault.toBase58()) {
          if (this.baseVaultListener !== undefined)
            await connection.removeAccountChangeListener(
              this.baseVaultListener
            );

          this.baseVaultListener = connection.onAccountChange(
            baseVault,
            (accountInfo) => {
              this.updateBaseReserve(accountInfo.data);
            },
            {
              commitment: "confirmed",
            }
          );
        }

        if (this.lpInfo?.quoteVault.toBase58() !== quoteVault.toBase58()) {
          if (this.quoteVaultListener !== undefined)
            await connection.removeAccountChangeListener(
              this.quoteVaultListener
            );

          this.quoteVaultListener = connection.onAccountChange(
            quoteVault,
            (accountInfo) => {
              this.updateQuoteReserve(accountInfo.data);
            },
            {
              commitment: "confirmed",
            }
          );
        }

        this.lpInfo = lpInfo;
      },
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
      }
    );
  }
  get value() {
    assert(this.baseReserve !== undefined, "server is not initialised");
    assert(this.quoteReserve !== undefined, "server is not initialised");
    assert(this.lpInfo !== undefined, "server is not initialised");
    return {
      base_reserve: this.baseReserve.toString(),
      quote_reserve: this.quoteReserve.toString(),
      status: this.lpInfo.status.toString(),
      poolInfo: this.poolInfo,
      poolKeys: this.poolKeys,
    };
  }
  updateBaseReserve(baseVaultAccountInfoData: Buffer) {
    assert(this.lpInfo !== undefined, "server is not initialised");
    const vaultInfo = new BN(
      AccountLayout.decode(baseVaultAccountInfoData).amount.toString()
    );
    this.baseReserve = vaultInfo.sub(this.lpInfo.baseNeedTakePnl);
    console.log(
      `base reserve: ${this.baseReserve.toString()}`,
      `time: ${Date.now() / 1000}`
    );
  }
  updateQuoteReserve(quoteVaultAccountInfoData: Buffer) {
    assert(this.lpInfo !== undefined, "server is not initialised");
    const vaultInfo = new BN(
      AccountLayout.decode(quoteVaultAccountInfoData).amount.toString()
    );
    this.quoteReserve = vaultInfo.sub(this.lpInfo.quoteNeedTakePnl);
    console.log(
      `quote reserve: ${this.quoteReserve.toString()}`,
      `time: ${Date.now() / 1000}`
    );
  }
}

class Jito {
  jitoTip?: number;
  private updateInterval?: Timer;
  jitoTipAccount?: PublicKey;
  updateJitoTipInterval?: Timer;

  async cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    if (this.updateJitoTipInterval) {
      clearInterval(this.updateJitoTipInterval);
      this.updateJitoTipInterval = undefined;
    }
  }

  async init(
    tick:
      | "landed_tips_25th_percentile"
      | "landed_tips_50th_percentile"
      | "landed_tips_75th_percentile"
      | "landed_tips_95th_percentile"
      | "landed_tips_99th_percentile"
      | "ema_landed_tips_50th_percentile" = "ema_landed_tips_50th_percentile"
  ) {
    await this.cleanup();

    this.jitoTip = await getTip(tick);
    this.updateInterval = setInterval(async () => {
      this.jitoTip = await getTip(tick);
    }, 600000);
    this.updateJitoTipInterval = setInterval(async () => {
      this.jitoTipAccount = new PublicKey(
        await jitoClient.getRandomTipAccount()
      );
    }, 60000);
  }

  get value() {
    assert(this.jitoTip !== undefined, "server is not initialised");
    assert(this.jitoTipAccount !== undefined, "server is not initialised");
    return {
      jitoTip: this.jitoTip,
      jitoTipAccount: this.jitoTipAccount,
    };
  }
}

const poolReserve = new PoolReserve();
const jito = new Jito();
await jito.init();

const app = new Hono();
app.use(
  "/*",
  bearerAuth({ token: Buffer.from(process.env.HELIUS_RPC!).toString("base64") })
);

app.post("/pool/init", async (c) => {
  try {
    const { pool_id } = await c.req.json();
    console.log("initing pool...");
    await poolReserve.init(pool_id);
    return c.json({
      msg: "success",
      data: null,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.post("/jito/init", async (c) => {
  try {
    const { jito_tip_tick } = await c.req.json();
    console.log("initing jito tip...");
    await jito.init(jito_tip_tick);
    return c.json({
      msg: "success",
      data: null,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.get("/reserve", (c) => {
  try {
    return c.json({
      msg: "success",
      data: poolReserve.value,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.get("/pool-info", async (c) => {
  try {
    const { poolInfo, poolKeys } = poolReserve.value;
    return c.json({
      msg: "success",
      data: { poolInfo, poolKeys },
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.get("/jito-tip", (c) => {
  try {
    return c.json({
      msg: "success",
      data: jito.value.jitoTip,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.get("/jito-tip-account", (c) => {
  try {
    return c.json({
      msg: "success",
      data: jito.value.jitoTipAccount.toBase58(),
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

type Wallet = {
  id: number;
  address: string;
  mnemonic: string;
  created_at: string;
};

class WalletCache {
  private storage: Map<string, Wallet[]>;

  constructor() {
    this.storage = new Map();
  }

  getWallets(user: string) {
    let query = `
    SELECT id, address, mnemonic, created_at FROM wallet 
    WHERE closed_at IS NULL
    AND user = ?
    AND closed_at IS NULL
    ORDER BY created_at DESC
  `;

    const wallets = db.prepare(query).all(user) as Wallet[];

    this.storage.set(user, wallets);
    return wallets;
  }

  get(user: string) {
    const cached = this.storage.get(user);
    if (cached !== null) {
      return cached;
    } else {
      let query = `
    SELECT id, address, mnemonic, created_at FROM wallet 
    WHERE closed_at IS NULL
    AND user = ?
    AND closed_at IS NULL
    ORDER BY created_at DESC
  `;

      const wallets = db.prepare(query).all(user) as Wallet[];

      this.storage.set(user, wallets);
      return wallets;
    }
  }

  delete(key: string) {
    this.storage.delete(key);
  }
}

const walletCache = new WalletCache();

app.get("/wallets", (c) => {
  try {
    const { user } = c.req.query();
    const wallets = walletCache.getWallets(user);
    return c.json({
      msg: "success",
      data: wallets,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

app.get("/wallets/cache", async (c) => {
  try {
    const { user } = c.req.query();
    const wallets = walletCache.get(user);
    return c.json({
      msg: "success",
      data: wallets,
    });
  } catch (error) {
    return c.json({
      msg: error instanceof Error ? error.message : "Unknown error",
      data: null,
    });
  }
});

export default {
  port: 8333,
  fetch: app.fetch,
};
