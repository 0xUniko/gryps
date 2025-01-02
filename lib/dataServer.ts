import { Raydium, liquidityStateV4Layout } from "@raydium-io/raydium-sdk-v2";
import { AccountLayout } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import assert from "assert";
import BN from "bn.js";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { getTip } from "./jito";

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

    const { poolRpcData } = await raydium.liquidity.getPoolInfoFromRpc({
      poolId,
    });
    this.baseReserve = poolRpcData.baseReserve;
    this.quoteReserve = poolRpcData.quoteReserve;
    this.lpInfo = poolRpcData;

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

class JitoTip {
  jitoTip?: number;
  private updateInterval?: Timer;

  async cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
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
  }

  get value() {
    assert(this.jitoTip !== undefined, "server is not initialised");
    return this.jitoTip;
  }
}

const poolReserve = new PoolReserve();
const jitoTip = new JitoTip();
await jitoTip.init();

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
    await jitoTip.init(jito_tip_tick);
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

app.get("/jito-tip", (c) => {
  try {
    return c.json({
      msg: "success",
      data: jitoTip.value,
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
