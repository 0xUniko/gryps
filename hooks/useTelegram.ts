import { initData } from "@telegram-apps/sdk-react";

export function useTelegram() {
  return {
    user: initData?.user,
  };
}
