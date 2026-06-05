import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Empty } from "antd";
import { MessageOutlined, TableOutlined, CodeOutlined, FileTextOutlined } from "@ant-design/icons";
import AIChat from "../AIChat";
import type { DbContext, SqlExecutionContext } from "../AIChat";
import SqlResultTab from "../SqlResultTab";
import DocEditorTab from "../DocEditorTab";
import { useTranslation } from "../../i18n";
import { useSettings } from "../../settings/SettingsContext";
import type { DataSourceConfig } from "../../settings/types";
import "./index.css";

// ── Tab types ──────────────────────────────────────────────────

interface SqlTab {
  key: string;
  index: number;
  sql: string;
  dataSourceConfig: DataSourceConfig;
  databaseName: string;
}

interface DbChatTab {
  key: string;
  context: DbContext;
}

interface DocTab {
  key: string;
  datasourceName: string;
  dbName: string;
  tableName: string;
  dataSourceConfig: DataSourceConfig;
}

// ── Component ──────────────────────────────────────────────────

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

interface ContentBodyProps {
  /** Trigger: when set, opens a new AI tab for this database context */
  dbChatToOpen?: DbContext | null;
  onDbChatOpened?: () => void;
  /** Trigger: when set, opens a new SQL result tab */
  sqlToOpen?: SqlToOpen | null;
  onSqlOpened?: () => void;
  /** Trigger: when set, opens a new doc editor tab */
  docToOpen?: DocToOpen | null;
  onDocOpened?: () => void;
}

function ContentBody({
  dbChatToOpen,
  onDbChatOpened,
  sqlToOpen,
  onSqlOpened,
  docToOpen,
  onDocOpened,
}: ContentBodyProps) {
  const t = useTranslation();
  const { settings } = useSettings();
  const [sqlTabs, setSqlTabs] = useState<SqlTab[]>([]);
  const [dbChats, setDbChats] = useState<DbChatTab[]>([]);
  const [docTabs, setDocTabs] = useState<DocTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const seqRef = useRef(0);
  const chatSeqRef = useRef(0);
  const docSeqRef = useRef(0);

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

  // ── Open a new SQL result tab from sidebar double-click ───────
  useEffect(() => {
    if (!sqlToOpen || !settings) return;

    // Resolve DataSourceConfig by matching the datasource name
    const ds = settings.datasource.connections.find(
      (c) => c.name === sqlToOpen.datasourceName,
    );
    if (!ds) return;

    seqRef.current += 1;
    const next: SqlTab = {
      key: `sql-${seqRef.current}`,
      index: seqRef.current,
      sql: sqlToOpen.sql,
      dataSourceConfig: ds,
      databaseName: sqlToOpen.databaseName,
    };
    setSqlTabs((prev) => [...prev, next]);
    setActiveKey(next.key);
    onSqlOpened?.();
  }, [sqlToOpen, settings, onSqlOpened]);

  // ── Open a new doc editor tab ───────────────────────────────
  useEffect(() => {
    if (!docToOpen) return;

    docSeqRef.current += 1;
    const key = `doc_${docToOpen.tableName}_${docSeqRef.current}`;

    setDocTabs((prev) => {
      // Deduplicate: if same table doc already open, just switch to it
      const existing = prev.find(
        (d) =>
          d.datasourceName === docToOpen.datasourceName &&
          d.dbName === docToOpen.dbName &&
          d.tableName === docToOpen.tableName,
      );
      if (existing) {
        setActiveKey(existing.key);
        return prev;
      }
      return [
        ...prev,
        {
          key,
          datasourceName: docToOpen.datasourceName,
          dbName: docToOpen.dbName,
          tableName: docToOpen.tableName,
          dataSourceConfig: docToOpen.dataSourceConfig,
        },
      ];
    });
    if (
      !docTabs.find(
        (d) =>
          d.datasourceName === docToOpen.datasourceName &&
          d.dbName === docToOpen.dbName &&
          d.tableName === docToOpen.tableName,
      )
    ) {
      setActiveKey(key);
    }
    onDocOpened?.();
  }, [docToOpen, onDocOpened]);

  // ── Run SQL → new result tab ─────────────────────────────────
  const handleRunSql = useCallback(
    (sql: string, context?: SqlExecutionContext) => {
      if (!context || !settings) return;

      // Resolve DataSourceConfig by matching the datasource name
      const ds = settings.datasource.connections.find(
        (c) => c.name === context.datasourceName,
      );
      if (!ds) return;

      seqRef.current += 1;
      const next: SqlTab = {
        key: `sql-${seqRef.current}`,
        index: seqRef.current,
        sql,
        dataSourceConfig: ds,
        databaseName: context.databaseName,
      };
      setSqlTabs((prev) => [...prev, next]);
      setActiveKey(next.key);
    },
    [settings],
  );

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
        const allKeys = [...dbChats, ...sqlTabs, ...docTabs].filter((t) => t.key !== targetKey).map((t) => t.key);
        return allKeys[0] ?? "";
      });
      return true;
    };

    if (removeAndSettle(sqlTabs, setSqlTabs)) return;
    if (removeAndSettle(dbChats, setDbChats)) return;
    removeAndSettle(docTabs, setDocTabs);
  }, [sqlTabs, dbChats, docTabs]);

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
        children: (
          <SqlResultTab
            sql={it.sql}
            dataSourceConfig={it.dataSourceConfig}
            databaseName={it.databaseName}
          />
        ),
      })),
      ...docTabs.map((d) => ({
        key: d.key,
        label: (
          <span className="workspace-tab-label">
            <FileTextOutlined /> {d.tableName}
          </span>
        ),
        closable: true,
        children: (
          <DocEditorTab
            datasourceName={d.datasourceName}
            dbName={d.dbName}
            tableName={d.tableName}
            dataSourceConfig={d.dataSourceConfig}
          />
        ),
      })),
    ],
    [sqlTabs, dbChats, docTabs, t, handleRunSql],
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
