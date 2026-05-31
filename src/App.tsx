import { useState } from "react";
import { Modal } from "antd";
import "./App.css";
import SidebarTitle from "./components/SidebarTitle";
import SidebarBody from "./components/SidebarBody";
import StatusBar from "./components/StatusBar";
import ContentBody from "./components/ContentBody";
import SystemSettings from "./components/SystemSettings";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main className="app-root">
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
