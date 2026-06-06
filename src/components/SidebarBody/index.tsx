import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button, Menu, Select, Tree, Typography, message, Spin, Tag, Tooltip, Modal, Checkbox, Input } from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined,
  FieldNumberOutlined,
  CheckOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  UserOutlined,
  LockOutlined,
  FontSizeOutlined,
  ClockCircleOutlined,
  NumberOutlined,
  CheckSquareOutlined,
  FileOutlined,
  UnorderedListOutlined,
  KeyOutlined,
  SearchOutlined,
  TableOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useTranslation } from "../../i18n";
import { useSettings } from "../../settings/SettingsContext";
import {
  listMysqlDatabases,
  listMysqlTables,
  listMysqlColumns,
  listRedisDatabases,
} from "../../db-api";
import type { DataSourceConfig } from "../../settings/types";
import type { ColumnInfo } from "../../db-api";
import "./index.css";

// ── Helpers ────────────────────────────────────────────────────

function updateTreeData(list: DataNode[], key: React.Key, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children) return { ...node, children: updateTreeData(node.children, key, children) };
    return node;
  });
}

interface ContextState {
  x: number;
  y: number;
  node: DataNode;
}

/** True if the tree key represents a MySQL database node (2 segments) */
function isMysqlDbNode(key: string): boolean {
  return key.startsWith("mysql:") && key.split(":").length === 2;
}

/** True if the tree key represents a MySQL table node (3 segments) */
function isMysqlTableNode(key: string): boolean {
  return key.startsWith("mysql:") && key.split(":").length === 3;
}

// ── Column icon helper ──────────────────────────────────────────

/** Pick an appropriate icon for a database column based on its key and type. */
function getColumnIcon(col: ColumnInfo): React.ReactNode {
  // Primary key → lock icon
  if (col.key === "PRI") {
    return <LockOutlined style={{ color: "#faad14" }} />;
  }
  // Unique key → key icon
  if (col.key === "UNI") {
    return <KeyOutlined style={{ color: "#1677ff" }} />;
  }
  // Foreign key / index → link icon
  if (col.key === "MUL") {
    return <LinkOutlined style={{ color: "#722ed1" }} />;
  }

  // Type-based icons (guard against undefined colType)
  const t = (col.colType ?? "").toLowerCase();

  // Integer types
  if (/\b(int|bigint|smallint|tinyint|mediumint|serial)\b/.test(t)) {
    return <NumberOutlined style={{ color: "#52c41a" }} />;
  }
  // Decimal / float
  if (/\b(decimal|numeric|float|double|real)\b/.test(t)) {
    return <NumberOutlined style={{ color: "#13c2c2" }} />;
  }
  // String types
  if (/\b(varchar|char|text|longtext|mediumtext|tinytext)\b/.test(t)) {
    return <FontSizeOutlined style={{ color: "#1677ff" }} />;
  }
  // Date / time types
  if (/\b(date|datetime|timestamp|time|year)\b/.test(t)) {
    return <ClockCircleOutlined style={{ color: "#eb2f96" }} />;
  }
  // JSON
  if (/\b(json)\b/.test(t)) {
    return <CodeOutlined style={{ color: "#fa8c16" }} />;
  }
  // Boolean
  if (/\b(bool|boolean|bit)\b/.test(t)) {
    return <CheckSquareOutlined style={{ color: "#722ed1" }} />;
  }
  // Blob / binary
  if (/\b(blob|binary|varbinary|longblob|mediumblob|tinyblob)\b/.test(t)) {
    return <FileOutlined style={{ color: "#8c8c8c" }} />;
  }
  // Enum / set
  if (/\b(enum|set)\b/.test(t)) {
    return <UnorderedListOutlined style={{ color: "#2f54eb" }} />;
  }

  // Default
  return <FieldNumberOutlined style={{ color: "#8c8c8c" }} />;
}

// ── Component ──────────────────────────────────────────────────

