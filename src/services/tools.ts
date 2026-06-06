import type { ToolDefinition, ParsedToolCall, ChatMessage } from "./types";
import type { DataSourceConfig } from "../settings/types";
import {
  listMysqlTables,
  listMysqlColumns,
  readDocument,
  getMysqlVersion,
  executeQuery,
} from "../db-api";

// ============================================================
// AI Tool System
//
// Defines the tools available to the AI model and handles
// their execution. Each tool is a standalone function so
// they can be tested and extended independently.
// ============================================================

/** Minimal database context needed for tool execution. */
export interface ToolContext {
  datasourceName: string;
  databaseName: string;
  dbType: string;
}

/** Signature of a single tool handler. */
type ToolHandler = (
  tc: ParsedToolCall,
  ctx: ToolContext,
  ds: DataSourceConfig | null,
) => Promise<string>;

// ── Tool definitions ────────────────────────────────────────

/**
 * Build the list of tool definitions exposed to the AI model.
 * Returns an empty array when no MySQL context is available.
 */
export function buildToolDefinitions(
  ctx: ToolContext | null | undefined,
): ToolDefinition[] {
  if (!ctx || ctx.dbType !== "mysql") return [];

  const db = ctx.databaseName;

  return [
    {
      type: "function" as const,
      function: {
        name: "get_database_version",
        description:
          "获取当前 MySQL 数据库服务器的版本信息（如 8.0.35、5.7.42 等），用于判断数据库方言和可用功能。无需参数。",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "list_tables",
        description: `列出当前数据库「${db}」中的所有表。无需参数。`,
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_table_schema",
        description: `获取当前数据库「${db}」中指定表的字段结构信息，包括字段名、类型、是否可空、键类型、默认值。`,
        parameters: {
          type: "object",
          properties: {
            tableName: { type: "string", description: "要查询的表名" },
          },
          required: ["tableName"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_table_document",
        description: `获取当前数据库「${db}」中指定表的技术文档（Markdown 格式），包含表的用途、字段详解、索引分析、关联关系和使用注意事项。`,
        parameters: {
          type: "object",
          properties: {
            tableName: { type: "string", description: "要查询文档的表名" },
          },
          required: ["tableName"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "explain_sql",
        description: `对一条 SQL 语句执行 EXPLAIN 分析，返回 MySQL 优化器的执行计划（包括访问类型、使用的索引、扫描行数、临时表/文件排序等）。用于分析 SQL 性能瓶颈和优化建议。仅支持 SELECT/INSERT/UPDATE/DELETE 语句。`,
        parameters: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "要分析的 SQL 语句（不需要加 EXPLAIN 前缀，系统会自动添加）",
            },
          },
          required: ["sql"],
        },
      },
    },
  ];
}

// ── Individual tool handlers ────────────────────────────────

async function handleGetDatabaseVersion(
  _tc: ParsedToolCall,
  _ctx: ToolContext,
  ds: DataSourceConfig | null,
): Promise<string> {
  if (!ds) return "错误：无法获取数据源配置";
  const version = await getMysqlVersion(ds);
  return `当前 MySQL 服务器版本：${version}`;
}

async function handleListTables(
  _tc: ParsedToolCall,
  ctx: ToolContext,
  ds: DataSourceConfig | null,
): Promise<string> {
  if (!ds) return "错误：无法获取数据源配置";
  const tables = await listMysqlTables(ds, ctx.databaseName);
  return tables.length > 0
    ? `数据库「${ctx.databaseName}」中的表：\n${tables.map((t) => `- ${t}`).join("\n")}`
    : `数据库「${ctx.databaseName}」中没有任何表。`;
}

async function handleGetTableSchema(
  tc: ParsedToolCall,
  ctx: ToolContext,
  ds: DataSourceConfig | null,
): Promise<string> {
  if (!ds) return "错误：无法获取数据源配置";
  const tableName = tc.arguments.tableName as string;
  if (!tableName) return "错误：缺少 tableName 参数";

  const cols = await listMysqlColumns(ds, ctx.databaseName, tableName);
  if (cols.length === 0) return `表「${tableName}」不存在或没有字段。`;

  const rows = cols.map(
    (c) =>
      `- ${c.name} | ${c.colType} | ${c.nullable ? "可空" : "NOT NULL"} | 键:${c.key || "-"} | 默认:${c.default ?? "-"}`,
  );
  return `表「${tableName}」的字段结构：\n${rows.join("\n")}`;
}

async function handleGetTableDocument(
  tc: ParsedToolCall,
  ctx: ToolContext,
  _ds: DataSourceConfig | null,
): Promise<string> {
  const tableName = tc.arguments.tableName as string;
  if (!tableName) return "错误：缺少 tableName 参数";

  try {
    const doc = await readDocument(
      ctx.datasourceName,
      ctx.databaseName,
      tableName,
    );
    return `表「${tableName}」的技术文档：\n\n${doc}`;
  } catch {
    return "表「${tableName}」的文档尚未生成。建议用户在左侧表节点上右键选择「编辑文档」来生成。";
  }
}

async function handleExplainSql(
  tc: ParsedToolCall,
  ctx: ToolContext,
  ds: DataSourceConfig | null,
): Promise<string> {
  if (!ds) return "错误：无法获取数据源配置";
  const sql = tc.arguments.sql as string;
  if (!sql) return "错误：缺少 sql 参数";

  // Remove trailing semicolons to avoid syntax issues when prepending EXPLAIN
  const cleanSql = sql.trim().replace(/;+\s*$/, "");

  // Guard: refuse non-DML/SELECT statements that EXPLAIN cannot handle
  const dangerPattern = /^(DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|SET|USE|FLUSH|KILL|SHUTDOWN)\b/i;
  if (dangerPattern.test(cleanSql)) {
    return `错误：EXPLAIN 不支持 \`${cleanSql.slice(0, 50)}…\` 这类语句。请仅对 SELECT/INSERT/UPDATE/DELETE 语句使用 explain_sql。`;
  }

  try {
    const result = await executeQuery(
      ds,
      ctx.databaseName,
      `EXPLAIN ${cleanSql}`,
      100,
      15,
    );

    if (result.columns.length === 0 || result.rows.length === 0) {
      return "该语句的 EXPLAIN 未返回任何结果，可能是语句语法有误或数据库不支持对此类语句执行 EXPLAIN。";
    }

    // Build a formatted text table for the AI to analyze
    const colNames = result.columns.map((c) => c.name);
    const rows = result.rows.map((row) =>
      row.map((v) => (v === null ? "NULL" : String(v))),
    );

    // Column widths
    const widths = colNames.map((name, ci) =>
      Math.max(name.length, ...rows.map((r) => r[ci].length)),
    );

    const padRight = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));
    const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
    const header =
      "| " + colNames.map((n, i) => padRight(n, widths[i])).join(" | ") + " |";
    const body = rows
      .map((r) => "| " + r.map((v, i) => padRight(v, widths[i])).join(" | ") + " |")
      .join("\n");

    const formattedTable = [sep, header, sep, body, sep].join("\n");

    // Key columns to call out (MySQL standard EXPLAIN fields)
    const hasKeyCol = colNames.includes("key");
    const hasTypeCol = colNames.includes("type");
    const hasRowsCol = colNames.includes("rows");
    const hasExtraCol = colNames.includes("Extra");

    let summary = "";
    if (hasTypeCol || hasKeyCol || hasRowsCol || hasExtraCol) {
      summary = "\n\n📊 **关键指标说明**：";
      if (hasTypeCol) summary += "\n- `type`: 访问类型（ALL=全表扫描 ⚠️, index=索引全扫, range=范围扫描, ref=非唯一索引查找, eq_ref=唯一索引查找, const=常量。越靠后越好）";
      if (hasKeyCol) summary += "\n- `key`: 实际使用的索引（NULL 表示未使用索引 ⚠️）";
      if (hasRowsCol) summary += "\n- `rows`: 优化器预估需要扫描的行数（越大越慢）";
      if (hasExtraCol) summary += "\n- `Extra`: 额外信息（Using filesort/Using temporary 表示需要优化 ⚠️, Using index 表示覆盖索引 ✅）";
    }

    return (
      `SQL 语句 \`${cleanSql.length > 120 ? cleanSql.slice(0, 120) + "…" : cleanSql}\` 的 EXPLAIN 执行计划：\n\n` +
      formattedTable +
      summary
    );
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return `EXPLAIN 执行失败: ${errMsg}`;
  }
}

// ── Tool registry ───────────────────────────────────────────

const toolRegistry: Record<string, ToolHandler> = {
  get_database_version: handleGetDatabaseVersion,
  list_tables: handleListTables,
  get_table_schema: handleGetTableSchema,
  get_table_document: handleGetTableDocument,
  explain_sql: handleExplainSql,
};

// ── Public execution entry ──────────────────────────────────

/**
 * Execute a batch of tool calls and return result messages.
 * Each handler is looked up from the registry and invoked directly.
 */
export async function executeToolCalls(
  toolCalls: ParsedToolCall[],
  ctx: ToolContext,
  ds: DataSourceConfig | null,
): Promise<ChatMessage[]> {
  const results: ChatMessage[] = [];

  for (const tc of toolCalls) {
    const handler = toolRegistry[tc.name];
    let content: string;
    try {
      content = handler ? await handler(tc, ctx, ds) : `未知工具: ${tc.name}`;
    } catch (e) {
      content = `工具调用失败: ${e}`;
    }
    results.push({ role: "tool", tool_call_id: tc.id, content });
  }

  return results;
}
