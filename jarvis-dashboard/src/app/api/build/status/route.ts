import { readFileSync, existsSync } from "fs";
import { join } from "path";

const BUILD_LOG_PATH = join(process.cwd(), ".build-log.json");

export async function GET() {
  try {
    if (!existsSync(BUILD_LOG_PATH)) {
      return Response.json({ builds: [] });
    }

    const log = JSON.parse(readFileSync(BUILD_LOG_PATH, "utf-8"));
    const recent = Array.isArray(log) ? log.slice(0, 5) : [];

    return Response.json({ builds: recent });
  } catch {
    return Response.json({ builds: [] });
  }
}
