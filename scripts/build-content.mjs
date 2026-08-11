// Empaqueta los HTML de content/ en módulos TypeScript importables desde /api.
//
// Por qué no fs.readFileSync: el bundler de funciones de Vercel no garantiza que
// un archivo suelto llegue al bundle — habría que configurar includeFiles y
// confiar en que process.cwd() apunte donde uno espera. Un import estático no se
// puede perder.
//
// Por qué base64 y no un template literal: el HTML tiene 38 KB con backticks y
// secuencias ${ que habría que escapar. Base64 no puede romper la sintaxis.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENIDOS = [
  {
    origen: "content/guia-vendedores.html",
    destino: "api/_content/guia-vendedores.ts",
    exporta: "GUIA_VENDEDORES_B64",
  },
];

mkdirSync(resolve(raiz, "api/_content"), { recursive: true });

for (const { origen, destino, exporta } of CONTENIDOS) {
  const bytes = readFileSync(resolve(raiz, origen));
  const salida =
    `// Generado por scripts/build-content.mjs — no editar a mano.\n` +
    `// Fuente: ${origen}\n` +
    `export const ${exporta} =\n  "${bytes.toString("base64")}";\n`;
  writeFileSync(resolve(raiz, destino), salida);
  console.log(`${origen} → ${destino} (${bytes.length} bytes)`);
}
