import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Menu, Select, Tree, Typography, message, Spin } from "antd";
import { createPortal } from "react-dom";
import type { DataNode } from "antd/es/tree";
import {
  ReloadOutlined,
  CopyOutlined,
  CodeOutlined,
  TableOutlined,
  FieldNumberOutlined,
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
import "./index.css";

// ── Helpers ────────────────────────────────────────────────────

function updateTreeData(list: DataNode[], key: React.Key, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children) return { ...node, children: updateTreeData(node.children, key, children) };
    return node;
  });
}

function mapIcon(node: DataNode, connType: string | undefined): DataNode {
  if (node.children && node.children.length > 0) return node;
  // Already has icon
  if (node.icon) return node;
  // Leaf column node
  if (connType === "mysql" && String(node.key).split(":").length >= 4) {
    return { ...node, icon: <FieldNumberOutlined /> };
  }
  return node;
}

interface ContextState {
  x: number;
  y: number;
  node: DataNode;
}

// ── Component ──────────────────────────────────────────────────

function SidebarBody() {
  const t = useTranslation();
  const { settings } = useSettings();
  const connections = settings?.datasource?.connections ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextState | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const treeWrapRef = useRef<HTMLDivElement>(null);

  const selectedConfig = useMemo(
    () => connections.find((c) => c.id === selectedId) ?? null,
    [connections, selectedId],
  );

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
            title: `DB${info.index}  (${info.key_count} keys)`,
            key: `redis:${info.index}`,
            isLeaf: true,
            dbInfo: info,
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

        // MySQL: load tables for a database, or columns for a table
        if (selectedConfig.dbType === "mysql") {
          if (key.startsWith("mysql:") && key.split(":").length === 2) {
            // DB node → load tables
            const dbName = key.replace("mysql:", "");
            listMysqlTables(selectedConfig, dbName)
              .then((tables) => {
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    tables.map((t) => ({
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
            // Table node → load columns
            const parts = key.split(":");
            const dbName = parts[1];
            const tableName = parts.slice(2).join(":");
            listMysqlColumns(selectedConfig, dbName, tableName)
              .then((cols) => {
                setTreeData((origin) =>
                  updateTreeData(
                    origin,
                    key,
                    cols.map((col) => {
                      const pk = col.key === "PRI" ? " ⚷" : "";
                      const nullable = col.nullable ? "?" : "";
                      return {
                        title: `${col.name}  ${col.col_type}${nullable}${pk}`,
                        key: `${key}:${col.name}`,
                        isLeaf: true,
                        icon: <FieldNumberOutlined />,
                      };
                    }),
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
    [selectedConfig, messageApi],
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
          label: `${c.name} (${c.host}:${c.port})`,
        })),
      });
    }

    const redisConns = connections.filter((c) => c.dbType === "redis");
    if (redisConns.length > 0) {
      groups.push({
        label: "Redis",
        options: redisConns.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.host}:${c.port})`,
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

  const menuItems = useMemo<MenuProps["items"]>(
    () => [
      { key: "copy", icon: <CopyOutlined />, label: t("sidebar.ctx.copyName") },
      { key: "query", icon: <CodeOutlined />, label: t("sidebar.ctx.newQuery") },
      { key: "refresh", icon: <ReloadOutlined />, label: t("sidebar.ctx.refresh") },
    ],
    [t],
  );

  const handleMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (!ctxMenu) return;
    const node = ctxMenu.node;
    const title = String(node.title ?? node.key);

    switch (key) {
      case "refresh":
        // Clear children to force reload on next expand
        setTreeData((origin) => updateTreeData(origin, node.key, []));
        messageApi.success(t("sidebar.msg.refreshed", { name: title }));
        break;
      case "copy":
        navigator.clipboard
          ?.writeText(title)
          .then(() => messageApi.success(t("sidebar.msg.copied", { name: title })))
          .catch(() => messageApi.error(t("sidebar.msg.copyFailed")));
        break;
      case "query":
        messageApi.info(t("sidebar.msg.queryTodo", { name: title }));
        break;
    }
    setCtxMenu(null);
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
          placeholder={t("settings.datasource.noConnections")}
          notFoundContent={t("settings.datasource.noConnections")}
        />
      </div>

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
    </div>
  );
}

export default SidebarBody;
