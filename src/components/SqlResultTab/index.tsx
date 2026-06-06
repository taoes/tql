import {
  Table,
  Button,
  Dropdown,
  Input,
  message,
  Checkbox,
  Popover,
  Spin,
  Alert,
} from "antd";
import type { MenuProps } from "antd";
import type { SorterResult, TablePaginationConfig } from "antd/es/table/interface";
import type { FilterValue } from "antd/es/table/interface";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "../../i18n";
import { useSettings } from "../../settings/SettingsContext";
import { executeQuery, writeExportFile } from "../../db-api";
import { save } from "@tauri-apps/plugin-dialog";
import type { DataSourceConfig } from "../../settings/types";
import type { QueryResult, ColumnInfo } from "../../db-api";
import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  ExportOutlined,
  PlayCircleOutlined,
  DownOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import "./index.css";

// ── Types ────────────────────────────────────────────────────

interface SqlResultTabProps {
  sql: string;
  dataSourceConfig: DataSourceConfig;
  databaseName: string;
}

interface QueryState {
  loading: boolean;
  error: string | null;
  result: QueryResult | null;
}

/** Row type used for Ant Design Table — key + dynamic string columns */
type TableRow = Record<string, unknown> & { key: number };

// ── Component ─────────────────────────────────────────────────

