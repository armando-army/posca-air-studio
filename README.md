# POSCA Air Studio

Web interactiva para dibujar con la mano mediante la cámara.

## Uso

1. Iniciar la web en localhost o en un alojamiento HTTPS.
2. Elegir un color y permitir el uso de la cámara.
3. Juntar pulgar e índice para pintar; separarlos para mover el cursor.
4. Apuntar a colores y botones para seleccionarlos. Los botones también aceptan un clic con los dedos.
5. En Grosor, abrir o cerrar los dedos y confirmar con Listo.
6. Para borrar, mantener los dedos juntos sobre el botón durante dos segundos.

También permite dibujar con mouse o dedo y descargar el dibujo en PNG.

## Abrir en tu computadora

Con Python 3 instalado, ejecutar desde esta carpeta:

```sh
python3 -m http.server 8000
```

Abrir http://localhost:8000 en el navegador. La cámara requiere permiso del navegador. Se necesita conexión a internet para cargar MediaPipe y las fuentes.

## Archivos

- `index.html`: interfaz.
- `style.css`: diseño adaptable.
- `app.js`: dibujo, cámara y controles.
- `gestures.mjs`: reglas de interacción por gestos.
- `assets/`: marcadores y trazo de referencia.

Los marcadores, nombres y logotipos pertenecen a sus respectivos titulares.