function SidebarBody({
  onSelectDs,
  onNewQuery,
  onOpenTableQuery,
  onEditTableDoc,
}: {
  onSelectDs?: (name: string | null) => void;
  onNewQuery?: (ctx: { datasourceName: string; databaseName: string; dbType: string }) => void;
  onOpenTableQuery?: (params: { sql: string; datasourceName: string; databaseName: string }) => void;
  onEditTableDoc?: (params: { datasourceName: string; dbName: string; tableName: string; dataSourceConfig: DataSourceConfig }) => void;
}) {
  const t = useTranslation();
  const { settings, save } = useSettings();
  const connections = settings?.datasource?.connections ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  // ── Select tables modal ──────────────────────────────────────
  const [selectTablesOpen, setSelectTablesOpen] = useState(false);
  const [selectTablesDb, setSelectTablesDb] = useState<string>("");
  const [selectTablesAll, setSelectTablesAll] = useState<string[]>([]);
  const [selectTablesChecked, setSelectTablesChecked] = useState<string[]>([]);
  const [selectTablesLoading, setSelectTablesLoading] = useState(false);
  const [selectTablesSearch, setSelectTablesSearch] = useState("");

  /** Tables filtered by search keyword */
  const selectTablesFiltered = useMemo(() => {
    if (!selectTablesSearch.trim()) return selectTablesAll;
    const kw = selectTablesSearch.trim().toLowerCase();
    return selectTablesAll.filter((t) => t.toLowerCase().includes(kw));
  }, [selectTablesAll, selectTablesSearch]);

  const toggleSelectTable = (name: string) => {
    setSelectTablesChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleSelectAll = () => setSelectTablesChecked([...selectTablesAll]);
  const handleDeselectAll = () => setSelectTablesChecked([]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedField(field);
      messageApi.success("已复制");
      setTimeout(() => setCopiedField(null), 2000);
    });
  };
  const treeWrapRef = useRef<HTMLDivElement>(null);

  const selectedConfig = useMemo(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

  // ── Table visibility helpers ─────────────────────────────────
  const tableVisibility = settings?.tableVisibility ?? {};

  /** Get the visibility key for a datasource+db combo */
  const getVisibilityKey = (dsId: string, dbName: string) => `${dsId}:${dbName}`;

  /** Get visible table names for a given database. Empty = show all. */
  const getVisibleTables = (dsId: string, dbName: string): string[] | null => {
    const key = getVisibilityKey(dsId, dbName);
    const list = tableVisibility[key];
    return list && list.length > 0 ? list : null;
  };

  /** Filter table names by visibility setting */
  const filterTables = (dsId: string, dbName: string, tables: string[]): string[] => {
    const visible = getVisibleTables(dsId, dbName);
    return visible ? tables.filter((t) => visible.includes(t)) : tables;
  };

  /** Save table visibility and persist to settings */
  const saveTableVisibility = async (dsId: string, dbName: string, tables: string[]) => {
    if (!settings) return;
    const key = getVisibilityKey(dsId, dbName);
    const next: Record<string, string[]> = { ...tableVisibility };
    if (tables.length === 0) {
      delete next[key]; // empty = show all → remove filter
    } else {
      next[key] = tables;
    }
    const updated = { ...settings, tableVisibility: next };
    await save(updated);
  };

  // Notify parent when selection changes (for docs folder button)
  useEffect(() => {
    onSelectDs?.(selectedConfig?.name ?? null);
  }, [selectedConfig, onSelectDs]);

  // ── Load root tree nodes when data source changes ────────────
  const loadRoot = useCallback(async () => {
    if (!selectedConfig) {
      setTreeData([]);
      return;
    }
    setLoadingTree(true);
    try {
      if (selectedConfig.dbType === "mysql") {
        const dbs = await listMysqlDatabases(selectedConfig);
        setTreeData(
          dbs.map((db) => ({
            title: db,
            key: `mysql:${db}`,
            isLeaf: false,
          })),
        );
      } else {
        const dbs = await listRedisDatabases(selectedConfig);
        setTreeData(
          dbs.map((info) => ({
            title: `DB${info.index}  (${info.keyCount} keys)`,
            key: `redis:${info.index}`,
            isLeaf: true,
          })),
        );
      }
    } catch (e) {
      messageApi.error(t("settings.datasource.loadingFailed"));
      setTreeData([]);
    } finally {
      setLoadingTree(false);
    }
  }, [selectedConfig, messageApi, t]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // ── Lazy-load tree children ──────────────────────────────────
  const onLoadData = useCallback(
    (node: DataNode): Promise<void> =>
      new Promise<void>((resolve) => {
        if (node.children || !selectedConfig) {
          resolve();
          return;
        }

        const key = String(node.key);

        if (selectedConfig.dbType === "mysql") {
          if (key.startsWith("mysql:") && key.split(":").length === 2) {
            const dbName = key.replace("mysql:", "");
            listMysqlTables(selectedConfig, dbName)
              .then((tables) => {
                const filtered = filterTables(selectedConfig.id, dbName, tables);
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    filtered.map((t) => ({
                      title: t,
                      key: `${key}:${t}`,
                      isLeaf: false,
                    })),
                  ),
                );
                resolve();
              })
              .catch((e) => {
                messageApi.error(String(e));
                resolve();
              });
            return;
          }

          if (key.startsWith("mysql:") && key.split(":").length === 3) {
            const parts = key.split(":");
            const dbName = parts[1];
            const tableName = parts.slice(2).join(":");
            listMysqlColumns(selectedConfig, dbName, tableName)
              .then((cols) => {
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    cols.map((col) => ({
                      title: `${col.name}  ${col.colType}`,
                      key: `${key}:${col.name}`,
                      isLeaf: true,
                      icon: getColumnIcon(col),
                    })),
                  ),
                );
                resolve();
              })
              .catch((e) => {
                messageApi.error(String(e));
                resolve();
              });
            return;
          }
        }

        resolve();
      }),
    [selectedConfig, messageApi, tableVisibility],
  );

  // ── Select options grouped by type ────────────────────────────
  const selectOptions = useMemo(() => {
    const groups: { label: string; options: { value: string; label: string }[] }[] = [];

    const mysqlConns = connections.filter((c) => c.dbType === "mysql");
    if (mysqlConns.length > 0) {
      groups.push({
        label: "MySQL",
        options: mysqlConns.map((c) => ({
          value: c.id,
          label: c.name,
        })),
      });
    }

    const redisConns = connections.filter((c) => c.dbType === "redis");
    if (redisConns.length > 0) {
      groups.push({
        label: "Redis",
        options: redisConns.map((c) => ({
          value: c.id,
          label: c.name,
        })),
      });
    }

    return groups;
  }, [connections]);

  // ── Context menu ──────────────────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
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
  }, [ctxMenu]);

  // ── Menu items ──────────────────────────────────────────────
  const menuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      { key: "refresh", icon: <ReloadOutlined />, label: t("sidebar.ctx.refresh") },
      { key: "copy", icon: <CopyOutlined />, label: t("sidebar.ctx.copyName") },
    ];

    // "新建查询" only for MySQL database nodes
    if (ctxMenu && isMysqlDbNode(String(ctxMenu.node.key))) {
      items.push({
        key: "newQuery",
        icon: <CodeOutlined />,
        label: t("sidebar.ctx.newQuery"),
      });
      items.push({
        key: "selectTables",
        icon: <CheckOutlined />,
        label: t("sidebar.ctx.selectTables"),
      });
    }

    // "编辑文档" for MySQL table nodes
    if (ctxMenu && isMysqlTableNode(String(ctxMenu.node.key))) {
      items.push({
        key: "editDoc",
        icon: <FileTextOutlined />,
        label: t("sidebar.ctx.editDoc"),
      });
    }

    return items;
  }, [t, ctxMenu]);

  // ── Select tables modal handlers ─────────────────────────────
  const openSelectTablesModal = async (dbName: string) => {
    if (!selectedConfig) return;
    setSelectTablesDb(dbName);
    setSelectTablesOpen(true);
    setSelectTablesLoading(true);
    setSelectTablesSearch("");
    try {
      const allTables = await listMysqlTables(selectedConfig, dbName);
      setSelectTablesAll(allTables);
      const visible = getVisibleTables(selectedConfig.id, dbName);
      setSelectTablesChecked(visible ?? allTables);
    } catch {
      setSelectTablesAll([]);
      setSelectTablesChecked([]);
    } finally {
      setSelectTablesLoading(false);
    }
  };

  const handleSelectTablesOk = async () => {
    if (!selectedConfig) return;
    const tablesToSave =
      selectTablesChecked.length === selectTablesAll.length
        ? []
        : selectTablesChecked;
    await saveTableVisibility(selectedConfig.id, selectTablesDb, tablesToSave);
    setSelectTablesOpen(false);
    setSelectTablesSearch("");

    // Clear the affected database node's children so they reload with
    // the new visibility settings when the user expands the node again.
    const dbKey = `mysql:${selectTablesDb}`;
    setTreeData((origin) =>
      origin.map((node) => {
        if (node.key === dbKey) {
          const { children: _children, ...rest } = node;
          return rest;
        }
        return node;
      }),
    );
  };

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!ctxMenu) return;
    const node = ctxMenu.node;
    const title = String(node.title ?? node.key);

    switch (key) {
      case "refresh":
        setTreeData((origin) => updateTreeData(origin, node.key, []));
        messageApi.success(t("sidebar.msg.refreshed", { name: title }));
        setCtxMenu(null);
        break;
      case "copy": {
        // Extract clean name: for column nodes strip type info (e.g. "id  int?⚷" → "id")
        const copyText =
          title.includes("  ")
            ? title.split("  ")[0]
            : title;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(copyText)
            .then(() => messageApi.success(t("sidebar.msg.copied", { name: copyText })))
            .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        } else {
          // Fallback for environments without clipboard API
          try {
            const ta = document.createElement("textarea");
            ta.value = copyText;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            messageApi.success(t("sidebar.msg.copied", { name: copyText }));
          } catch {
            messageApi.error(t("sidebar.msg.copyFailed"));
          }
        }
        setCtxMenu(null);
        break;
      }
      case "newQuery": {
        if (!selectedConfig) break;
        const dbName = String(node.key).replace("mysql:", "");
        onNewQuery?.({
          datasourceName: selectedConfig.name,
          databaseName: dbName,
          dbType: selectedConfig.dbType,
        });
        setCtxMenu(null);
        break;
      }
      case "selectTables": {
        if (!selectedConfig) break;
        setCtxMenu(null);
        const dbKey = String(node.key);
        const selDbName = dbKey.replace("mysql:", "");
        openSelectTablesModal(selDbName);
        break;
      }
      case "editDoc": {
        if (!selectedConfig) break;
        const key = String(node.key);
        // key format: mysql:{dbName}:{tableName}
        const parts = key.split(":");
        const dbName = parts[1];
        const tableName = parts.slice(2).join(":");
        onEditTableDoc?.({
          datasourceName: selectedConfig.name,
          dbName,
          tableName,
          dataSourceConfig: selectedConfig,
        });
        setCtxMenu(null);
        break;
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="sidebar-body">
      {contextHolder}
      <div className="sidebar-body-section">
        <Typography.Text type="secondary">{t("sidebar.dataSource")}</Typography.Text>
        <Select
          value={selectedId}
          onChange={setSelectedId}
          options={selectOptions}
          style={{ width: "100%", height: "32px" }}
          placeholder={
            connections.length > 0
              ? t("settings.datasource.selectPlaceholder")
              : t("settings.datasource.noConnections")
          }
          notFoundContent={t("settings.datasource.noConnections")}
        />
      </div>

      {/* Selected data source info card */}
      {selectedConfig && (
        <div className="sidebar-ds-info">
          <div className="sidebar-ds-info-header">
            <Tag
              color={selectedConfig.dbType === "mysql" ? "geekblue" : "orange"}
              style={{ margin: 0 }}
            >
              {selectedConfig.dbType === "mysql" ? "MySQL" : "Redis"}
            </Tag>
            <span className="sidebar-ds-info-name">{selectedConfig.name}</span>
            <Tooltip title="复制连接串">
              <Button
                className="sidebar-ds-info-copy-btn"
                type="text"
                size="small"
                icon={copiedField === "conn" ? <CheckOutlined style={{ color: "#52c41a" }} /> : <LinkOutlined style={{ fontSize: 12 }} />}
                onClick={() => copyToClipboard(`${selectedConfig.host}:${selectedConfig.port}`, "conn")}
              />
            </Tooltip>
          </div>
          <div className="sidebar-ds-info-body">
            <div className="sidebar-ds-info-row">
              <EnvironmentOutlined className="sidebar-ds-info-icon" />
              <code className="sidebar-ds-info-value">{selectedConfig.host}</code>
              <span className="sidebar-ds-info-sep">:</span>
              <code className="sidebar-ds-info-value">{selectedConfig.port}</code>
              {selectedConfig.user && (
                <div className="sidebar-ds-info-row">
                  <UserOutlined className="sidebar-ds-info-icon" />
                  <code className="sidebar-ds-info-value">{selectedConfig.user}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-body-section sidebar-tree" ref={treeWrapRef}>
        <Typography.Text type="secondary">{t("sidebar.database")}</Typography.Text>
        {loadingTree ? (
          <Spin style={{ marginTop: 12 }} />
        ) : (
          <Tree
            loadData={onLoadData}
            treeData={treeData}
            showIcon
            blockNode
            onRightClick={({ event, node }) => {
              event.preventDefault();
              event.stopPropagation();
              setCtxMenu({ x: event.clientX, y: event.clientY, node });
            }}
            onDoubleClick={(_e, node) => {
              const key = String(node.key);
              // Only handle MySQL table nodes: mysql:{dbName}:{tableName}
              if (
                selectedConfig &&
                selectedConfig.dbType === "mysql" &&
                key.startsWith("mysql:") &&
                key.split(":").length === 3
              ) {
                const parts = key.split(":");
                const dbName = parts[1];
                const tableName = parts.slice(2).join(":");
                const sql = `SELECT * FROM \`${tableName}\` LIMIT 10;`;
                onOpenTableQuery?.({
                  sql,
                  datasourceName: selectedConfig.name,
                  databaseName: dbName,
                });
              }
            }}
          />
        )}
      </div>

      {ctxMenu &&
        createPortal(
          <div
            className="sidebar-tree-ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Menu
              items={menuItems}
              onClick={handleMenuClick}
              selectable={false}
            />
          </div>,
          document.body,
        )}

      {/* ── Select Tables Modal ─────────────────────────────── */}
      <Modal
        title={
          <span>
            <TableOutlined style={{ marginRight: 8 }} />
            {t("sidebar.ctx.selectTables")}
            <span style={{ color: "var(--muted-foreground)", marginLeft: 8, fontSize: 13, fontWeight: 400 }}>
              {selectTablesDb}
            </span>
          </span>
        }
        open={selectTablesOpen}
        onCancel={() => {
          setSelectTablesOpen(false);
          setSelectTablesSearch("");
        }}
        onOk={handleSelectTablesOk}
        okText={t("settings.save")}
        cancelText={t("settings.reset")}
        width={520}
        destroyOnHidden
      >
        {selectTablesLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin size="large" />
            <p style={{ color: "var(--muted-foreground)", marginTop: 12 }}>加载中…</p>
          </div>
        ) : selectTablesAll.length === 0 ? (
          <div className="select-tables-empty">
            <InboxOutlined style={{ fontSize: 48, color: "var(--muted-foreground)", opacity: 0.4 }} />
            <p className="select-tables-empty-text">{t("sidebar.selectTables.emptyTable")}</p>
          </div>
        ) : (
          <div className="select-tables-body">
            {/* ── Search bar ────────────────────────────────── */}
            <Input
              prefix={<SearchOutlined style={{ color: "var(--muted-foreground)" }} />}
              placeholder={t("sidebar.selectTables.searchPlaceholder")}
              value={selectTablesSearch}
              onChange={(e) => setSelectTablesSearch(e.target.value)}
              allowClear
              className="select-tables-search"
            />

            {/* ── Toolbar ──────────────────────────────────── */}
            <div className="select-tables-toolbar">
              <span className="select-tables-count">
                {selectTablesSearch.trim()
                  ? t("sidebar.selectTables.selectedCount", {
                      count: selectTablesChecked.length,
                      total: selectTablesAll.length,
                    })
                  : t("sidebar.selectTables.selectedCount", {
                      count: selectTablesChecked.length,
                      total: selectTablesAll.length,
                    })}
              </span>
              <span className="select-tables-actions">
                <Button type="link" size="small" onClick={handleSelectAll}>
                  {t("sidebar.selectTables.selectAll")}
                </Button>
                <Button type="link" size="small" onClick={handleDeselectAll}>
                  {t("sidebar.selectTables.deselectAll")}
                </Button>
              </span>
            </div>

            {/* ── Table list ──────────────────────────────── */}
            <div className="select-tables-list">
              {selectTablesFiltered.length === 0 ? (
                <div className="select-tables-no-match">
                  <span>{t("sidebar.selectTables.noMatch")}</span>
                </div>
              ) : (
                selectTablesFiltered.map((tableName) => {
                  const checked = selectTablesChecked.includes(tableName);
                  return (
                    <div
                      key={tableName}
                      className={`select-tables-row${checked ? " selected" : ""}`}
                      onClick={() => toggleSelectTable(tableName)}
                    >
                      <Checkbox checked={checked} />
                      <TableOutlined className="select-tables-row-icon" />
                      <span className="select-tables-row-name">{tableName}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

export default SidebarBody;
