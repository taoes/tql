import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Menu,
  Select,
  Tree,
  Typography,
  message,
  Spin,
} from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  FileTextOutlined,
  CheckOutlined,
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
import {
  updateTreeData,
  isMysqlDbNode,
  isMysqlTableNode,
} from "./helpers";
import type { ContextState } from "./helpers";
import { getColumnIcon } from "./columnIcon";
import DatasourceInfoCard from "./DatasourceInfoCard";
import SelectTablesModal from "./SelectTablesModal";
import "./index.css";

// ── Component ──────────────────────────────────────────────────

function SidebarBody({
  onSelectDs,
  onNewQuery,
  onOpenTableQuery,
  onEditTableDoc,
}: {
  onSelectDs?: (name: string | null) => void;
  onNewQuery?: (ctx: {
    datasourceName: string;
    databaseName: string;
    dbType: string;
  }) => void;
  onOpenTableQuery?: (params: {
    sql: string;
    datasourceName: string;
    databaseName: string;
  }) => void;
  onEditTableDoc?: (params: {
    datasourceName: string;
    dbName: string;
    tableName: string;
    dataSourceConfig: DataSourceConfig;
  }) => void;
}) {
  const t = useTranslation();
  const { settings, save } = useSettings();
  const connections = settings?.datasource?.connections ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  // ── Select tables modal ──────────────────────────────────────
  const [selectTablesOpen, setSelectTablesOpen] = useState(false);
  const [selectTablesDb, setSelectTablesDb] = useState("");

  const selectedConfig = useMemo(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

  // ── Table visibility helpers ─────────────────────────────────
  const tableVisibility = settings?.tableVisibility ?? {};

  const getVisibilityKey = (dsId: string, dbName: string) =>
    `${dsId}:${dbName}`;

  /** Get visible table names for a given database. null = show all. */
  const getVisibleTables = (
    dsId: string,
    dbName: string,
  ): string[] | null => {
    const key = getVisibilityKey(dsId, dbName);
    const list = tableVisibility[key];
    return list && list.length > 0 ? list : null;
  };

  /** Filter table names by visibility setting */
  const filterTables = (
    dsId: string,
    dbName: string,
    tables: string[],
  ): string[] => {
    const visible = getVisibleTables(dsId, dbName);
    return visible ? tables.filter((t) => visible.includes(t)) : tables;
  };

  /** Save table visibility and persist to settings */
  const saveTableVisibility = async (
    dsId: string,
    dbName: string,
    tables: string[],
  ) => {
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

  // Notify parent when selection changes
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
    } catch {
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
          // Database node → load tables
          if (key.startsWith("mysql:") && key.split(":").length === 2) {
            const dbName = key.replace("mysql:", "");
            listMysqlTables(selectedConfig, dbName)
              .then((tables) => {
                const filtered = filterTables(
                  selectedConfig.id,
                  dbName,
                  tables,
                );
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

          // Table node → load columns
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
    const groups: {
      label: string;
      options: { value: string; label: string }[];
    }[] = [];

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

  // ── Context menu lifecycle ────────────────────────────────────
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

  // ── Menu items ────────────────────────────────────────────────
  const menuItems = useMemo<MenuProps["items"]>(() => {
    const items: MenuProps["items"] = [
      {
        key: "refresh",
        icon: <ReloadOutlined />,
        label: t("sidebar.ctx.refresh"),
      },
      {
        key: "copy",
        icon: <CopyOutlined />,
        label: t("sidebar.ctx.copyName"),
      },
    ];

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

    if (ctxMenu && isMysqlTableNode(String(ctxMenu.node.key))) {
      items.push({
        key: "editDoc",
        icon: <FileTextOutlined />,
        label: t("sidebar.ctx.editDoc"),
      });
    }

    return items;
  }, [t, ctxMenu]);

  // ── Context menu click handler ────────────────────────────────
  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!ctxMenu) return;
    const node = ctxMenu.node;
    const title = String(node.title ?? node.key);
    const nodeKey = String(node.key);

    switch (key) {
      case "refresh":
        setTreeData((origin) => updateTreeData(origin, node.key, []));
        messageApi.success(t("sidebar.msg.refreshed", { name: title }));
        setCtxMenu(null);
        break;

      case "copy": {
        const copyText = title.includes("  ")
          ? title.split("  ")[0]
          : title;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(copyText)
            .then(() =>
              messageApi.success(t("sidebar.msg.copied", { name: copyText })),
            )
            .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        } else {
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
        const dbName = nodeKey.replace("mysql:", "");
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
        setSelectTablesDb(nodeKey.replace("mysql:", ""));
        setSelectTablesOpen(true);
        break;
      }

      case "editDoc": {
        if (!selectedConfig) break;
        const parts = nodeKey.split(":");
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

  // ── Select tables save handler ────────────────────────────────
  const handleSaveTableSelection = useCallback(
    async (tables: string[]) => {
      if (!selectedConfig) return;
      await saveTableVisibility(selectedConfig.id, selectTablesDb, tables);

      // Clear the affected database node's children so they reload
      // with the new visibility settings on next expand.
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
    },
    [selectedConfig, selectTablesDb, saveTableVisibility],
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="sidebar-body">
      {contextHolder}

      {/* Data source selector */}
      <div className="sidebar-body-section">
        <Typography.Text type="secondary">
          {t("sidebar.dataSource")}
        </Typography.Text>
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

      {/* Data source info card */}
      {selectedConfig && <DatasourceInfoCard config={selectedConfig} />}

      {/* Database tree */}
      <div className="sidebar-body-section sidebar-tree">
        <Typography.Text type="secondary">
          {t("sidebar.database")}
        </Typography.Text>
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

      {/* Context menu portal */}
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

      {/* Select tables modal */}
      <SelectTablesModal
        open={selectTablesOpen}
        dbName={selectTablesDb}
        dataSourceConfig={selectedConfig}
        currentVisible={selectedConfig ? getVisibleTables(selectedConfig.id, selectTablesDb) : null}
        onSave={handleSaveTableSelection}
        onClose={() => setSelectTablesOpen(false)}
      />
    </div>
  );
}

export default SidebarBody;
