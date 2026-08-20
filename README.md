# 360° Video Viewer – Moto

Visor de video 360° interactivo construido con [PlayCanvas Engine](https://github.com/playcanvas/engine). Carga `moto.mp4` automáticamente al abrir el sitio y permite recorrer la escena arrastrando con mouse o dedo.

## Tecnología

| Herramienta | Uso |
|---|---|
| [PlayCanvas Engine 2.21](https://github.com/playcanvas/engine) | Renderizado 3D (WebGL2 / WebGPU) |
| [Vite 5](https://vitejs.dev/) | Servidor de desarrollo y preview |

El engine se carga desde CDN (`cdn.jsdelivr.net`), sin bundling del lado del cliente.

## Requisitos

- Node.js 18+
- npm 9+

## Instalación

```bash
npm i
```

## Desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador. Vite sirve los archivos estáticos y el video se resuelve directamente en el mismo origen.

## Preview (build de producción simulado)

```bash
npm run preview
```

## Estructura del proyecto

```
viboras/
├── index.html      # Visor completo (PlayCanvas + controles)
├── moto.mp4        # Video 360° equirectangular
├── package.json
└── README.md
```

## Cómo funciona

1. **Esfera 360°** – Se crea una esfera de 1000 unidades con la cámara en el centro. La cara interna se renderiza con `CULLFACE_FRONT`.
2. **Video como textura** – El `<video>` se mantiene oculto en el DOM; cada frame se sube a la GPU con `videoTexture.upload()`.
3. **Corrección de espejo** – Al ver desde adentro el eje U quedaría invertido; se corrige con `emissiveMapTiling(-1, 1)` y `emissiveMapOffset(1, 0)`.
4. **Controles** – Drag con mouse o touch modifica `yaw` y `pitch` que se aplican a la cámara con `setEulerAngles`.

## Controles

| Acción | Efecto |
|---|---|
| Click + arrastrar | Girar la vista |
| Swipe (móvil) | Girar la vista |
