import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, Result, Menu } from "antd";
import { createPortal } from "react-dom";
import type { MenuProps } from "antd";
import type { DragEndEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, PointerSensor, useSensor } from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MessageOutlined,
  TableOutlined,
  CodeOutlined,
  FileTextOutlined,
  ClearOutlined,
  CloseOutlined,
  ColumnWidthOutlined,
  VerticalRightOutlined,
} from "@ant-design/icons";
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

interface TabCtxMenu {
  x: number;
  y: number;
  key: string;
}

// ── Draggable Tab Node ────────────────────────────────────────

interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  "data-node-key": string;
}

const DraggableTabNode: React.FC<Readonly<DraggableTabPaneProps>> = ({
  className,
  style,
  ...props
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: props["data-node-key"] });

  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: "move",
  };

  if (!props.children || !React.isValidElement(props.children)) {
    return (
      <div ref={setNodeRef} style={mergedStyle} {...attributes} {...listeners}>
        {props.children}
      </div>
    );
  }

  return React.cloneElement(props.children as React.ReactElement<any>, {
    ref: setNodeRef,
    style: mergedStyle,
    ...attributes,
    ...listeners,
  });
};

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
  dbChatToOpen?: DbContext | null;
  onDbChatOpened?: () => void;
  sqlToOpen?: SqlToOpen | null;
  onSqlOpened?: () => void;
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

  // Tab context menu
  const [tabCtxMenu, setTabCtxMenu] = useState<TabCtxMenu | null>(null);

  // @dnd-kit sensor
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  // ── Open a new database-specific AI chat tab ─────────────────
  useEffect(() => {
    if (!dbChatToOpen) return;
    chatSeqRef.current += 1;
    const key = `ai_db_${dbChatToOpen.databaseName}_${chatSeqRef.current}`;
    setDbChats((prev) => {
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
    if (
      !dbChats.find(
        (d) =>
          d.context.datasourceName === dbChatToOpen.datasourceName &&
          d.context.databaseName === dbChatToOpen.databaseName,
      )
    ) {
      setActiveKey(key);
    }
    onDbChatOpened?.();
  }, [dbChatToOpen, onDbChatOpened]);

  // ── Open a new SQL result tab ───────────────────────────────
  useEffect(() => {
    if (!sqlToOpen || !settings) return;
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

  // ── Build ordered key list of all tabs ───────────────────────
  const orderedKeys = useMemo(() => {
    return [
      ...dbChats.map((d) => d.key),
      ...sqlTabs.map((s) => s.key),
      ...docTabs.map((d) => d.key),
    ];
  }, [dbChats, sqlTabs, docTabs]);

  /** Given a key, return which group it belongs to and its index in the merged order. */
  const locateTab = useCallback(
    (key: string) => {
      const idx = orderedKeys.indexOf(key);
      return { index: idx };
    },
    [orderedKeys],
  );

  // ── Close helpers ────────────────────────────────────────────
  const closeSingle = useCallback(
    (targetKey: string) => {
      const removeFrom = <T extends { key: string }>(
        list: T[],
        setter: (next: T[]) => void,
      ): boolean => {
        const idx = list.findIndex((it) => it.key === targetKey);
        if (idx === -1) return false;
        const next = list.filter((it) => it.key !== targetKey);
        setter(next);
        setActiveKey((curr) => {
          if (curr !== targetKey) return curr;
          if (next.length > 0) return next[Math.min(idx, next.length - 1)].key;
          const all = [...dbChats, ...sqlTabs, ...docTabs]
            .filter((t) => t.key !== targetKey)
            .map((t) => t.key);
          return all[0] ?? "";
        });
        return true;
      };
      if (removeFrom(sqlTabs, setSqlTabs)) return;
      if (removeFrom(dbChats, setDbChats)) return;
      removeFrom(docTabs, setDocTabs);
    },
    [sqlTabs, dbChats, docTabs],
  );

  const closeOthers = useCallback(
    (keepKey: string) => {
      const keepSet = new Set([keepKey]);
      setDbChats((prev) => prev.filter((d) => keepSet.has(d.key)));
      setSqlTabs((prev) => prev.filter((s) => keepSet.has(s.key)));
      setDocTabs((prev) => prev.filter((d) => keepSet.has(d.key)));
      setActiveKey(keepKey);
    },
    [],
  );

  const closeRight = useCallback(
    (key: string) => {
      const { index } = locateTab(key);
      const keepSet = new Set(orderedKeys.slice(0, index + 1));
      setDbChats((prev) => prev.filter((d) => keepSet.has(d.key)));
      setSqlTabs((prev) => prev.filter((s) => keepSet.has(s.key)));
      setDocTabs((prev) => prev.filter((d) => keepSet.has(d.key)));
    },
    [orderedKeys, locateTab],
  );

  const closeAll = useCallback(() => {
    setDbChats([]);
    setSqlTabs([]);
    setDocTabs([]);
    setActiveKey("");
  }, []);

  const handleEdit = useCallback(
    (
      targetKey: React.MouseEvent | React.KeyboardEvent | string,
      action: "add" | "remove",
    ) => {
      if (action === "remove" && typeof targetKey === "string")
        closeSingle(targetKey);
    },
    [closeSingle],
  );

  // ── Context menu lifecycle ───────────────────────────────────
  useEffect(() => {
    if (!tabCtxMenu) return;
    const close = () => setTabCtxMenu(null);
    const timer = window.setTimeout(() => {
      window.addEventListener("mousedown", close);
      window.addEventListener("contextmenu", close);
      window.addEventListener("resize", close);
      window.addEventListener("blur", close);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [tabCtxMenu]);

  const ctxMenuItems: MenuProps["items"] = useMemo(
    () => [
      {
        key: "close",
        icon: <CloseOutlined />,
        label: t("workspace.closeTab"),
      },
      {
        key: "closeOthers",
        icon: <ColumnWidthOutlined />,
        label: t("workspace.closeOthers"),
      },
      {
        key: "closeRight",
        icon: <VerticalRightOutlined />,
        label: t("workspace.closeRight"),
      },
      { type: "divider" },
      {
        key: "closeAll",
        icon: <ClearOutlined />,
        label: t("workspace.closeAll"),
        danger: true,
      },
    ],
    [t],
  );

  const handleCtxMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!tabCtxMenu) return;
    const targetKey = tabCtxMenu.key;
    switch (key) {
      case "close":
        closeSingle(targetKey);
        break;
      case "closeOthers":
        closeOthers(targetKey);
        break;
      case "closeRight":
        closeRight(targetKey);
        break;
      case "closeAll":
        closeAll();
        break;
    }
    setTabCtxMenu(null);
  };

  // ── @dnd-kit drag handler ─────────────────────────────────────
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const activeKey = active.id as string;
    const overKey = over.id as string;

    // Only reorder within the same group
    const reorder = <T extends { key: string }>(
      list: T[],
      setter: React.Dispatch<React.SetStateAction<T[]>>,
    ): boolean => {
      const activeIndex = list.findIndex((it) => it.key === activeKey);
      const overIndex = list.findIndex((it) => it.key === overKey);
      if (activeIndex === -1 || overIndex === -1) return false;
      setter((prev) => arrayMove(prev, activeIndex, overIndex));
      return true;
    };

    if (reorder(dbChats, setDbChats)) return;
    if (reorder(sqlTabs, setSqlTabs)) return;
    reorder(docTabs, setDocTabs);
  };

  // ── Build tab label with right-click menu ─────────────────────
  const makeTabLabel = (key: string, icon: React.ReactNode, text: string) => (
    <span
      className="workspace-tab-label"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setTabCtxMenu({ x: e.clientX, y: e.clientY, key });
      }}
    >
      {icon} {text}
    </span>
  );

  // ── Tab items ────────────────────────────────────────────────
  const items = useMemo(
    () => [
      ...dbChats.map((d) => ({
        key: d.key,
        label: makeTabLabel(d.key, <MessageOutlined />, d.context.databaseName),
        closable: true,
        children: (
          <AIChat
            key={d.key}
            onRunSql={handleRunSql}
            databaseContext={d.context}
          />
        ),
      })),
      ...sqlTabs.map((it) => ({
        key: it.key,
        label: makeTabLabel(
          it.key,
          <TableOutlined />,
          t("workspace.sqlTab", { n: it.index }),
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
        label: makeTabLabel(d.key, <FileTextOutlined />, d.tableName),
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
          destroyOnHidden={false}
          activeKey={activeKey}
          onChange={setActiveKey}
          onEdit={handleEdit}
          items={items}
          size="small"
          className="workspace-tabs"
          renderTabBar={(tabBarProps, DefaultTabBar) => (
            <DndContext
              sensors={[sensor]}
              onDragEnd={onDragEnd}
              collisionDetection={closestCenter}
            >
              <SortableContext
                items={orderedKeys}
                strategy={horizontalListSortingStrategy}
              >
                <DefaultTabBar {...tabBarProps}>
                  {(node) => (
                    <DraggableTabNode
                      {...(node as React.ReactElement<DraggableTabPaneProps>)
                        .props}
                      key={node.key}
                    >
                      {node}
                    </DraggableTabNode>
                  )}
                </DefaultTabBar>
              </SortableContext>
            </DndContext>
          )}
        />
      ) : (
        <div className="content-body-empty">
          <Result
            status="404"
            icon={
              <CodeOutlined
                style={{ fontSize: 64, color: "var(--muted-foreground)" }}
              />
            }
            subTitle={
              <span>
                在左侧选择一个数据源和数据库
                <br />
                右键选择「新建查询」开始对话
              </span>
            }
          />
        </div>
      )}

      {/* Tab context menu portal */}
      {tabCtxMenu &&
        createPortal(
          <div
            className="tab-ctx-menu"
            style={{ top: tabCtxMenu.y, left: tabCtxMenu.x }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Menu
              items={ctxMenuItems}
              onClick={handleCtxMenuClick}
              selectable={false}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

export default ContentBody;
