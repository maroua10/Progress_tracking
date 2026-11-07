// Adapter keeps existing prepared queries and atomic publication batches intact.
// Values are always bound parameters; SQL comes exclusively from server code.
export type QueryResult = { rows: any[]; count: number };
export type Execute = (query: string, args: any[]) => Promise<QueryResult>;
export type Transaction = <T>(fn: (execute: Execute) => Promise<T>) => Promise<T>;
export function postgresQuery(sql: string) {
  let index = 0;
  const ignore = /^\s*INSERT OR IGNORE\b/i.test(sql);
  const query = sql.replace(/INSERT OR IGNORE/gi, 'INSERT')
    .replace(/MAX\(report_views.seq,excluded.seq\)/g, 'GREATEST(report_views.seq,excluded.seq)')
    .replace(/\?/g, () => '$' + (++index));
  return ignore ? query.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING') : query;
}
export function createDatabase(execute: Execute, transaction: Transaction) {
  class Statement {
    constructor(readonly sql: string, readonly args: any[] = []) {}
    bind(...args: any[]) { return new Statement(this.sql, args); }
    async result(run = execute) {
      const result = await run(postgresQuery(this.sql), this.args);
      return { results: result.rows, meta: { changes: result.count } };
    }
    all<T = any>(): Promise<{ results: T[]; meta: { changes: number } }> { return this.result(); }
    async first<T = any>(): Promise<T | null> { return (await this.all<T>()).results[0] ?? null; }
    run() { return this.result(); }
  }
  return {
    prepare(sql: string) { return new Statement(sql); },
    batch(statements: Statement[]) {
      return transaction(async run => {
        const results = [];
        for (const statement of statements) results.push(await statement.result(run));
        return results;
      });
    },
  };
}
