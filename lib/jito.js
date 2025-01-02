import { LAMPORTS_PER_SOL } from "@solana/web3.js";
const axios = require("axios");

/**
 * @typedef {Object} JsonRpcRequest
 * @property {string} jsonrpc
 * @property {number} id
 * @property {string} method
 * @property {any[]} params
 */

export class JitoJsonRpcClient {
  constructor(baseUrl, uuid) {
    this.baseUrl = baseUrl;
    this.uuid = uuid;
    this.client = axios.create({
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async sendRequest(endpoint, method, params) {
    const url = `${this.baseUrl}${endpoint}`;

    const data = {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: params || [],
    };

    // console.log(`Sending request to: ${url}`);
    // console.log(`Request body: ${JSON.stringify(data, null, 2)}`);

    try {
      const response = await this.client.post(url, data);
      // console.log(`Response status: ${response.status}`);
      // console.log(`Response body: ${JSON.stringify(response.data, null, 2)}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`HTTP error: ${error.message}`);
        throw error;
      } else {
        console.error(`Unexpected error: ${error}`);
        throw new Error("An unexpected error occurred");
      }
    }
  }

  async getTipAccounts() {
    const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : "/bundles";
    return this.sendRequest(endpoint, "getTipAccounts");
  }

  async getRandomTipAccount() {
    const tipAccountsResponse = await this.getTipAccounts();
    if (
      tipAccountsResponse.result &&
      Array.isArray(tipAccountsResponse.result) &&
      tipAccountsResponse.result.length > 0
    ) {
      const randomIndex = Math.floor(
        Math.random() * tipAccountsResponse.result.length
      );
      return tipAccountsResponse.result[randomIndex];
    } else {
      throw new Error("No tip accounts available");
    }
  }

  async sendBundle(params) {
    const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : "/bundles";
    return this.sendRequest(endpoint, "sendBundle", params);
  }

  async sendTxn(params, bundleOnly = false) {
    let endpoint = "/transactions";
    const queryParams = [];

    if (bundleOnly) {
      queryParams.push("bundleOnly=true");
    }

    if (this.uuid) {
      queryParams.push(`uuid=${this.uuid}`);
    }

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join("&")}`;
    }

    return this.sendRequest(endpoint, "sendTransaction", params);
  }

  async getInFlightBundleStatuses(params) {
    const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : "/bundles";
    return this.sendRequest(endpoint, "getInflightBundleStatuses", params);
  }

  async getBundleStatuses(params) {
    const endpoint = this.uuid ? `/bundles?uuid=${this.uuid}` : "/bundles";
    return this.sendRequest(endpoint, "getBundleStatuses", params);
  }

  async confirmInflightBundle(bundleId, timeoutMs = 60000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const response = await this.getInFlightBundleStatuses([[bundleId]]);

        if (
          response.result &&
          response.result.value &&
          response.result.value.length > 0
        ) {
          const bundleStatus = response.result.value[0];

          // console.log(
          //   `Bundle status: ${bundleStatus.status}, Landed slot: ${bundleStatus.landed_slot}`
          // );

          if (bundleStatus.status === "Failed") {
            return bundleStatus;
          } else if (bundleStatus.status === "Landed") {
            // If the bundle has landed, get more detailed status
            const detailedStatus = await this.getBundleStatuses([[bundleId]]);
            if (
              detailedStatus.result &&
              detailedStatus.result.value &&
              detailedStatus.result.value.length > 0
            ) {
              return detailedStatus.result.value[0];
            } else {
              console.log("No detailed status returned for landed bundle.");
              return bundleStatus;
            }
          }
        } else {
          console.log(
            "No status returned for the bundle. It may be invalid or very old."
          );
        }
      } catch (error) {
        console.error("Error checking bundle status:", error);
      }

      // Wait for a short time before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // If we've reached this point, the bundle hasn't reached a final state within the timeout
    console.log(
      `Bundle ${bundleId} has not reached a final state within ${timeoutMs}ms`
    );
    return { status: "Timeout" };
  }
}

// module.exports = { JitoJsonRpcClient };

export const jitoClient = new JitoJsonRpcClient(
  "https://mainnet.block-engine.jito.wtf/api/v1",
  ""
);

export async function sendBundle(transactions) {
  try {
    // Send the bundle using sendBundle method
    const result = await jitoClient.sendBundle([
      transactions,
      // {
      //   encoding: "base64",
      // },
    ]);
    console.log("Bundle send result:", result, `time: ${Date.now() / 1000}`);

    const bundleId = result.result;
    console.log("Bundle ID:", bundleId, `time: ${Date.now() / 1000}`);

    // Wait for confirmation with a longer timeout
    const inflightStatus = await jitoClient.confirmInflightBundle(
      bundleId,
      120000
    ); // 120 seconds timeout
    console.log(
      "Inflight bundle status:",
      JSON.stringify(inflightStatus, null, 2),
      `time: ${Date.now() / 1000}`
    );

    if (inflightStatus.confirmation_status === "confirmed") {
      return bundleId;
      // console.log(
      //   `Bundle successfully confirmed on-chain at slot ${inflightStatus.slot}`,
      //   `time: ${Date.now() / 1000}`
      // );
      // Additional check for bundle finalization
      // try {
      //   console.log(
      //     "Attempting to get bundle status...",
      //     `time: ${Date.now() / 1000}`
      //   );
      //   const finalStatus = await jitoClient.getBundleStatuses([[bundleId]]); // Note the double array
      //   console.log(
      //     "Final bundle status response:",
      //     JSON.stringify(finalStatus, null, 2),
      //     `time: ${Date.now() / 1000}`
      //   );
      //   if (
      //     finalStatus.result &&
      //     finalStatus.result.value &&
      //     finalStatus.result.value.length > 0
      //   ) {
      //     const status = finalStatus.result.value[0];
      //     console.log(
      //       "Confirmation status:",
      //       status.confirmation_status,
      //       `time: ${Date.now() / 1000}`
      //     );
      // const explorerUrl = `https://explorer.jito.wtf/bundle/${bundleId}`;
      // console.log(
      //   "Bundle Explorer URL:",
      //   explorerUrl,
      //   `time: ${Date.now() / 1000}`
      // );
      //     console.log(
      //       "Final bundle details:",
      //       status,
      //       `time: ${Date.now() / 1000}`
      //     );
      //     // Updated section to handle and display multiple transactions
      //     if (status.transactions && status.transactions.length > 0) {
      //       console.log(
      //         `Transaction URLs (${status.transactions.length} transaction${
      //           status.transactions.length > 1 ? "s" : ""
      //         } in this bundle):`,
      //         `time: ${Date.now() / 1000}`
      //       );
      //       status.transactions.forEach((txId, index) => {
      //         const txUrl = `https://solscan.io/tx/${txId}`;
      //         console.log(
      //           `Transaction ${index + 1}: ${txUrl}`,
      //           `time: ${Date.now() / 1000}`
      //         );
      //       });
      //       if (status.transactions.length === 5) {
      //         console.log(
      //           "Note: This bundle has reached the maximum of 5 transactions.",
      //           `time: ${Date.now() / 1000}`
      //         );
      //       }
      //     } else {
      //       console.log(
      //         "No transactions found in the bundle status.",
      //         `time: ${Date.now() / 1000}`
      //       );
      //     }
      //   } else {
      //     console.log(
      //       "Unexpected final bundle status response structure",
      //       `time: ${Date.now() / 1000}`
      //     );
      //   }
      // } catch (statusError) {
      //   console.error(
      //     "Error fetching final bundle status:",
      //     statusError.message,
      //     `time: ${Date.now() / 1000}`
      //   );
      //   if (statusError.response && statusError.response.data) {
      //     console.error(
      //       "Server response:",
      //       statusError.response.data,
      //       `time: ${Date.now() / 1000}`
      //     );
      //   }
      // }
    } else if (inflightStatus.err) {
      console.log(
        "Bundle processing failed:",
        inflightStatus.err,
        `time: ${Date.now() / 1000}`
      );
    } else {
      console.log(
        "Unexpected inflight bundle status:",
        inflightStatus,
        `time: ${Date.now() / 1000}`
      );
    }
  } catch (error) {
    console.error(
      "Error sending or confirming bundle:",
      error,
      `time: ${Date.now() / 1000}`
    );
    if (error.response && error.response.data) {
      console.error(
        "Server response:",
        error.response.data,
        `time: ${Date.now() / 1000}`
      );
    }
  }
}

export async function getTip(tick = "ema_landed_tips_50th_percentile") {
  const res = await fetch("https://bundles.jito.wtf/api/v1/bundles/tip_floor");
  const data = await res.json();
  return Math.ceil(data[0][tick] * LAMPORTS_PER_SOL);
}
