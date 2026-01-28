const { spawn } = require("child_process");

let shuttingDown = false;
const children = [];

function runNpm(prefix) {
  const child = spawn(
    "npm",
    ["--prefix", prefix, "run", "dev"],
    { stdio: "inherit", shell: true }
  );

  child.on("exit", (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const proc of children) {
      if (proc && !proc.killed) proc.kill();
    }
    process.exit(code ?? 0);
  });

  return child;
}

children.push(runNpm("server"));
children.push(runNpm("client"));

process.on("SIGINT", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of children) {
    if (proc && !proc.killed) proc.kill();
  }
  process.exit(0);
});
