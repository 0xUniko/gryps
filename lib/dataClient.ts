import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const packageDefinition = protoLoader.loadSync("data.proto", {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const dataServer = grpc.loadPackageDefinition(packageDefinition);

const client = new dataServer.DataService(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

export async function init(
  pool_id: string,
  jito_tip_tick:
    | "landed_tips_25th_percentile"
    | "landed_tips_50th_percentile"
    | "landed_tips_75th_percentile"
    | "landed_tips_95th_percentile"
    | "landed_tips_99th_percentile"
    | "ema_landed_tips_50th_percentile" = "ema_landed_tips_50th_percentile"
) {
  return new Promise<{ msg: string }>((resolve, reject) => {
    client.Init(
      { pool_id, jito_tip_tick },
      (err: grpc.ServiceError | null, response: { msg: string }) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
}

type ReserveRes = {
  base_reserve: string;
  quote_reserve: string;
  status: string;
};

export const getReserve = async () => {
  return new Promise<ReserveRes>((resolve, reject) => {
    client.GetReserve(
      {},
      (err: grpc.ServiceError | null, response: ReserveRes) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
};

export const getJitoTip = async () => {
  return new Promise<{ tip: number }>((resolve, reject) => {
    client.GetJitoTip(
      { tick: "ema_landed_tips_50th_percentile" },
      (err: grpc.ServiceError | null, response: { tip: number }) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
};

// await init("4ZRWV4zp9C5BxSgUVMAj4fqpJ2h1azL4yBWASjisoEbL");
// console.log(await getJitoTip());
// console.log(await getReserve());
