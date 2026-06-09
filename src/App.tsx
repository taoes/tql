import { useState, useEffect, useCallback, useRef } from "react";
import { Modal, message, Splitter } from "antd";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import SidebarTitle from "./components/SidebarTitle";
import SidebarBody from "./components/SidebarBody";
import StatusBar from "./components/StatusBar";
import ContentBody from "./components/ContentBody";
import SystemSettings from "./components/SystemSettings";
import AboutModal from "./components/AboutModal";
import { getAppInfo, openDocsFolder } from "./db-api";
import type { DbContext } from "./components/AIChat";
import type { DataSourceConfig } from "./settings/types";
import { useTranslation } from "./i18n";

const SIDEBAR_DEFAULT_SIZE = "20%";
const SIDEBAR_COLLAPSED_SIZE = 0;

interface SqlToOpen {
  sql: string;
  datasourceName: string;
  databaseName: string;
}

interface DocToOpen {
  datasourceName: string;
  dbName: string;
  tableName: string;
  dataSourceConfig: DataSourceConfig;
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selectedDsName, setSelectedDsName] = useState<string | null>(null);
  const [dbChatToOpen, setDbChatToOpen] = useState<DbContext | null>(null);
  const [sqlToOpen, setSqlToOpen] = useState<SqlToOpen | null>(null);
  const [docToOpen, setDocToOpen] = useState<DocToOpen | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const t = useTranslation();

  // Sidebar collapse state
  const [sidebarSize, setSidebarSize] = useState<number | string>(
    SIDEBAR_DEFAULT_SIZE,
  );
  const sidebarSizeBeforeCollapse = useRef<number | string>(
    SIDEBAR_DEFAULT_SIZE,
  );
  const sidebarCollapsed = sidebarSize === SIDEBAR_COLLAPSED_SIZE;

  const toggleSidebar = useCallback(() => {
    setSidebarSize((prev) => {
      if (prev === SIDEBAR_COLLAPSED_SIZE) {
        // Restore previous size
        return sidebarSizeBeforeCollapse.current;
      }
      // Save current size and collapse
      sidebarSizeBeforeCollapse.current = prev;
      return SIDEBAR_COLLAPSED_SIZE;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + 1  → toggle sidebar
      if (isCmdOrCtrl && e.key === "1") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

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
    [messageApi, t, toggleSidebar]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Sync the browser title with the Rust backend version at startup.
  useEffect(() => {
    getAppInfo().then((info) => {
      document.title = `${info.name} v${info.version}`;
    }).catch(() => {});
  }, []);

  // Listen for "show-about" event from the tray menu (Rust → frontend).
  useEffect(() => {
    const unlisten = listen("show-about", () => {
      setAboutOpen(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <main className="app-root">
      {contextHolder}
      <Splitter
        style={{ height: "100%" }}
        orientation="horizontal"
        className="app-splitter"
        collapsible={{ motion: true }}
        onResize={(sizes) => {
          // sizes[0] is the sidebar panel size in px
          if (sizes[0] !== undefined) {
            setSidebarSize(sizes[0]);
            if (sizes[0] > 0) {
              sidebarSizeBeforeCollapse.current = sizes[0];
            }
          }
        }}
        onCollapse={(collapsed) => {
          // collapsed[0] means the sidebar panel is collapsed
          if (collapsed[0]) {
            setSidebarSize(SIDEBAR_COLLAPSED_SIZE);
          } else {
            setSidebarSize(sidebarSizeBeforeCollapse.current);
          }
        }}
      >
        <Splitter.Panel
          size={sidebarSize}
          min={sidebarCollapsed ? 0 : "200px"}
          max="20%"
          collapsible
        >
          <aside className="sidebar">
            <SidebarBody
              onSelectDs={setSelectedDsName}
              onNewQuery={(ctx) => setDbChatToOpen(ctx)}
              onOpenTableQuery={(params) => setSqlToOpen(params)}
              onEditTableDoc={(params) => setDocToOpen(params)}
            />
          </aside>
        </Splitter.Panel>

        <Splitter.Panel>
          <section className="content">
            <div className="content-header">
              <SidebarTitle />
              <StatusBar
                onSettingsClick={() => setSettingsOpen(true)}
                onOpenDocs={() =>
                  openDocsFolder(selectedDsName ?? undefined).catch((e) =>
                    messageApi.error(String(e)),
                  )
                }
              />
            </div>
            <ContentBody
              dbChatToOpen={dbChatToOpen}
              onDbChatOpened={() => setDbChatToOpen(null)}
              sqlToOpen={sqlToOpen}
              onSqlOpened={() => setSqlToOpen(null)}
              docToOpen={docToOpen}
              onDocOpened={() => setDocToOpen(null)}
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

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

