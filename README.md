## Cómo usar (resumen rápido)

- **1. Instalar Node.js** (si aún no lo tienes) desde la web oficial.
- **2. Abrir una terminal** (PowerShell o CMD) en la carpeta del proyecto:

  ```bash
  cd C:\Users\hw1na\GH\speedometerMinecraftObs
  ```

- **3. Instalar dependencias** (solo la primera vez):

  ```bash
  npm install
  ```

- **4. Configurar `setup.json`**  
  Asegúrate de que `savename`, `username` y `intervalLog` están correctos para tu mundo/jugador.

- **5. Iniciar el sistema completo** (capturador + servidor web):

  ```bash
  npm run start:capture
  ```

  - Deja esta ventana abierta mientras uses el velocímetro.
  - El velocímetro se verá en: `http://localhost:3000/speedometer.html`  
    (puedes usar esa URL como fuente de navegador en OBS).

---

## Speedometer Minecraft OBS (capturador de posición)

Este proyecto es un capturador externo que lee los datos del jugador desde los archivos `.dat` de Minecraft Java y genera logs que luego se pueden usar para construir un velocímetro u otros overlays en OBS.

De momento el sistema:
- Lee el archivo `.dat` del jugador configurado.
- Extrae la posición del jugador ($x$, $y$, $z$).
- Guarda la posición periódicamente en un archivo CSV dentro de `userlog/`.
- Ofrece un iniciador que mantiene el capturador funcionando en segundo plano.

Más adelante se podrán añadir otras funciones (cálculo de velocidad, exportar a JSON para OBS, servidor web, etc.).

---

## Requisitos

- **Node.js** (v16 o superior recomendado).
- Minecraft Java instalado (se leen los mundos desde `%APPDATA%\.minecraft\saves`).

---

## Instalación

1. Clonar el repositorio o copiar el proyecto.
2. En una terminal (PowerShell o CMD), ir a la carpeta del proyecto:

```bash
cd C:\Users\hw1na\GH\speedometerMinecraftObs
```

3. Instalar dependencias:

```bash
npm install
```

---

## Configuración (`setup.json`)

El archivo `setup.json` en la raíz del proyecto controla qué mundo y qué jugador se van a leer, y cada cuánto tiempo se registrará la posición.

Ejemplo:

```json
{
  "savename": "Mundo nuevo",
  "username": "946c60ea-d7d2-4b20-831a-3799ad2b234b",
  "saverute": 0,
  "direction": "north",
  "intervalLog": 60000
}
```

- **`savename`**: nombre de la carpeta del mundo dentro de `%APPDATA%\.minecraft\saves` (tiene que coincidir exactamente).
- **`username`**: UUID del jugador, sin `.dat`.  
  - Por ejemplo, si en `playerdata` hay un archivo `946c60ea-d7d2-4b20-831a-3799ad2b234b.dat`, el `username` debe ser `946c60ea-d7d2-4b20-831a-3799ad2b234b`.
- **`saverute`**: por ahora solo se admite `0`, que significa mundo Java en `%APPDATA%\.minecraft\saves`.
- **`direction`**: reservado para futuros usos (por ejemplo, orientación inicial del velocímetro).
- **`intervalLog`**: intervalo en **milisegundos** entre logs de posición.  
  - Ejemplo: `60000` = 60 segundos; `1000` = 1 segundo.

---

## Comandos disponibles (`npm run ...`)

Todos estos comandos se ejecutan desde la carpeta del proyecto.

### 1. Leer datos del jugador desde un `.dat` concreto

```bash
npm run leer:userdat -- "RUTA_COMPLETA_AL_DAT"
```

Ejemplo:

```bash
npm run leer:userdat -- "%appdata%\.minecraft\saves\Mundo nuevo\playerdata\946c60ea-d7d2-4b20-831a-3799ad2b234b.dat"
```

Muestra por consola:
- Posición (`Pos`)
- Rotación (`Rotation`)
- Dimensión (`Dimension`)
- Vida (`Health`)
- Comida (`FoodLevel`)
- Inventario completo (`Inventory`)

### 2. Leer datos usando `setup.json`

```bash
npm run leer:setup
```

Usa `savename` y `username` de `setup.json` para:
- Construir la ruta del `.dat`.
- Leer y mostrar la información básica del jugador.
- Listar los archivos `.dat` disponibles si el configurado no existe.

### 3. Registrar una sola vez la posición en CSV

```bash
npm run log:pos
```

Acciones:
- Lee el archivo `.dat` del jugador configurado.
- Extrae la posición del jugador.
- Crea (si no existe) la carpeta `userlog/` en la raíz del proyecto.
- Crea o actualiza el archivo:

```text
userlog/<savename>_<username>.csv
```

con una línea en el formato:

```text
AAAA-MM-DD HH:mm:ss;x;y;z
```

Ejemplo de línea:

```text
2026-02-16 21:35:12;4.303689278520853;62.11076431274413;51.919732479817554
```

### 4. Iniciar el capturador continuo (iniciador)

```bash
npm run start:capture
```

Este es el **iniciador principal** del capturador de logs.  
Hace lo siguiente:

- Lee `setup.json`.
- Calcula el intervalo de log a partir de `intervalLog` (en ms).
- Realiza un primer log inmediato de la posición.
- Programa logs periódicos que se ejecutan cada `intervalLog` milisegundos.
- Mantiene el proceso en ejecución hasta que lo detengas con `Ctrl + C`.

Este iniciador será el lugar donde, en el futuro, se añadirán:
- Cálculo de velocidad del jugador a partir de los logs.
- Exportación de datos para que OBS los lea (por ejemplo, en JSON o vía servidor web).
- Cualquier otra funcionalidad necesaria para el velocímetro.

---

## Estructura de carpetas relevante

- **`setup.json`**: configuración principal del capturador (mundo, jugador, intervalo de log, etc.).
- **`datReader/`**:
  - `readUserDat.js`: funciones para leer y parsear los archivos `.dat` de Minecraft.
  - `readFromSetup.js`: lectura del `.dat` usando la configuración de `setup.json`.
  - `logPositionFromSetup.js`: lee la posición y la guarda en CSV dentro de `userlog/`.
- **`userlog/`**:
  - Archivos CSV generados con las posiciones del jugador, un log por mundo/jugador.
- **`startCapture.js`**:
  - Iniciador principal que arranca el capturador periódico de posición.

---

## Próximos pasos (ideas)

- Calcular velocidad del jugador (bloques/segundo) a partir de las posiciones registradas.
- Generar archivos JSON o textos simples que OBS pueda leer fácilmente.
- Crear una pequeña interfaz web o overlay HTML para mostrar el velocímetro directamente en OBS como fuente de navegador.
