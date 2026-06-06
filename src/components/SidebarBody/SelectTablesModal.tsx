import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Spin,
} from "antd";
import {
  SearchOutlined,
  TableOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { useTranslation } from "../../i18n";
import { listMysqlTables } from "../../db-api";
import type { DataSourceConfig } from "../../settings/types";

interface Props {
  open: boolean;
  dbName: string;
  dataSourceConfig: DataSourceConfig | null;
  /** Currently visible tables for this db. null = show all. */
  currentVisible: string[] | null;
  onSave: (tables: string[]) => Promise<void>;
  onClose: () => void;
}

function SelectTablesModal({
  open,
  dbName,
  dataSourceConfig,
  currentVisible,
  onSave,
  onClose,
}: Props) {
  const t = useTranslation();

  const [allTables, setAllTables] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Load table list when modal opens
  useEffect(() => {
    if (!open || !dataSourceConfig) return;
    setLoading(true);
    setSearch("");
    listMysqlTables(dataSourceConfig, dbName)
      .then((tables) => {
        setAllTables(tables);
        setChecked(currentVisible ?? tables);
      })
      .catch(() => {
        setAllTables([]);
        setChecked([]);
      })
      .finally(() => setLoading(false));
  }, [open, dbName, dataSourceConfig, currentVisible]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch("");
      setAllTables([]);
      setChecked([]);
    }
  }, [open]);

  /** Tables filtered by search keyword */
  const filtered = useMemo(() => {
    if (!search.trim()) return allTables;
    const kw = search.trim().toLowerCase();
    return allTables.filter((name) => name.toLowerCase().includes(kw));
  }, [allTables, search]);

  const toggle = (name: string) => {
    setChecked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleSelectAll = () => setChecked([...allTables]);
  const handleDeselectAll = () => setChecked([]);

  const handleOk = async () => {
    setSaving(true);
    try {
      // Empty array = show all (remove filter)
      const tablesToSave =
        checked.length === allTables.length ? [] : checked;
      await onSave(tablesToSave);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSearch("");
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <TableOutlined style={{ marginRight: 8 }} />
          {t("sidebar.ctx.selectTables")}
          <span
            style={{
              color: "var(--muted-foreground)",
              marginLeft: 8,
              fontSize: 13,
              fontWeight: 400,
            }}
          >
            {dbName}
          </span>
        </span>
      }
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      okText={t("settings.save")}
      cancelText={t("settings.reset")}
      confirmLoading={saving}
      width={520}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
          <p style={{ color: "var(--muted-foreground)", marginTop: 12 }}>
            加载中…
          </p>
        </div>
      ) : allTables.length === 0 ? (
        <div className="select-tables-empty">
          <InboxOutlined
            style={{
              fontSize: 48,
              color: "var(--muted-foreground)",
              opacity: 0.4,
            }}
          />
          <p className="select-tables-empty-text">
            {t("sidebar.selectTables.emptyTable")}
          </p>
        </div>
      ) : (
        <div className="select-tables-body">
          {/* ── Search bar ──────────────────────────────── */}
          <Input
            prefix={
              <SearchOutlined style={{ color: "var(--muted-foreground)" }} />
            }
            placeholder={t("sidebar.selectTables.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="select-tables-search"
          />

          {/* ── Toolbar ────────────────────────────────── */}
          <div className="select-tables-toolbar">
            <span className="select-tables-count">
              {t("sidebar.selectTables.selectedCount", {
                count: checked.length,
                total: allTables.length,
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

          {/* ── Table list ────────────────────────────── */}
          <div className="select-tables-list">
            {filtered.length === 0 ? (
              <div className="select-tables-no-match">
                <span>{t("sidebar.selectTables.noMatch")}</span>
              </div>
            ) : (
              filtered.map((name) => {
                const isChecked = checked.includes(name);
                return (
                  <div
                    key={name}
                    className={`select-tables-row${isChecked ? " selected" : ""}`}
                    onClick={() => toggle(name)}
                  >
                    <Checkbox checked={isChecked} />
                    <TableOutlined className="select-tables-row-icon" />
                    <span className="select-tables-row-name">{name}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default SelectTablesModal;
