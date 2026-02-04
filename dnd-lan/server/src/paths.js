import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..");
export const repoRoot = path.resolve(serverRoot, "..");
export const uploadsDir = process.env.DND_LAN_UPLOADS_DIR
  ? path.resolve(process.env.DND_LAN_UPLOADS_DIR)
  : path.join(serverRoot, "uploads");
export const publicDir = path.join(serverRoot, "public");
