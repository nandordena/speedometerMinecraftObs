import fs from "fs";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { parse as parseNbt } from "prismarine-nbt";

const readFile = promisify(fs.readFile);
const __filename = fileURLToPath(import.meta.url);

/**
 * Lee un archivo .dat de Minecraft (formato NBT) y devuelve un objeto JS.
 * @param {string} datPath Ruta absoluta o relativa al archivo .dat (por ejemplo: C:\\Users\\TUusuario\\AppData\\Roaming\\.minecraft\\saves\\Mundo\\playerdata\\<uuid>.dat)
 */
export async function leerDatUsuario(datPath) {
  const absPath = path.isAbsolute(datPath)
    ? datPath
    : path.join(process.cwd(), datPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`No se encontró el archivo .dat en: ${absPath}`);
  }

  const buffer = await readFile(absPath);

  // parseNbt devuelve { parsed, metadata }
  const { parsed } = await parseNbt(buffer);

  // 'parsed' es un árbol NBT; para obtener un objeto JS plano:
  const datos = nbtToPlainObject(parsed);

  return datos;
}

/**
 * Convierte el árbol NBT (con tags) en un objeto JS plano.
 * prismarine-nbt suele devolver algo como { type: 'compound', value: { ... } }
 */
function nbtToPlainObject(node) {
  if (!node || typeof node !== "object") return node;

  if ("value" in node && "type" in node) {
    // Es un tag NBT
    const v = node.value;

    if (Array.isArray(v)) {
      return v.map(nbtToPlainObject);
    }

    if (typeof v === "object" && v !== null) {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = nbtToPlainObject(val);
      }
      return out;
    }

    return v;
  }

  // Objeto JS normal
  const out = {};
  for (const [k, val] of Object.entries(node)) {
    out[k] = nbtToPlainObject(val);
  }
  return out;
}

/**
 * Ejemplo de uso por CLI:
 *   node ./datReader/readUserDat.js "C:\\ruta\\a\\playerdata\\<uuid>.dat"
 */
async function main() {
  const datPath = process.argv[2];

  if (!datPath) {
    console.error(
      "Uso: node ./datReader/readUserDat.js \"C:\\\\ruta\\\\a\\\\playerdata\\\\<uuid>.dat\""
    );
    process.exit(1);
  }

  try {
    const datos = await leerDatUsuario(datPath);

    // Ejemplos de campos típicos de usuario:
    const pos = datos.Pos; // [x, y, z]
    const rot = datos.Rotation; // [yaw, pitch]
    const dimension = datos.Dimension; // depende de la versión
    const health = datos.Health;
    const food = datos.foodLevel ?? datos.FoodLevel;

    console.log("=== Información básica del jugador ===");
    console.log("Posición (Pos):", pos);
    console.log("Rotación (Rotation):", rot);
    console.log("Dimensión (Dimension):", dimension);
    console.log("Vida (Health):", health);
    console.log("Comida (FoodLevel):", food);

    console.log("\n=== Inventario completo (Inventory) ===");
    console.dir(datos.Inventory, { depth: 4 });

    // Si necesitas todo el objeto:
    // console.dir(datos, { depth: null });
  } catch (err) {
    console.error("Error leyendo el archivo .dat:", err.message);
    process.exit(1);
  }
}

// Ejecutar solo si se llama directamente por Node (no cuando se importa como módulo)
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

