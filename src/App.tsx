import { useState, useEffect, useCallback } from "react";
import { Modal, message, Splitter } from "antd";
import "./App.css";
import SidebarTitle from "./components/SidebarTitle";
import SidebarBody from "./components/SidebarBody";
import StatusBar from "./components/StatusBar";
import ContentBody from "./components/ContentBody";
import SystemSettings from "./components/SystemSettings";
import { openDocsFolder } from "./db-api";
import type { DbContext } from "./components/AIChat";
import { useTranslation } from "./i18n";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDsName, setSelectedDsName] = useState<string | null>(null);
  const [dbChatToOpen, setDbChatToOpen] = useState<DbContext | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const t = useTranslation();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + ,  → toggle settings panel
      if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }

      // Cmd/Ctrl + R  → refresh data
      if (isCmdOrCtrl && e.key === "r") {
        e.preventDefault();
        messageApi.info(t("app.refreshed"));
      }
    },
    [messageApi, t]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="app-root">
      {contextHolder}
      <Splitter
        style={{ height: "100%" }}
        layout="horizontal"
        className="app-splitter"
        collapsible={{ motion: true }}
      >
        <Splitter.Panel defaultSize="15%" min="200px" max="20%" collapsible>
          <aside className="sidebar">
            <SidebarTitle />
            <SidebarBody
              onSelectDs={setSelectedDsName}
              onNewQuery={(ctx) => setDbChatToOpen(ctx)}
            />
          </aside>
        </Splitter.Panel>

        <Splitter.Panel>
          <section className="content">
            <StatusBar
              onSettingsClick={() => setSettingsOpen(true)}
              onOpenDocs={() =>
                openDocsFolder(selectedDsName ?? undefined).catch((e) =>
                  messageApi.error(String(e)),
                )
              }
            />
            <ContentBody
              dbChatToOpen={dbChatToOpen}
              onDbChatOpened={() => setDbChatToOpen(null)}
            />
          </section>
        </Splitter.Panel>
      </Splitter>

      <Modal
        title={t("settings.modalTitle")}
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        footer={null}
        width={860}
        style={{ top: 32 }}
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
      >
        <SystemSettings />
      </Modal>
    </main>
  );
}

