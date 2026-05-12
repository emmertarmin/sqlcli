export type QueryExecutionResult = {
  ok: true;
  recordset: Array<Record<string, unknown>>;
  recordsets: Array<Array<Record<string, unknown>>>;
  rowsAffected: number[];
  output: Record<string, unknown>;
};

export type SessionState = {
  pid: number;
  connectionName: string;
  socketPath: string;
  startedAt: string;
};

export type SessionRequest =
  | {
      action: "query";
      statement: string;
    }
  | {
      action: "status";
    }
  | {
      action: "stop";
    };

export type SessionResponse =
  | {
      ok: true;
      result?: QueryExecutionResult;
      state?: SessionState;
      stopped?: true;
    }
  | {
      ok: false;
      error: string;
    };
