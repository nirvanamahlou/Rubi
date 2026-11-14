import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Pool, types } from 'pg';
import { type AgentSource } from './catalog';
import { validateAgentSql } from './sql-policy';

export type AgentScope = {
  userId: string;
  branchIds: readonly string[];
  mode: 'all' | 'branch' | 'own';
  companyId: string | null;
  payments: boolean;
};

@Injectable()
export class SalesAgentQueryService implements OnModuleDestroy, OnModuleInit {
  private pool?: Pool;
  async onModuleInit() {
    if (process.env.ASSISTANT_AGENT_ENABLED === 'true')
      await this.query(
        'SELECT count(*) AS total FROM contracts',
        {
          userId: 'startup',
          branchIds: [],
          mode: 'own',
          companyId: null,
          payments: false,
        },
        ['contracts'],
      );
  }
  private getPool() {
    if (
      process.env.ASSISTANT_AGENT_ENABLED !== 'true' ||
      !process.env.ASSISTANT_AGENT_DATABASE_URL
    )
      throw new Error('AGENT_DATABASE_DISABLED');
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: process.env.ASSISTANT_AGENT_DATABASE_URL,
        max: 4,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        statement_timeout: 5000,
        query_timeout: 6000,
        options:
          '-c default_transaction_read_only=on -c search_path=pg_catalog -c idle_in_transaction_session_timeout=8000',
        types: {
          getTypeParser: (oid, format) =>
            oid === 1082 || oid === 1700 || oid === 20
              ? (value: string) => value
              : types.getTypeParser(oid, format),
        },
      });
      this.pool.on('error', () =>
        process.stderr.write('AGENT_DATABASE_IDLE_CONNECTION_ERROR\n'),
      );
    }
    return this.pool;
  }

  async query(
    input: unknown,
    scope: AgentScope,
    sources: readonly AgentSource[],
  ) {
    const checked = validateAgentSql(input, sources);
    const pool = this.getPool();
    if (pool.waitingCount >= 8) throw new Error('AGENT_DATABASE_BUSY');
    const connection = await pool.connect();
    let broken = false;
    try {
      // Runtime admission check: neither this login nor inherited roles may own
      // source tables or have a base-table grant. Do not run with the ERP pool.
      const admission = await connection.query<{ safe: boolean }>(`
        SELECT NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_roles r WHERE pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')
          AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb)
        ) AND pg_catalog.pg_has_role(current_user, 'nora_agent_reader', 'USAGE')
        AND NOT pg_catalog.pg_has_role(current_user, 'nora_agent_view_owner', 'MEMBER')
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema','nora_agent')
          AND c.relkind IN ('r','p','v','m','f') AND pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        ) AND pg_catalog.current_setting('default_transaction_read_only')='on'
          AND pg_catalog.current_setting('search_path')='pg_catalog' AS safe`);
      if (admission.rows[0]?.safe !== true)
        throw new Error('AGENT_DATABASE_ROLE_UNSAFE');
      await connection.query('BEGIN READ ONLY');
      await connection.query(
        "SELECT pg_catalog.set_config('nora_agent.scope', $1, true)",
        [JSON.stringify(scope)],
      );
      const started = Date.now();
      const result = await connection.query(
        `SELECT * FROM (${checked.sql.replace(/;\s*$/, '')}) AS nora_result LIMIT 201`,
      );
      await connection.query('ROLLBACK');
      const rows: Record<string, unknown>[] = [];
      let bytes = 0;
      for (const row of result.rows.slice(0, 200)) {
        const encoded = JSON.stringify(row);
        bytes += Buffer.byteLength(encoded);
        if (bytes > 120 * 1024) break;
        rows.push(row as Record<string, unknown>);
      }
      // Duplicate aliases would silently overwrite fields in node-postgres.
      const columns = result.fields.map((field) => field.name);
      if (new Set(columns).size !== columns.length)
        throw new Error('DUPLICATE_RESULT_COLUMNS');
      return {
        version: 1,
        resultId: randomUUID(),
        observedAt: new Date().toISOString(),
        columns,
        rows,
        truncated: result.rows.length > rows.length,
        sources: checked.sources,
        durationMs: Date.now() - started,
        queryHash: createHash('sha256').update(checked.sql).digest('hex'),
      };
    } catch (error) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        broken = true;
      }
      throw error;
    } finally {
      connection.release(broken);
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
