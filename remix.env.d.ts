/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(location: string, options?: any);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export class StatementSync {
    run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: any[]): Record<string, any> | undefined;
    all(...params: any[]): Array<Record<string, any>>;
  }
}
