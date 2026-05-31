import { useState, useEffect, useCallback } from "react";
import { Modal, message } from "antd";
import "./App.css";
import SidebarTitle from "./components/SidebarTitle";
import SidebarBody from "./components/SidebarBody";
import StatusBar from "./components/StatusBar";
import ContentBody from "./components/ContentBody";
import SystemSettings from "./components/SystemSettings";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + ,  →  切换设置面板
      if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((v) => !v);
        return;
      }

      // Cmd/Ctrl + R  →  刷新数据
      if (isCmdOrCtrl && e.key === "r") {
        e.preventDefault();
        messageApi.info("数据已刷新");
      }
    },
    [messageApi]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="app-root">
      {contextHolder}
      <aside className="sidebar">
        <SidebarTitle />
        <SidebarBody />
      </aside>

      <section className="content">
        <StatusBar onSettingsClick={() => setSettingsOpen(true)} />
        <ContentBody />
      </section>

      <Modal
        title="系统设置"
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

export default App;
