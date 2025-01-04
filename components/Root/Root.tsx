"use client";

import {
  initData,
  miniApp,
  useLaunchParams,
  useSignal,
} from "@telegram-apps/sdk-react";
import { type PropsWithChildren, useEffect } from "react";
// import { TonConnectUIProvider } from '@tonconnect/ui-react';
// import { AppRoot } from '@telegram-apps/telegram-ui';

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorPage } from "@/components/ErrorPage";
import { useClientOnce } from "@/hooks/useClientOnce";
import { useDidMount } from "@/hooks/useDidMount";
import { useTelegramMock } from "@/hooks/useTelegramMock";
import { init } from "@/lib/init";

import "./styles.css";

function RootInner({ children }: PropsWithChildren) {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    useTelegramMock();
  }

  const lp = useLaunchParams();
  const debug = isDev || lp.startParam === "debug";

  useClientOnce(() => {
    init(debug);
  });

  const isDark = useSignal(miniApp.isDark);
  const initDataUser = useSignal(initData.user);

  useEffect(() => {
    initDataUser;
  }, [initDataUser]);

  return <>{children}</>;
}

export function Root(props: PropsWithChildren) {
  const didMount = useDidMount();

  if (!didMount) {
    return null;
  }

  return (
    <ErrorBoundary fallback={(props) => <ErrorPage {...props} />}>
      <RootInner {...props} />
    </ErrorBoundary>
  );
}
