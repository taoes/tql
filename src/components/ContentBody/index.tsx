import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Empty } from "antd";
import { MessageOutlined, TableOutlined, CodeOutlined } from "@ant-design/icons";
import AIChat from "../AIChat";
import type { DbContext } from "../AIChat";
import SqlResultTab from "../SqlResultTab";
import { useTranslation } from "../../i18n";
import "./index.css";

// ── Tab types ──────────────────────────────────────────────────

interface SqlTab {
  key: string;
  index: number;
  sql: string;
}

interface DbChatTab {
  key: string;
  context: DbContext;
}

// ── Component ──────────────────────────────────────────────────

interface ContentBodyProps {
  /** Trigger: when set, opens a new AI tab for this database context */
  dbChatToOpen?: DbContext | null;
  onDbChatOpened?: () => void;
}

function ContentBody({ dbChatToOpen, onDbChatOpened }: ContentBodyProps) {
  const t = useTranslation();
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>([]);
  const [dbChats, setDbChats] = useState<DbChatTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const seqRef = useRef(0);
  const chatSeqRef = useRef(0);

  // ── Open a new database-specific AI chat tab ─────────────────
  useEffect(() => {
    if (!dbChatToOpen) return;

    chatSeqRef.current += 1;
    const key = `ai_db_${dbChatToOpen.databaseName}_${chatSeqRef.current}`;

    setDbChats((prev) => {
      // Deduplicate: if same datasource+db already open, just switch to it
      const existing = prev.find(
        (d) =>
          d.context.datasourceName === dbChatToOpen.datasourceName &&
          d.context.databaseName === dbChatToOpen.databaseName,
      );
      if (existing) {
        setActiveKey(existing.key);
        return prev;
      }
      return [...prev, { key, context: dbChatToOpen }];
    });
    if (!dbChats.find(
      (d) =>
        d.context.datasourceName === dbChatToOpen.datasourceName &&
        d.context.databaseName === dbChatToOpen.databaseName,
    )) {
      setActiveKey(key);
    }
    onDbChatOpened?.();
  }, [dbChatToOpen, onDbChatOpened]);

  // ── Run SQL → new result tab ─────────────────────────────────
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

  // ── Close tab logic ──────────────────────────────────────────
  const closeTab = useCallback((targetKey: string) => {
    const removeAndSettle = <T extends { key: string }>(
      list: T[],
      setter: (next: T[]) => void,
    ) => {
      const idx = list.findIndex((it) => it.key === targetKey);
      if (idx === -1) return false;
      const next = list.filter((it) => it.key !== targetKey);
      setter(next);
      setActiveKey((curr) => {
        if (curr !== targetKey) return curr;
        if (next.length > 0) return next[Math.min(idx, next.length - 1)].key;
        // Also check other tab lists
        const allKeys = [...dbChats, ...sqlTabs].filter((t) => t.key !== targetKey).map((t) => t.key);
        return allKeys[0] ?? "";
      });
      return true;
    };

    if (removeAndSettle(sqlTabs, setSqlTabs)) return;
    removeAndSettle(dbChats, setDbChats);
  }, [sqlTabs, dbChats]);

  const handleEdit = useCallback(
    (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: "add" | "remove") => {
      if (action === "remove" && typeof targetKey === "string") closeTab(targetKey);
    },
    [closeTab],
  );

  // ── Tab items ────────────────────────────────────────────────
  const items = useMemo(
    () => [
      ...dbChats.map((d) => ({
        key: d.key,
        label: (
          <span className="workspace-tab-label">
            <MessageOutlined /> {d.context.databaseName}
          </span>
        ),
        closable: true,
        children: <AIChat key={d.key} onRunSql={handleRunSql} databaseContext={d.context} />,
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
    [sqlTabs, dbChats, t, handleRunSql],
  );

  const hasTabs = items.length > 0;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="content-body">
      {hasTabs ? (
        <Tabs
          type="editable-card"
          hideAdd
          destroyInactiveTabPane={false}
          activeKey={activeKey}
          onChange={setActiveKey}
          onEdit={handleEdit}
          items={items}
          className="workspace-tabs"
        />
      ) : (
        <div className="content-body-empty">
          <Empty
            image={<CodeOutlined style={{ fontSize: 64, color: "#bbb" }} />}
            description={
              <span style={{ color: "#999" }}>
                在左侧选择一个数据源和数据库
                <br />
                右键选择「新建查询」开始对话
              </span>
            }
          />
        </div>
      )}
    </div>
  );
}

export default ContentBody;
