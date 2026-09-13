import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const scanDirs = ["types", "lib", "components"];

function getFiles(dir) {
  const full = path.join(rootDir, dir);
  if (!fs.existsSync(full)) return [];
  const entries = fs.readdirSync(full, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(res));
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(res);
    }
  }
  return files;
}

const allFiles = scanDirs.flatMap(getFiles);
const adjList = new Map();

for (const file of allFiles) {
  const content = fs.readFileSync(path.join(rootDir, file), "utf-8");
  const imports = [];
  // Match standard import/from patterns
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const impPath = match[1];
    let resolved = null;

    if (impPath.startsWith("@/")) {
      const rel = impPath.replace(/^@\//, "");
      resolved = resolveFile(rel);
    } else if (impPath.startsWith("./") || impPath.startsWith("../")) {
      const dir = path.dirname(file);
      const combined = path.normalize(path.join(dir, impPath)).replace(/\\/g, "/");
      resolved = resolveFile(combined);
    }

    if (resolved && resolved !== file) {
      imports.push(resolved);
    }
  }
  adjList.set(file.replace(/\\/g, "/"), imports);
}

function resolveFile(p) {
  const extensions = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
  if (fs.existsSync(path.join(rootDir, p)) && fs.statSync(path.join(rootDir, p)).isFile()) {
    return p.replace(/\\/g, "/");
  }
  for (const ext of extensions) {
    const trial = p + ext;
    if (fs.existsSync(path.join(rootDir, trial)) && fs.statSync(path.join(rootDir, trial)).isFile()) {
      return trial.replace(/\\/g, "/");
    }
  }
  return null;
}

// DFS cycle detector
const visited = new Map(); // file -> 0: unvisited, 1: visiting, 2: visited
const cycles = [];

function dfs(node, pathStack) {
  visited.set(node, 1);
  pathStack.push(node);

  const neighbors = adjList.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor) || visited.get(neighbor) === 0) {
      dfs(neighbor, pathStack);
    } else if (visited.get(neighbor) === 1) {
      // Cycle detected
      const cycleStart = pathStack.indexOf(neighbor);
      cycles.push([...pathStack.slice(cycleStart), neighbor]);
    }
  }

  pathStack.pop();
  visited.set(node, 2);
}

for (const file of adjList.keys()) {
  if (!visited.has(file) || visited.get(file) === 0) {
    dfs(file, []);
  }
}

if (cycles.length === 0) {
  console.log("PASS: 0 circular dependencies detected across", adjList.size, "files!");
  process.exit(0);
} else {
  console.error("FAIL: Detected cycles:");
  for (const cycle of cycles) {
    console.error("  Cycle:", cycle.join(" -> "));
  }
  process.exit(1);
}
