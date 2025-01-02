"use client";

import { initData, useSignal, type User } from "@telegram-apps/sdk-react";
import { ReactNode, useMemo } from "react";

export type DisplayDataRow = { title: string } & (
  | { type: "link"; value?: string }
  | { value: ReactNode }
);

function getUserRows(user: User): DisplayDataRow[] {
  return [
    { title: "id", value: user.id.toString() },
    { title: "username", value: user.username },
    { title: "photo_url", value: user.photoUrl },
    { title: "last_name", value: user.lastName },
    { title: "first_name", value: user.firstName },
    { title: "is_bot", value: user.isBot },
    { title: "is_premium", value: user.isPremium },
    { title: "language_code", value: user.languageCode },
    { title: "allows_to_write_to_pm", value: user.allowsWriteToPm },
    { title: "added_to_attachment_menu", value: user.addedToAttachmentMenu },
  ];
}

export default function Home() {
  const initDataRaw = useSignal(initData.raw);
  const initDataState = useSignal(initData.state);

  const initDataRows = useMemo<DisplayDataRow[] | undefined>(() => {
    if (!initDataState || !initDataRaw) {
      return;
    }
    const {
      authDate,
      hash,
      queryId,
      chatType,
      chatInstance,
      canSendAfter,
      startParam,
    } = initDataState;
    return [
      { title: "raw", value: initDataRaw },
      { title: "auth_date", value: authDate.toLocaleString() },
      { title: "auth_date (raw)", value: authDate.getTime() / 1000 },
      { title: "hash", value: hash },
      {
        title: "can_send_after",
        value: initData.canSendAfterDate()?.toISOString(),
      },
      { title: "can_send_after (raw)", value: canSendAfter },
      { title: "query_id", value: queryId },
      { title: "start_param", value: startParam },
      { title: "chat_type", value: chatType },
      { title: "chat_instance", value: chatInstance },
    ];
  }, [initDataState, initDataRaw]);

  const userRows = useMemo<DisplayDataRow[] | undefined>(() => {
    return initDataState && initDataState.user
      ? getUserRows(initDataState.user)
      : undefined;
  }, [initDataState]);

  const receiverRows = useMemo<DisplayDataRow[] | undefined>(() => {
    return initDataState && initDataState.receiver
      ? getUserRows(initDataState.receiver)
      : undefined;
  }, [initDataState]);

  const chatRows = useMemo<DisplayDataRow[] | undefined>(() => {
    if (!initDataState?.chat) {
      return;
    }
    const { id, title, type, username, photoUrl } = initDataState.chat;

    return [
      { title: "id", value: id.toString() },
      { title: "title", value: title },
      { title: "type", value: type },
      { title: "username", value: username },
      { title: "photo_url", value: photoUrl },
    ];
  }, [initData]);

  if (!initDataRows) {
    return (
      <>
        <h1>Oops</h1>
        <div>Application was launched with missing init data</div>
        <img
          alt="Telegram sticker"
          src="https://xelene.me/telegram.gif"
          style={{ display: "block", width: "144px", height: "144px" }}
        />
      </>
    );
  }
  return (
    <div>
      <div>
        <h2>Init Data</h2>
        {initDataRows.map((row, i) => (
          <div key={i}>
            {row.title}: {row.value?.toString()}
          </div>
        ))}
      </div>

      {userRows && (
        <div>
          <h2>User</h2>
          {userRows.map((row, i) => (
            <div key={i}>
              {row.title}: {row.value?.toString()}
            </div>
          ))}
        </div>
      )}

      {receiverRows && (
        <div>
          <h2>Receiver</h2>
          {receiverRows.map((row, i) => (
            <div key={i}>
              {row.title}: {row.value?.toString()}
            </div>
          ))}
        </div>
      )}

      {chatRows && (
        <div>
          <h2>Chat</h2>
          {chatRows.map((row, i) => (
            <div key={i}>
              {row.title}: {row.value?.toString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
