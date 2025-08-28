# Carroñero de la Zona Cero ☢️ (Live Edition)

> "La conexión con el dron es inestable, pero la cámara funciona. Es hora de ver qué queda ahí fuera... en mi propia habitación."

Un juego de supervivencia e investigación en Realidad Aumentada. El juego utiliza la cámara del dispositivo del usuario para convertir su entorno en la "Zona Cero".

El jugador debe encontrar objetos del mundo real que coincidan con una lista de objetivos, usando un escáner de IA en el navegador que analiza el vídeo en tiempo real. La transmisión de vídeo se altera visualmente para crear una atmósfera post-apocalíptica.

## 🚀 Stack Tecnológico

* **HTML5** (`<video>`, `<canvas>`)
* **CSS3** (Filtros de vídeo en tiempo real, estética retro-futurista)
* **JavaScript (ESM)** y la API **WebRTC (`getUserMedia`)** para el acceso a la cámara.
* **Transformers.js** para la ejecución de modelos de IA en el navegador.
* **Modelo de IA:** `Xenova/mobilenet_v_1.0_224` (auto-alojado) para clasificación de imágenes.
