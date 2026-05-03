import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const buildStampPath = resolve("dist/.build-cache-hash");
const buildRoots = ["build", "public", "src"];
const buildFiles = [
  "index.html",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.js",
  "tsconfig.json",
  "vite.config.ts",
];

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<void>}
 */
const run = (command, args) =>
  new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });

const hasBuiltDist = async () => {
  try {
    await access("dist/index.html");
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {string} pathName
 * @param {string[]} [files]
 * @returns {Promise<string[]>}
 */
const collectFiles = async (pathName, files = []) => {
  const entries = await readdir(pathName, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = resolve(pathName, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

export const getBuildFingerprint = async () => {
  const files = [
    ...(await Promise.all(buildRoots.map((root) => collectFiles(root)))).flat(),
    ...buildFiles,
  ]
    .map((filePath) => resolve(filePath))
    .sort();

  const hash = createHash("sha256");
  for (const filePath of files) {
    const content = await readFile(filePath);
    const relativePath = filePath.startsWith(`${process.cwd()}/`)
      ? filePath.slice(process.cwd().length + 1)
      : filePath;
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }

  return hash.digest("hex");
};

export const hasFreshBuild = async () => {
  try {
    const [builtHash, currentHash] = await Promise.all([
      readFile(buildStampPath, "utf8"),
      getBuildFingerprint(),
    ]);
    return (await hasBuiltDist()) && builtHash.trim() === currentHash;
  } catch {
    return false;
  }
};

export const ensureFreshBuild = async () => {
  if (await hasFreshBuild()) return false;

  await run("pnpm", ["build"]);
  const buildHash = await getBuildFingerprint();
  await writeFile(buildStampPath, `${buildHash}\n`);
  return true;
};
