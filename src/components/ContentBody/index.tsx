import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "antd";
import { MessageOutlined, TableOutlined } from "@ant-design/icons";
import AIChat from "../AIChat";
import SqlResultTab from "../SqlResultTab";
import { useTranslation } from "../../i18n";
import "./index.css";

const AI_TAB_KEY = "__ai_chat__";

interface SqlTab {
  key: string;
  index: number;
  sql: string;
}

interface DbChatTab {
  key: string;
  dbName: string;
}

interface ContentBodyProps {
  dbChatToOpen?: string | null;
  onDbChatOpened?: () => void;
  selectedDsName?: string | null;
}

function ContentBody({ dbChatToOpen, onDbChatOpened, selectedDsName }: ContentBodyProps) {
  const t = useTranslation();
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>([]);
  const [dbChats, setDbChats] = useState<DbChatTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>(AI_TAB_KEY);
  const seqRef = useRef(0);

  // ── Open a new database-specific AI chat tab ─────────────────
  useEffect(() => {
    if (!dbChatToOpen) return;

    const key = `__ai_db__${dbChatToOpen}`;
    setDbChats((prev) => {
      if (prev.find((d) => d.key === key)) return prev;
      return [...prev, { key, dbName: dbChatToOpen }];
    });
    setActiveKey(key);
    onDbChatOpened?.();
  }, [dbChatToOpen, onDbChatOpened]);

  const handleRunSql = useCallback((sql: string) => {
    seqRef.current += 1;
    const next: SqlTab = {
      key: `sql-${seqRef.current}`,
      index: seqRef.current,
      sql,
    };
    setSqlTabs((prev) => [...prev, next]);
    setActiveKey(next.key);
  }, []);

  const closeTab = useCallback(
    (targetKey: string) => {
      if (targetKey === AI_TAB_KEY) return;
      setSqlTabs((prev) => {
        const idx = prev.findIndex((it) => it.key === targetKey);
        if (idx === -1) return prev;
        const next = prev.filter((it) => it.key !== targetKey);
        setActiveKey((curr) => {
          if (curr !== targetKey) return curr;
          if (next.length === 0) return AI_TAB_KEY;
          const fallback = next[Math.min(idx, next.length - 1)];
          return fallback.key;
        });
        return next;
      });
      setDbChats((prev) => {
        const idx = prev.findIndex((it) => it.key === targetKey);
        if (idx === -1) return prev;
        const next = prev.filter((it) => it.key !== targetKey);
        setActiveKey((curr) => {
          if (curr !== targetKey) return curr;
          if (next.length === 0) return AI_TAB_KEY;
          const fallback = next[Math.min(idx, next.length - 1)];
          return fallback.key;
        });
        return next;
      });
    },
    [],
  );

  const handleEdit = useCallback(
    (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: "add" | "remove") => {
      if (action === "remove" && typeof targetKey === "string") {
        closeTab(targetKey);
      }
    },
    [closeTab],
  );

  const items = useMemo(
    () => [
      {
        key: AI_TAB_KEY,
        label: (
          <span className="workspace-tab-label">
            <MessageOutlined /> TQL 查询助手
          </span>
        ),
        closable: false,
        children: <AIChat onRunSql={handleRunSql} selectedDsName={selectedDsName} />,
      },
      ...dbChats.map((d) => ({
        key: d.key,
        label: (
          <span className="workspace-tab-label">
            <MessageOutlined /> {d.dbName}
          </span>
        ),
        closable: true,
        children: (
          <AIChat
            onRunSql={handleRunSql}
            selectedDsName={selectedDsName}
            databaseName={d.dbName}
          />
        ),
      })),
      ...sqlTabs.map((it) => ({
        key: it.key,
        label: (
          <span className="workspace-tab-label">
            <TableOutlined /> {t("workspace.sqlTab", { n: it.index })}
          </span>
        ),
        closable: true,
        children: <SqlResultTab sql={it.sql} />,
      })),
    ],
    [sqlTabs, dbChats, t, handleRunSql, selectedDsName],
  );

  return (
    <div className="content-body">
      <Tabs
        type="editable-card"
        hideAdd
        activeKey={activeKey}
        onChange={setActiveKey}
        onEdit={handleEdit}
        items={items}
        className="workspace-tabs"
      />
    </div>
  );
}

export default ContentBody;
