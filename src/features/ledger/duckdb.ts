import type { DecryptedEntry } from "./types";

export interface DuckDbSummary {
  version: string;
  entryCount: number;
  topTags: Array<{ tag: string; count: number }>;
  moods: Array<{ mood: string; count: number }>;
}

export async function summarizeWithDuckDb(
  entries: DecryptedEntry[],
): Promise<DuckDbSummary> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker)
    throw new Error("DuckDB worker bundle is unavailable.");
  const worker = new Worker(bundle.mainWorker);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conn = await db.connect();
  const rows = entries.map((entry) => ({
    id: entry.record.id,
    sequence: entry.record.sequence,
    created_at: entry.record.createdAt,
    mood: entry.payload.mood,
    tags: entry.payload.tags.join(","),
    body: entry.payload.body,
  }));

  try {
    await db.registerFileText("entries.json", JSON.stringify(rows));
    await conn.query(
      "CREATE OR REPLACE TABLE entries AS SELECT * FROM read_json_auto('entries.json')",
    );
    const tagRows = await conn.query(`
      SELECT trim(tag) AS tag, count(*)::INTEGER AS count
      FROM entries, unnest(string_split(tags, ',')) AS t(tag)
      WHERE trim(tag) <> ''
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT 8
    `);
    const moodRows = await conn.query(`
      SELECT mood, count(*)::INTEGER AS count
      FROM entries
      GROUP BY mood
      ORDER BY count DESC, mood ASC
    `);
    return {
      version: await db.getVersion(),
      entryCount: entries.length,
      topTags: tableToObjects(tagRows).map((row) => ({
        tag: String(row.tag),
        count: Number(row.count),
      })),
      moods: tableToObjects(moodRows).map((row) => ({
        mood: String(row.mood),
        count: Number(row.count),
      })),
    };
  } finally {
    await conn.close();
    await db.terminate();
  }
}

function tableToObjects(table: {
  toArray(): unknown[];
}): Array<Record<string, unknown>> {
  return table.toArray().map((row) => {
    if (
      row &&
      typeof row === "object" &&
      "toJSON" in row &&
      typeof row.toJSON === "function"
    ) {
      return row.toJSON() as Record<string, unknown>;
    }
    return row as Record<string, unknown>;
  });
}
