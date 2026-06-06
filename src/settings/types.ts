import type { Locale } from "../i18n/types";

export interface GeneralSettings {
  autoStart: boolean;
  bootStart: boolean;
  minimizeToTray: boolean;
  language: Locale;
  autoUpdate: boolean;
}

export interface BasicSettings {
  queryTimeout: number;
  maxRows: number;
  autoComplete: boolean;
  fontSize: number;
  tabWidth: number;
  showLineNumber: boolean;
  syntaxHighlight: boolean;
  exportFormat: "csv" | "json" | "excel";
}

export interface ModelSettings {
  provider: "openai" | "anthropic" | "deepseek" | "local";
  apiUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  stream: boolean;
  contextMemory: boolean;
}

export interface DataSourceDefaults {
  connectTimeout: number;
  enableSsl: boolean;
  poolSize: number;
}

export type DbType = "mysql" | "redis";

export interface DataSourceConfig {
  id: string;
  name: string;
  dbType: DbType;
  host: string;
  port: number;
  user: string;
  password: string;
  connectTimeout: number;
  enableSsl: boolean;
  /** Optional default database/schema for MySQL connections */
  database?: string;
}

export interface DatasourceSettings {
  defaults: DataSourceDefaults;
  connections: DataSourceConfig[];
}

export interface StyleSettings {
  themeMode: "light" | "dark" | "system";
  themeColor: "blue" | "green" | "purple" | "orange";
  uiFont: "geist" | "inter" | "system";
  monoFont: "mono" | "fira" | "jetbrains";
  fontScale: number;
  sidebarWidth: number;
  compact: boolean;
  animation: boolean;
}

/**
 * Table visibility filter per database.
 * Key: "{datasourceId}:{dbName}", Value: array of visible table names.
 * When empty or missing, all tables are shown.
 */
export type TableVisibility = Record<string, string[]>;

export interface AppSettings {
  general: GeneralSettings;
  basic: BasicSettings;
  model: ModelSettings;
  datasource: DatasourceSettings;
  style: StyleSettings;
  /** Per-database table visibility filter */
  tableVisibility?: TableVisibility;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    autoStart: true,
    bootStart: false,
    minimizeToTray: true,
    language: "zh-CN",
    autoUpdate: true,
  },
  basic: {
    queryTimeout: 30,
    maxRows: 1000,
    autoComplete: true,
    fontSize: 14,
    tabWidth: 2,
    showLineNumber: true,
    syntaxHighlight: true,
    exportFormat: "csv",
  },
  model: {
    provider: "openai",
    apiUrl: "https://api.openai.com/v1",
    apiKey: "",
    modelName: "gpt-4o",
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    stream: true,
    contextMemory: true,
  },
  datasource: {
    defaults: {
      connectTimeout: 10,
      enableSsl: true,
      poolSize: 5,
    },
    connections: [],
  },
  style: {
    themeMode: "light",
    themeColor: "blue",
    uiFont: "geist",
    monoFont: "mono",
    fontScale: 100,
    sidebarWidth: 260,
    compact: false,
    animation: true,
  },
  tableVisibility: {},
};
