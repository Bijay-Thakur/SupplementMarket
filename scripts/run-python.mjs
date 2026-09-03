import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(repoRoot, "backend");
const venvPy =
  process.platform === "win32"
    ? path.join(backend, ".venv", "Scripts", "python.exe")
    : path.join(backend, ".venv", "bin", "python");
const py = existsSync(venvPy) ? venvPy : "python";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-python.mjs <args...>");
  process.exit(1);
}

const child = spawn(py, args, { cwd: backend, stdio: "inherit", shell: false });
child.on("exit", (code) => process.exit(code ?? 1));
