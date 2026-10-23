import fs from 'fs'; 
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface Db {
   query<T = any>(text:string, params?:unknown[]): Promise<{rows:T[]; rowCount:number|null}>
}  

// Creating a connection pool.
export function createPool(connectionString: string): Pool {
   return new Pool({connectionString});
}

export function schemaSql(): string {
   return fs.readFileSync(path.join(currentDir, 'schema.sql'), 'utf8');
}

// "Migrating" = setting up the database tables.
export async function migrate(db: Db): Promise<void> {
   await db.query(schemaSql());
}