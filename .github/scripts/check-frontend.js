const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = "frontend";
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);

// A handful of things that are always available and never listed as a
// dependency: Node/React Native built-ins, and this project's own "@/" alias.
const BUILT_IN = new Set(["react", "react-native"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function packageNameFromImport(spec) {
  // Relative imports and this project's "@/" alias aren't npm packages.
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) return null;
  // Scoped package: @scope/name -> keep both segments.
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  // Plain package: name/sub/path -> just the package name.
  return spec.split("/")[0];
}

const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "src"))];
let failed = false;
const missingByPackage = {};

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parser.parse(code, { sourceType: "module", plugins: ["jsx", "typescript"] });
  } catch (e) {
    failed = true;
    console.log(`SYNTAX ERROR in ${file}: ${e.message}`);
    continue;
  }

  for (const node of ast.program.body) {
    let spec = null;
    if (node.type === "ImportDeclaration") spec = node.source.value;
    // require("...") calls at the top level (rare in this codebase, but cheap to catch)
    if (
      node.type === "ExpressionStatement" &&
      node.expression.type === "CallExpression" &&
      node.expression.callee.name === "require"
    ) {
      const arg = node.expression.arguments[0];
      if (arg && arg.type === "StringLiteral") spec = arg.value;
    }
    if (!spec) continue;

    const pkgName = packageNameFromImport(spec);
    if (!pkgName || BUILT_IN.has(pkgName)) continue;
    if (!declared.has(pkgName)) {
      failed = true;
      (missingByPackage[pkgName] = missingByPackage[pkgName] || []).push(file);
    }
  }
}

for (const [pkgName, usedIn] of Object.entries(missingByPackage)) {
  console.log(`MISSING DEPENDENCY: "${pkgName}" is imported but not in frontend/package.json`);
  for (const f of usedIn) console.log(`  used in ${f}`);
}

if (failed) {
  console.log("\nFrontend check FAILED.");
  process.exit(1);
}
console.log(`Frontend check OK — ${files.length} files parsed, all imports accounted for.`);
