import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { leerDatUsuario } from "./datReader/readUserDat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cargarConfig() {
  const setupPath = path.join(__dirname, "setup.json");

  if (!fs.existsSync(setupPath)) {
    throw new Error(`No se encontró el archivo setup.json en: ${setupPath}`);
  }

  const raw = fs.readFileSync(setupPath, "utf8");

  try {
    const cfg = JSON.parse(raw);
    return cfg;
  } catch (err) {
    throw new Error(
      `No se pudo parsear setup.json como JSON. Asegúrate de que tenga comillas en claves y valores. Detalle: ${err.message}`
    );
  }
}

function construirRutasDesdeConfig(cfg) {
  const savename = cfg.savename;
  const username = cfg.username;
  const saverute = cfg.saverute ?? 0;

  if (!savename || !username) {
    throw new Error(
      "setup.json debe tener al menos 'savename' (nombre del mundo) y 'username' (UUID del jugador)."
    );
  }

  // Por ahora solo soportamos saverute = 0 -> mundo Java en %APPDATA%\.minecraft\saves
  if (saverute !== 0) {
    throw new Error(
      `Valor de 'saverute' no soportado todavía (${saverute}). Usa 0 para Java en %APPDATA%\\.minecraft\\saves.`
    );
  }

  const appdata = process.env.APPDATA;
  if (!appdata) {
    throw new Error(
      "La variable de entorno APPDATA no está definida. No se puede construir la ruta al mundo."
    );
  }

  const worldDir = path.join(appdata, ".minecraft", "saves", savename);
  const playerdataDir = path.join(worldDir, "playerdata");
  const datPath = path.join(playerdataDir, `${username}.dat`);

  const userlogDir = path.join(__dirname, "userlog");
  const logPath = path.join(userlogDir, `${savename}_${username}.csv`);

  return {
    worldDir,
    playerdataDir,
    datPath,
    userlogDir,
    logPath,
  };
}

function formatearFechaHora(fecha) {
  const pad = (n) => String(n).padStart(2, "0");

  const year = fecha.getFullYear();
  const month = pad(fecha.getMonth() + 1);
  const day = pad(fecha.getDate());
  const hours = pad(fecha.getHours());
  const minutes = pad(fecha.getMinutes());
  const seconds = pad(fecha.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function obtenerPosicionDesdeDat(datPath) {
  const datos = await leerDatUsuario(datPath);
  const posRaw = datos.Pos ?? datos.pos;

  if (!posRaw) {
    throw new Error("El archivo .dat no contiene el campo Pos del jugador.");
  }

  let container = posRaw;

  if (
    typeof container === "object" &&
    container !== null &&
    Object.prototype.hasOwnProperty.call(container, "value")
  ) {
    container = container.value;
  }

  let x;
  let y;
  let z;

  if (Array.isArray(container)) {
    [x, y, z] = container;
  } else if (typeof container === "object" && container !== null) {
    x = container[0] ?? container["0"];
    y = container[1] ?? container["1"];
    z = container[2] ?? container["2"];
  }

  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  ) {
    throw new Error(
      "No se pudo interpretar la posición del jugador (Pos) como números x,y,z."
    );
  }

  return { x, y, z };
}

function iniciarServidorEstatico(puerto) {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${puerto}`);
      let pathname = decodeURIComponent(url.pathname);

      if (pathname === "/" || pathname === "/speedometer") {
        pathname = "/speedometer.html";
      }

      const relativePath = pathname.replace(/^\//, "");
      const filePath = path.normalize(path.join(__dirname, relativePath));

      // Pequeña protección para no salirnos de la carpeta del proyecto
      if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".html") contentType = "text/html; charset=utf-8";
      else if (ext === ".js")
        contentType = "text/javascript; charset=utf-8";
      else if (ext === ".css") contentType = "text/css; charset=utf-8";
      else if (ext === ".json")
        contentType = "application/json; charset=utf-8";
      else if (ext === ".csv")
        contentType = "text/csv; charset=utf-8";

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      });
    } catch (err) {
      res.writeHead(500);
      res.end("Internal server error");
    }
  });

  server.listen(puerto, () => {
    console.log(
      `Servidor estático iniciado en http://localhost:${puerto}/speedometer.html`
    );
  });
}

async function iniciarCapturador(cfg, rutas, opciones) {
  if (!fs.existsSync(rutas.playerdataDir)) {
    console.error(
      "La carpeta playerdata no existe. Verifica que el mundo y la ruta sean correctos."
    );
  }

  if (!fs.existsSync(rutas.datPath)) {
    console.error(
      `No se encontró el archivo .dat en: ${rutas.datPath}. Verifica savename y username en setup.json.`
    );
  }

  if (!fs.existsSync(rutas.userlogDir)) {
    fs.mkdirSync(rutas.userlogDir, { recursive: true });
  }

  let ultimaPos = null;

  const intervaloMs = Number(cfg.intervalLog ?? 60000);
  const intervaloValido =
    Number.isFinite(intervaloMs) && intervaloMs > 0 ? intervaloMs : 60000;

  console.log("=== Capturador de posición iniciado ===");
  console.log("Mundo (savename):", cfg.savename);
  console.log("UUID jugador (username):", cfg.username);
  console.log("Intervalo de log (ms):", intervaloValido);
  console.log(
    "Forzar log aunque la posición no cambie:",
    opciones.forceSame ? "SÍ" : "NO"
  );
  console.log("=======================================\n");

  async function tick() {
    try {
      const pos = await obtenerPosicionDesdeDat(rutas.datPath);

      if (
        !opciones.forceSame &&
        ultimaPos &&
        pos.x === ultimaPos.x &&
        pos.y === ultimaPos.y &&
        pos.z === ultimaPos.z
      ) {
        // El juego no ha actualizado la posición; no registramos en el log
        console.log(
          `[${new Date().toLocaleTimeString(
            "es-ES"
          )}] Posición sin cambios, se omite log`
        );
        return;
      }

      ultimaPos = pos;

      const timestamp = formatearFechaHora(new Date());
      const linea = `${timestamp};${pos.x};${pos.y};${pos.z}\n`;
      fs.appendFileSync(rutas.logPath, linea, "utf8");

      console.log(
        `[${new Date().toLocaleTimeString(
          "es-ES"
        )}] Log -> ${timestamp};${pos.x};${pos.y};${pos.z}`
      );
    } catch (err) {
      console.error("Error al registrar posición del jugador:");
      console.error(err.message);
    }
  }

  // Primer log inmediato
  await tick();

  // Logs periódicos
  setInterval(tick, intervaloValido);
}

async function main() {
  const cfg = cargarConfig();
  const rutas = construirRutasDesdeConfig(cfg);

  const puertoServidor = Number(cfg.serverPort ?? 3000);
  const forceSame =
    cfg.forceLogSamePosition === true ||
    process.argv.includes("--force-same");

  // Iniciar servidor estático
  iniciarServidorEstatico(puertoServidor);

  // Iniciar capturador periódico
  await iniciarCapturador(cfg, rutas, { forceSame });

  console.log(
    "Capturador y servidor están activos. Pulsa Ctrl+C para detener."
  );
}

main().catch((err) => {
  console.error("Error al iniciar el sistema:");
  console.error(err.message);
  process.exit(1);
});