export default function SqlResultTab({
  sql,
  dataSourceConfig,
  databaseName,
}: SqlResultTabProps) {
  const t = useTranslation();
  const { settings } = useSettings();

  // ---- state ----
  const [editing, setEditing] = useState(false);
  const [editSql, setEditSql] = useState(sql);
  const [sortedInfo, setSortedInfo] = useState<{
    columnKey: string;
    order: "ascend" | "descend" | null;
  }>({ columnKey: "", order: null });
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [queryState, setQueryState] = useState<QueryState>({
    loading: false,
    error: null,
    result: null,
  });

  // Sync external sql prop when it changes (but not when exiting edit mode)
  useEffect(() => {
    setEditSql(sql);
  }, [sql]);

  // ---- query execution ----
  const runQuery = useCallback(
    async (sqlText: string, signal?: AbortSignal) => {
      setQueryState({ loading: true, error: null, result: null });
      try {
        const timeout = settings?.basic.queryTimeout ?? 30;
        const maxRows = settings?.basic.maxRows ?? 1000;
        const result = await executeQuery(
          dataSourceConfig,
          databaseName,
          sqlText,
          maxRows,
          timeout,
        );
        if (!signal?.aborted) {
          setQueryState({ loading: false, error: null, result });
        }
      } catch (e) {
        if (!signal?.aborted) {
          setQueryState({
            loading: false,
            error: e instanceof Error ? e.message : String(e),
            result: null,
          });
        }
      }
    },
    [dataSourceConfig, databaseName, settings],
  );

  // Sync visible columns when result columns change
  useEffect(() => {
    if (queryState.result) {
      setVisibleColumns(queryState.result.columns.map((c) => c.name));
    }
  }, [queryState.result]);

  const handleExecute = useCallback(() => {
    runQuery(editSql);
  }, [runQuery, editSql]);

  // ---- data processing ----
  const hasResults =
    queryState.result !== null &&
    queryState.result.rows.length > 0;

  /** All available column defs from query result */
  const allColumnDefs = useMemo(() => {
    if (!queryState.result) return [];
    return queryState.result.columns.map((col: ColumnInfo) => ({
      key: col.name,
      title: col.name,
      dataIndex: col.name,
    }));
  }, [queryState.result]);

  /** Transform 2-D rows to Ant Design row objects */
  const rawTableData: TableRow[] = useMemo(() => {
    if (!queryState.result) return [];
    return queryState.result.rows.map((row, idx) => {
      const obj: TableRow = { key: idx };
      queryState.result!.columns.forEach((col, i) => {
        obj[col.name] = row[i];
      });
      return obj;
    });
  }, [queryState.result]);

  /** Sorted data (client-side) */
  const processedData = useMemo(() => {
    const data = [...rawTableData];
    if (sortedInfo.order && sortedInfo.columnKey) {
      data.sort((a, b) => {
        const aVal = a[sortedInfo.columnKey];
        const bVal = b[sortedInfo.columnKey];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortedInfo.order === "ascend"
            ? aVal - bVal
            : bVal - aVal;
        }
        const aStr = String(aVal ?? "");
        const bStr = String(bVal ?? "");
        if (aStr < bStr) return sortedInfo.order === "ascend" ? -1 : 1;
        if (aStr > bStr) return sortedInfo.order === "ascend" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [rawTableData, sortedInfo]);

  // ---- table columns ----
  const tableColumns = useMemo(() => {
    return allColumnDefs
      .filter((c) => visibleColumns.includes(c.key))
      .map((c) => ({
        title: c.title,
        dataIndex: c.dataIndex,
        key: c.key,
        width: 200,
        sorter: true as const,
        ellipsis: { showTitle: true },
        render: (v: unknown) => {
          if (v === null || v === undefined)
            return (
              <span style={{ color: "var(--color-muted-foreground, #999)" }}>
                NULL
              </span>
            );
          return String(v);
        },
      }));
  }, [allColumnDefs, visibleColumns]);

  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<TableRow> | SorterResult<TableRow>[],
    ) => {
      const s = Array.isArray(sorter) ? sorter[0] : sorter;
      setSortedInfo({
        columnKey: (s.columnKey as string) || "",
        order: s.order || null,
      });
    },
    [],
  );

  // ---- export helpers ----
  const getExportData = useCallback(() => {
    if (!queryState.result) return { columns: allColumnDefs, rows: processedData };
    const cols = allColumnDefs.filter((c) => visibleColumns.includes(c.key));
    return { columns: cols, rows: processedData };
  }, [allColumnDefs, visibleColumns, processedData, queryState.result]);

  const showCopySuccess = () => message.success(t("workspace.copySuccess"));

  /** Build CSV string from export data */
  const buildCSV = useCallback(() => {
    const { columns, rows } = getExportData();
    const header = columns.map((c) => c.title).join(",");
    const body = rows
      .map((row) =>
        columns
          .map((c) => {
            const v = row[c.dataIndex];
            if (v === null || v === undefined) return "";
            const s = String(v);
            // Escape fields containing commas or quotes
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(","),
      )
      .join("\n");
    return header + "\n" + body;
  }, [getExportData]);

  /** Build JSON string from export data */
  const buildJSON = useCallback(() => {
    const { columns, rows } = getExportData();
    const json = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((c) => {
        obj[c.key] = row[c.dataIndex];
      });
      return obj;
    });
    return JSON.stringify(json, null, 2);
  }, [getExportData]);

  // ---- Copy handlers ----
  const handleCopyCSV = useCallback(() => {
    navigator.clipboard.writeText(buildCSV()).then(showCopySuccess);
  }, [buildCSV, t]);

  const handleCopyJSON = useCallback(() => {
    navigator.clipboard.writeText(buildJSON()).then(showCopySuccess);
  }, [buildJSON, t]);

  // ---- Export handlers (native save dialog → Rust write) ----
  const handleExportCSV = useCallback(async () => {
    const filePath = await save({
      defaultPath: "result.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!filePath) return;
    try {
      const savedPath = await writeExportFile(filePath, buildCSV());
      message.success(t("workspace.exportSaved", { path: savedPath }));
    } catch (e) {
      message.error(
        e instanceof Error ? e.message : t("workspace.exportFailed"),
      );
    }
  }, [buildCSV, t]);

  const handleExportJSON = useCallback(async () => {
    const filePath = await save({
      defaultPath: "result.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return;
    try {
      const savedPath = await writeExportFile(filePath, buildJSON());
      message.success(t("workspace.exportSaved", { path: savedPath }));
    } catch (e) {
      message.error(
        e instanceof Error ? e.message : t("workspace.exportFailed"),
      );
    }
  }, [buildJSON, t]);

  // ---- dropdown menus ----
  const copyMenuItems: MenuProps["items"] = [
    { key: "csv", label: t("workspace.copyCSV"), onClick: handleCopyCSV },
    { key: "json", label: t("workspace.copyJSON"), onClick: handleCopyJSON },
  ];

  const exportMenuItems: MenuProps["items"] = [
    { key: "csv", label: t("workspace.exportCSV"), onClick: handleExportCSV },
    { key: "json", label: t("workspace.exportJSON"), onClick: handleExportJSON },
  ];

  // ---- column selector content ----
  const columnSelectorContent = (
    <Checkbox.Group
      value={visibleColumns}
      onChange={(values) => setVisibleColumns(values as string[])}
      className="sql-result-column-checkboxes"
    >
      {allColumnDefs.map((c) => (
        <Checkbox key={c.key} value={c.key}>
          {c.title}
        </Checkbox>
      ))}
    </Checkbox.Group>
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="sql-result-tab">
      {/* ---- SQL section ---- */}
      <section className="sql-result-sql">
        <div className="sql-result-label">{t("workspace.sqlSection")}</div>
        <div className="sql-result-code-wrapper">
          {editing ? (
            <Input.TextArea
              value={editSql}
              onChange={(e) => setEditSql(e.target.value)}
              className="sql-result-textarea"
              autoSize={{ minRows: 3, maxRows: 12 }}
              autoFocus
              onKeyDown={(e) => {
                // Escape → cancel editing, revert changes
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditSql(sql);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <pre
              className="sql-result-code sql-result-code-clickable"
              onDoubleClick={() => setEditing(true)}
              title={t("workspace.doubleClickToEdit")}
            >
              {editSql}
            </pre>
          )}
          <div className="sql-result-actions">
            {editing && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => setEditing(false)}
                >
                  {t("workspace.confirm")}
                </Button>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setEditSql(sql);
                    setEditing(false);
                  }}
                >
                  {t("workspace.cancel")}
                </Button>
              </>
            )}
            <Dropdown
              menu={{ items: copyMenuItems }}
              trigger={["click"]}
              disabled={!hasResults}
            >
              <Button size="small" icon={<CopyOutlined />} disabled={!hasResults}>
                {t("workspace.copy")} <DownOutlined />
              </Button>
            </Dropdown>
            <Dropdown
              menu={{ items: exportMenuItems }}
              trigger={["click"]}
              disabled={!hasResults}
            >
              <Button
                size="small"
                icon={<ExportOutlined />}
                disabled={!hasResults}
              >
                {t("workspace.export")} <DownOutlined />
              </Button>
            </Dropdown>
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={queryState.loading}
            >
              {t("workspace.execute")}
            </Button>
          </div>
        </div>
      </section>

      {/* ---- Result section ---- */}
      <section className="sql-result-data">
        <div className="sql-result-label">
          {t("workspace.resultSection")}
          {queryState.result && (
            <span className="sql-result-rows">
              {t("workspace.rowsAffected", { n: queryState.result.rowCount })}
            </span>
          )}
        </div>

        {queryState.loading && (
          <div className="sql-result-loading">
            <Spin tip={t("workspace.executing")} />
          </div>
        )}

        {queryState.error && (
          <Alert
            type="error"
            message={t("workspace.executionFailed")}
            description={queryState.error}
            closable
            style={{ marginBottom: 12 }}
          />
        )}

        {!queryState.loading && !queryState.error && (
          <>
            <div className="sql-result-toolbar">
              <Popover
                content={columnSelectorContent}
                title={t("workspace.selectColumns")}
                trigger="click"
                placement="bottomLeft"
              >
                <Button size="small" icon={<SettingOutlined />}>
                  {t("workspace.columns")}
                </Button>
              </Popover>
            </div>
            <div className="sql-result-table-wrapper">
              <Table<TableRow>
                size="small"
                columns={tableColumns}
                dataSource={processedData}
                pagination={false}
                onChange={handleTableChange}
                locale={{ emptyText: t("workspace.emptyResult") }}
                scroll={{ x: "max-content" }}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
