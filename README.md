# 360° Video Viewer – Moto

Visor de video 360° interactivo construido con [PlayCanvas Engine](https://github.com/playcanvas/engine). Carga `moto.mp4` automáticamente al abrir el sitio y permite recorrer la escena arrastrando con mouse o dedo.

## Tecnología

| Herramienta | Uso |
|---|---|
| [PlayCanvas Engine 2.21](https://github.com/playcanvas/engine) | Renderizado 3D (WebGL2 / WebGPU) |
| [Vite 5](https://vitejs.dev/) | Servidor de desarrollo y preview |
| [Socket.io 4.7](https://socket.io/) | Sincronización en tiempo real entre visores y el panel de control|
| [Express](https://expressjs.com/) | Servidor del canal entre sync y los archivos estaticos (`control.html`)|
| [ngrok](https://ngrok.com/) | exposición del servidor de sync para pruebas de conexión fuera de la red local|
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) | exposición del sistema para conexión dentro de los visores, para pruebas fuera de la red local|

El engine se carga desde CDN (`cdn.jsdelivr.net`), sin bundling del lado del cliente.

## Requisitos

- Node.js 18+
- npm 9+
- ffmpeg / ffprobe [Opcional] : para verificar o recomprimir videos - ver en sección de notas técnicas

## Instalación

```bash
npm i
```

## Desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador. Vite sirve los archivos estáticos y el video se resuelve directamente en el mismo origen.

## Servidor

```bash
npm run sync
```

Abre `http://localhost:3001` en el navegador.

## Estructura del proyecto

```
nido_viboras/
├── public/
│   ├── BAILE_1.mp4          # Video 360° equirectangular
│   ├── rayo.gif
│   └── test_transparente.webm
├──sync/
│   ├──server.js        # Servidor Express + Socket.IO
│   └──control.html     # Panel de control para el operador
├── index.html          # Visor completo (PlayCanvas + controles)
├── package.json
└── README.md
```

## Cómo funciona

1. **Esfera 360°** – Se crea una esfera de 1000 unidades con la cámara en el centro. La cara interna se renderiza con `CULLFACE_FRONT`.
2. **Video como textura** – El `<video>` se mantiene oculto en el DOM; cada frame se sube a la GPU con `videoTexture.upload()`.
3. **Corrección de espejo** – Al ver desde adentro el eje U quedaría invertido; se corrige con `emissiveMapTiling(-1, 1)` y `emissiveMapOffset(1, 0)`.
4. **Controles** – Drag con mouse o touch modifica `yaw` y `pitch` que se aplican a la cámara con `setEulerAngles`.

## Sincronización entre visores

Experiencia sicnronizada – cuando hay varios visores conectados reproducionedo el video inmersivo, necesitan arrancar todos al mismo tiempo y mantenerse alineados ente sí. Esto se logra con un servidor de sync, hecho aparte (`sync/server.js`) con dos tipos de clientes conectados por Socket.IO:

- **`headset`** – cada visor (`index.html`, que se abre en el visor)
- **`operator`** – el panel de control (`control.html`, que abre en su laptop/pc algun miembro del equipo y que se encarga de disparar el inicio de la inmersion)

## Flujo
1. Cada headset se registra con `socket.emit ('register', 'headset')` y avisa cuando el usuario tocó "Comenzar"(`ready`). 
2. El servidor le avisa a los operadores conectados (`Map` en memoria) el estado actual de todos los visores (`headsets-state`, la cantidad de visores y cuantos estan listos).
3. El operador, aprieta **"Iniciar para todos"** en su panel `control.html` dispara `operator-start`. El servidor calcula un timestamp (`Date.now() + START_START_BUFFER_MS`, buffer de 3 segundos) y se lo manda a TODOS los visores con el evento (`go`), sin importar si estaban "listos" o no La decisión de cuándo arrancar es del operador, no es automática.
4. Cada visor recibe `go` y programa `video.play()` para el instante exacto `startAt` recibido.
5. Mientras el video corre, cada visor compara su `video.currentTime` contra el tiempo esperado (`Date.now() - startAt`) en el evento `timeupdate`, y corrige si hay desvío — así se mantienen alineados aunque alguno se adelante o atrase levemente.
6. Si un visor se conecta o reconecta **después** de que ya arrancó, el servidor le manda `catchup` con la posición actual para que se reconecte en la posicion del video, en vez de arrancar desde cero.
7. El operador puede **"Reiniciar sesión"** (`operator-reset`), que borra el estado de arranque y de "listos" para todos los visor.

### Panel de control (`control.html`)

Se sirve como archivo estático desde el mismo servidor de sync (`express.static(__dirname)` en `server.js`), por lo que se conecta a Socket.IO por el mismo origen sin necesidad de indicar URL (`io()` sin argumentos). Se accede en:

- Local: `http://localhost:3001/control.html`
- Por el túnel de ngrok: `https://<la-url-que-crea-ngrok>/control.html`

Muestra la lista de visores conectados con su estado (Listo / Esperando), un contador resumen, y los botones de Iniciar / Reiniciar sesión.

## Exposición pública (túnel)

Durante pruebas con visores fuera de la red local, el servidor de sync (puerto `3001`) se expone a internet con un túnel. Con dos opciones:

### ngrok

```bash
ngrok http 3001
```

Requiere cuenta gratuita y autenticación una única vez con `ngrok config add-authtoken <token>` (token disponible en el [dashboard de ngrok](https://dashboard.ngrok.com)).

**Limitación importante del plan gratis:** ngrok intercepta el tráfico con una página de advertencia ("Visit Site") antes de dejarlo pasar, incluyendo las peticiones de Socket.IO — esto rompe la conexión con un error de CORS engañoso (`Access-Control-Allow-Origin` faltante), aunque el problema real es que la petición nunca llegó al servidor. Se resuelve agregando el header `ngrok-skip-browser-warning` en el cliente de Socket.IO:

```js
const socket = io(SYNC_SERVER_URL, {
  timeout: 4000,
  extraHeaders: {
    'ngrok-skip-browser-warning': 'true'
  }
})
```

Otra limitación: la URL del túnel gratuito **cambia cada vez que se reinicia** (`ngrok http 3001` genera una nueva cada vez), por lo que hay que actualizar `SYNC_SERVER_URL` en `index.html` después de cada reinicio del túnel.

### Cloudflare Tunnel

Alternativa usada para exponer también el visor (`index.html` vía Vite, puerto `5173`), sin el problema de la página de advertencia de ngrok. Genera URLs del tipo `https://<palabras-random>.trycloudflare.com`. Usado principalmente para entrar a video 360 en los visores

## Controles

| Acción | Efecto |
|---|---|
| Click + arrastrar | Girar la vista |
| Swipe (móvil) | Girar la vista |

## Notas técnicas / troubleshooting

- **Bitrate del video de origen:** un video con bitrate muy alto (detecté un caso de ~165 Mbps, verificable con `ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate,duration,avg_frame_rate -of default=noprint_wrappers=1 BAILE_1.mp4`) superaba el ancho de banda disponible del túnel, causando que el buffer se vacíe siempre en el mismo punto del video para todos los cascos a la vez (todos arrancan sincronizados, así que todos "chocan" contra el mismo límite de descarga al mismo tiempo). Lo resolví recomprimiendo con:

  ```bash
  ffmpeg -i BAILE_1.mp4 -c:v libx264 -preset slow -b:v 12M -maxrate 14M -bufsize 24M -c:a aac -b:a 192k BAILE_1_optimizado.mp4
  ```

  (12 Mbps es un valor de referencia razonable para 1080p; ajustar según resolución y necesidad de calidad.)
