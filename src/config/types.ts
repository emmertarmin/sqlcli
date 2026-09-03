export type ConnectionConfig = {
  server: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    serverName?: string;
  };
};

export type AppConfig = {
  version: 1;
  connections: Record<string, ConnectionConfig>;
};
