import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { Raydium, liquidityStateV4Layout } from "@raydium-io/raydium-sdk-v2";
import { AccountLayout } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import assert from "assert";
import BN from "bn.js";
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

  async init(poolId: string) {
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

    connection.onAccountChange(
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

const poolReserve = new PoolReserve();

class JitoTip {
  jitoTip?: number;
  async init(
    tick:
      | "landed_tips_25th_percentile"
      | "landed_tips_50th_percentile"
      | "landed_tips_75th_percentile"
      | "landed_tips_95th_percentile"
      | "landed_tips_99th_percentile"
      | "ema_landed_tips_50th_percentile" = "ema_landed_tips_50th_percentile"
  ) {
    this.jitoTip = await getTip(tick);
    setInterval(async () => {
      this.jitoTip = await getTip(tick);
    }, 600000);
  }

  get value() {
    assert(this.jitoTip !== undefined, "server is not initialised");
    return this.jitoTip;
  }
}

const jitoTip = new JitoTip();

const getRpcPoolInfoDefinition = protoLoader.loadSync("data.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const dataServer = grpc.loadPackageDefinition(getRpcPoolInfoDefinition);

const server = new grpc.Server();

server.addService(dataServer.DataService.service, {
  Init: async (call, callback) => {
    console.log("initing...");
    await poolReserve.init(call.request.pool_id);
    await jitoTip.init(call.request.jito_tip_tick);
    callback(null, { msg: "success" });
  },
  GetReserve: (call, callback) => {
    const { base_reserve, quote_reserve, status } = poolReserve.value;
    callback(null, {
      base_reserve,
      quote_reserve,
      status,
    });
  },
  GetJitoTip: (call, callback) => {
    callback(null, {
      tip: jitoTip.value,
    });
  },
});

server.bindAsync(
  "localhost:50051",
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err != null) {
      console.error("Failed to bind server:", err);
    }
    console.log("Server listening on port:", port);
  }
);
