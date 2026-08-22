import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Persist a binary Kimai response to the OS temp directory and return its path.
 *
 * MCP tool results are text, so a rendered invoice cannot be returned inline
 * without base64-inflating it into the model's context. Writing it to disk and
 * handing back a path keeps the response small and lets the user open the file
 * with a normal application. Mirrors the mutation-backup convention.
 */
export async function writeDownload(name: string, data: Buffer): Promise<string> {
  const directory = join(tmpdir(), "kimai-mcp-downloads");
  await mkdir(directory, { recursive: true });

  const safeName = name.replace(/[^a-z0-9._-]+/gi, "-");
  const fullPath = join(directory, safeName);
  await writeFile(fullPath, data);

  return fullPath;
}
