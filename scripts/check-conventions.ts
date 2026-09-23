import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

const ROOT = "src"
const MAX_LINES = 300
const SKIP = new Set(["src/routeTree.gen.ts"])
const EXT = /\.(ts|tsx|css)$/
const PASCAL = /^[A-Z][A-Za-z0-9]*$/
const WRAPPERS = new Set(["memo", "forwardRef", "React.memo", "React.forwardRef"])

const files = (readdirSync(ROOT, { recursive: true }) as string[])
  .map((f) => join(ROOT, f))
  .filter((f) => EXT.test(f) && !SKIP.has(f))

const isComponentInit = (init: ts.Expression | undefined): boolean => {
  if (!init) {
    return false
  }
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
    return true
  }
  return ts.isCallExpression(init) && WRAPPERS.has(init.expression.getText())
}

export function componentsIn(path: string, source: string): string[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names: string[] = []
  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && PASCAL.test(node.name.text)) {
      names.push(node.name.text)
    }
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && PASCAL.test(d.name.text) && isComponentInit(d.initializer)) {
          names.push(d.name.text)
        }
      }
    }
  }
  return names
}

const errors: string[] = []
for (const file of files) {
  const source = readFileSync(file, "utf8")
  const lines = source.split("\n").length - (source.endsWith("\n") ? 1 : 0)
  if (lines > MAX_LINES) {
    errors.push(`${file}: ${lines} lines (max ${MAX_LINES}) - split it by component/responsibility`)
  }
  if (file.endsWith(".tsx")) {
    const components = componentsIn(file, source)
    if (components.length > 1) {
      errors.push(`${file}: ${components.length} components (${components.join(", ")}) - one component per file`)
    }
    const isRoute = relative(ROOT, file).startsWith("routes")
    if (!isRoute && components.length === 1 && !file.endsWith(`/${components[0]}.tsx`)) {
      errors.push(`${file}: file must be named after its component (${components[0]}.tsx)`)
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n\n${errors.length} convention error(s)\n`)
  process.exit(1)
}
process.stdout.write(`Conventions OK (${files.length} files)\n`)
