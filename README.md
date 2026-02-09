# Servidor MCP de Jules

Servidor del Protocolo de Contexto de Modelo (MCP) para el agente de codificación Jules AI de Google. Permite que asistentes de IA como Claude creen y gestionen tareas de codificación asíncronas a través de la API de Jules.

## Descripción General

Jules es el agente de codificación AI de Google que ejecuta tareas de desarrollo en VMs aisladas en la nube. Este servidor MCP expone la funcionalidad de Jules a través de 11 herramientas estandarizadas que los asistentes de IA pueden descubrir e invocar automáticamente.

**Lo que Jules puede hacer:**
- Generar código desde descripciones en lenguaje natural
- Corregir errores incluyendo condiciones de carrera y errores lógicos
- Crear suites de pruebas completas con mocking
- Actualizar dependencias y manejar cambios incompatibles
- Refactorizar código en múltiples archivos
- Buscar documentación y realizar revisiones de código

Las tareas se ejecutan de forma asíncrona y típicamente se completan en 5-60 minutos dependiendo de la complejidad.

## Requisitos Previos

1. **Cuenta de Google** con acceso a Jules
2. **API Key de Jules** - Obtener desde https://jules.google.com/settings#api (hasta 3 keys permitidas)
3. **Integración con GitHub** - Instalar la aplicación GitHub de Jules en https://jules.google.com para conectar repositorios
4. **Node.js** 18+ instalado en tu sistema

## Inicio Rápido

### 1. Instalación

```bash
cd jules-mcp-server
npm install
npm run build
```

### 2. Configurar API Key

Crea un archivo `.env` (nunca lo subas a git):

```bash
cp .env.example .env
# Edita .env y agrega tu API key de Jules
```

O pasa la key directamente en la configuración de Claude Desktop (recomendado - ver abajo).

### 3. Configurar Claude Desktop

Edita tu archivo de configuración de Claude Desktop:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Agrega esta configuración:

```json
{
  "mcpServers": {
    "jules": {
      "command": "node",
      "args": ["/ruta/absoluta/a/jules-mcp-server/build/index.js"],
      "env": {
        "JULES_API_KEY": "tu_api_key_real_aquí"
      }
    }
  }
}
```

**Importante:**
- Usa la ruta absoluta a `build/index.js` (no relativa)
- Reemplaza `tu_api_key_real_aquí` con tu API key real
- Reinicia Claude Desktop completamente después de hacer cambios

### 4. Verificar Instalación

1. Reinicia Claude Desktop
2. Busca el ícono 🔌 en la interfaz de Claude
3. Deberías ver el servidor "jules" con 11 herramientas disponibles
4. Intenta preguntar a Claude: "Muéstrame mis repositorios de Jules"

## Uso Remoto (Cloudflare Workers)

El servidor MCP también está disponible como Worker remoto en Cloudflare, ideal para:
- Uso desde cualquier dispositivo sin instalación local
- Integración con MCP Inspector y AI Playground
- Despliegues personalizados en tu cuenta de Cloudflare

### URL del Worker Público

```
https://jules-mcp-server.micuenta-maicolcursor.workers.dev
```

### Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check (status, versión, herramientas) |
| `/sse` | GET | Conexión SSE para clientes MCP |
| `/message` | POST | Mensajes JSON-RPC |

### Conectar con MCP Inspector

1. Ejecuta el inspector:
   ```bash
   npx @modelcontextprotocol/inspector@latest
   ```
2. Abre http://localhost:6274
3. Selecciona tipo de transporte: `SSE`
4. Ingresa la URL: `https://jules-mcp-server.micuenta-maicolcursor.workers.dev/sse`
5. Click en **Connect**
6. Las 11 herramientas aparecerán en la pestaña **Tools**

### Conectar con Claude Desktop (via mcp-remote)

Para usar el Worker remoto desde Claude Desktop, necesitas el proxy `mcp-remote`:

```json
{
  "mcpServers": {
    "jules-remote": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://jules-mcp-server.micuenta-maicolcursor.workers.dev/sse"]
    }
  }
}
```

### Desplegar tu Propio Worker

1. **Clonar y configurar:**
   ```bash
   git clone https://github.com/tu-usuario/jules-mcp-server
   cd jules-mcp-server
   npm install
   npm run build
   ```

2. **Login en Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Configurar secreto:**
   ```bash
   npx wrangler secret put JULES_API_KEY
   # Pega tu API key cuando te lo pida
   ```

4. **Desplegar:**
   ```bash
   npx wrangler deploy
   ```

Tu Worker estará disponible en: `https://jules-mcp-server.[tu-cuenta].workers.dev`

## Despliegue en ChatGPT (OpenAI)

Este servidor soporta dos métodos de integración con ChatGPT:

### Método A: Conector Nativo MCP (Recomendado)

Utiliza el soporte nativo de MCP en ChatGPT (disponible en planes Plus/Team/Enterprise).

1. Ve a **Settings > Connectors**.
2. Haz clic en **Add Custom Connector**.
3. Ingresa la URL de tu endpoint SSE:
   ```
   https://jules-mcp-server.micuenta-maicolcursor.workers.dev/sse
   ```
4. Sigue las instrucciones para autorizar/conectar.

### Método B: GPT Action (REST / OpenAPI)

Si no tienes acceso a Connectors o prefieres crear un GPT personalizado "clásico".

1. Ve a [chatgpt.com/create](https://chatgpt.com/create)
2. En **Configure > Actions**, selecciona **Create new action**.
3. Elige **Import from URL** y pega:
   ```
   https://jules-mcp-server.micuenta-maicolcursor.workers.dev/openapi.json
   ```
4. Haz clic en **Import**.
5. Las 11 acciones aparecerán listadas. Guarda el GPT.

> **Nota:** La autenticación se maneja internamente en el Worker con tu `JULES_API_KEY`, por lo que no necesitas configurar auth adicional en ChatGPT a menos que quieras proteger tu Worker.

## Herramientas Disponibles

### 1. `jules_list_sources`
Lista todos los repositorios de GitHub conectados a Jules.

**Ejemplo:** "Muéstrame mis repositorios de Jules"

**Parámetros opcionales:**
- `filter` - Expresión de filtro AIP-160 para filtrar por nombre

---

### 2. `jules_get_source`
Obtiene detalles de un repositorio específico.

**Ejemplo:** "Dame información del source github-miorg-mirepo"

---

### 3. `jules_create_session`
Inicia una nueva tarea de codificación asíncrona.

**Parámetros:**
- `repoOwner` - Propietario del repositorio GitHub (usuario u organización)
- `repoName` - Nombre del repositorio
- `prompt` - Descripción detallada de la tarea
- `branch` - Rama inicial (predeterminado: "main")
- `automationMode` - Modo de automatización: "AUTO_CREATE_PR" para crear PR automáticamente
- `autoApprove` - [Obsoleto] Aprobar plan automáticamente (predeterminado: true)
- `autoCreatePR` - [Obsoleto] Crear PR automáticamente (predeterminado: false)

**Ejemplo:** "Crea una sesión de Jules para miorg/mirepo para agregar pruebas unitarias al módulo de autenticación"

---

### 4. `jules_list_sessions`
Lista todas tus sesiones de Jules con sus estados.

**Ejemplo:** "Muéstrame todas mis sesiones de Jules"

---

### 5. `jules_get_status`
Verifica el estado de la sesión y la actividad reciente. Úsala para monitorear progreso.

**Ejemplo:** "Verifica el estado de la sesión de Jules abc123"

---

### 6. `jules_send_message`
Envía un mensaje de seguimiento a una sesión en ejecución.

**Ejemplo:** "Dile a la sesión de Jules abc123 que también agregue manejo de errores"

---

### 7. `jules_get_activity`
Obtiene una actividad específica con todos sus detalles.

**Ejemplo:** "Muéstrame la actividad xyz de la sesión abc123"

---

### 8. `jules_list_activities`
Obtiene el registro detallado de actividades incluyendo pasos del plan y actualizaciones de progreso.

**Ejemplo:** "Muéstrame las actividades detalladas de la sesión abc123"

---

### 9. `jules_approve_plan`
Aprueba el plan de ejecución (solo necesario si `autoApprove=false`).

**Ejemplo:** "Aprueba el plan de la sesión de Jules abc123"

---

### 10. `jules_get_session_output`
Recupera los resultados finales y la URL del PR de una sesión completada.

**Ejemplo:** "Obtén los resultados de la sesión de Jules abc123"

---

### 11. `jules_delete_session`
Elimina una sesión de Jules permanentemente.

**Ejemplo:** "Elimina la sesión de Jules abc123"

## Guía de Uso para Desarrolladores

### Flujo de Trabajo Básico

```
Tú: "Necesito agregar pruebas de autenticación a mi proyecto"

Claude: Te ayudaré a crear una sesión de Jules para eso.
[Usa jules_list_sources para encontrar tus repos]
[Usa jules_create_session con tus requisitos]

Claude: ¡Sesión creada! ID: ses_abc123. Jules está trabajando en esta tarea.
Verificaré de nuevo en 30 segundos.
[Espera, luego usa jules_get_status periódicamente]

Claude: ¡Jules completó la tarea! Aquí está el pull request: [URL]
```

### Flujo con Aprobación Manual del Plan

```
Tú: "Crea una sesión de Jules para refactorizar la capa de base de datos, 
     pero quiero aprobar el plan primero"

Claude: Crearé una sesión con aprobación manual.
[Usa jules_create_session con autoApprove=false]

Claude: Sesión creada y esperando aprobación del plan.
[Usa jules_list_activities para mostrar el plan]

Tú: "Se ve bien, apruébalo"

Claude: [Usa jules_approve_plan]
¡Plan aprobado! Jules ahora está ejecutando.
```

### Enviar Instrucciones de Seguimiento

```
Tú: "Revisa mi sesión de Jules ses_abc123"

Claude: [Usa jules_get_status]
Jules está trabajando en agregar pruebas. Actualmente implementando pruebas de auth.

Tú: "Dile a Jules que también agregue pruebas de integración"

Claude: [Usa jules_send_message]
Mensaje enviado. Jules incorporará esto en los siguientes pasos.
```

### Filtrar Repositorios

```
Tú: "Muéstrame solo el repositorio github-miorg-backend"

Claude: [Usa jules_list_sources con filter="name=sources/github-miorg-backend"]
```

## Límites de Uso y Cuotas

Jules aplica cuotas de tareas basadas en el nivel de suscripción:

- **Gratis**: 15 tareas diarias, 3 tareas concurrentes
- **Google AI Pro** ($19.99/mes): ~75 tareas diarias, 15 tareas concurrentes
- **Google AI Ultra** ($124.99/mes): ~300 tareas diarias, 60 tareas concurrentes

Las tareas cuentan contra tu cuota incluso si fallan. La cuota se reinicia en una ventana móvil de 24 horas.

## Patrón de Flujo Asíncrono

Las sesiones de Jules se ejecutan de forma asíncrona en VMs en la nube. El flujo típico:

1. **Crear sesión** - Retorna inmediatamente con el ID de sesión
2. **Consultar estado** - Verificar cada 10-30 segundos usando `jules_get_status`
3. **Monitorear actividades** - Ver progreso detallado con `jules_list_activities`
4. **Recuperar resultados** - Obtener URL del PR cuando el estado sea COMPLETED

Claude maneja este polling automáticamente cuando le pides monitorear una tarea.

## Solución de Problemas

### Las herramientas no aparecen en Claude Desktop

1. Verifica la ruta absoluta en la configuración (no relativa)
2. Comprueba que `build/index.js` existe después de ejecutar `npm run build`
3. Asegúrate de que la API key esté configurada correctamente
4. Reinicia Claude Desktop completamente (no solo recargar)
5. Revisa los logs de la consola para mensajes de error

### Error "La variable de entorno JULES_API_KEY es requerida"

- API key no configurada en la config de Claude Desktop
- Asegúrate de que el objeto `env` en la config contenga `JULES_API_KEY`

### Error "No hay repositorios conectados a Jules"

1. Visita https://jules.google.com
2. Haz clic en "Conectar cuenta de GitHub"
3. Autoriza la aplicación GitHub de Jules
4. Selecciona los repositorios a los que dar acceso
5. Refresca la aplicación web de Jules para sincronizar

### La sesión falla inmediatamente

- Verifica que el repositorio esté conectado a Jules
- Confirma que el nombre de la rama existe
- Asegúrate de que el repositorio tenga los permisos adecuados
- Revisa la interfaz web de Jules para mensajes de error detallados

### Errores de API (401, 403, 404)

- **401**: API key inválida - regenerar en https://jules.google.com/settings#api
- **403**: Permisos insuficientes o cuota excedida
- **404**: ID de sesión o repositorio no encontrado

## Desarrollo

### Ejecutar en Modo Desarrollo

```bash
npm run dev  # Modo watch - reconstruye en cambios
```

### Probar con MCP Inspector

```bash
npm run inspector
```

Esto abre una interfaz web donde puedes probar herramientas interactivamente sin Claude Desktop.

### Estructura del Proyecto

```
jules-mcp-server/
├── src/
│   ├── index.ts      # Servidor principal e implementación de herramientas
│   ├── client.ts     # Cliente auxiliar de la API de Jules
│   └── types.ts      # Definiciones de tipos TypeScript
├── build/            # JavaScript compilado (ignorado por git)
├── package.json      # Dependencias y scripts
├── tsconfig.json     # Configuración de TypeScript
└── .env              # API key (ignorado por git, crear desde .env.example)
```

### Agregar Nuevas Herramientas

1. Define los tipos en `src/types.ts`
2. Agrega el registro de la herramienta en `src/index.ts` siguiendo el patrón existente
3. Usa esquemas Zod para validación de entrada
4. Envuelve la implementación en try-catch con respuestas de error apropiadas
5. Reconstruye: `npm run build`

## Mejores Prácticas de Seguridad

1. **Nunca subas API keys** - Usa `.env` o la config de Claude Desktop únicamente
2. **Usa .gitignore** - Asegúrate de que `.env` y `build/` estén excluidos
3. **Rota las keys regularmente** - Regenera en https://jules.google.com/settings#api
4. **Monitorea el uso** - Revisa la interfaz web de Jules para actividad inesperada
5. **Limita el acceso a repositorios** - Solo da acceso a Jules a los repos necesarios

## Consejos de Configuración de Claude Desktop

**Usa rutas absolutas:**
```json
✅ "/Users/usuario/jules-mcp-server/build/index.js"
❌ "~/jules-mcp-server/build/index.js"
❌ "./jules-mcp-server/build/index.js"
```

**Múltiples servidores:**
```json
{
  "mcpServers": {
    "jules": { ... },
    "otro-servidor": { ... }
  }
}
```

**Logs de depuración:**
Revisa los logs de Claude Desktop:
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`

## Referencia de la API

Este servidor implementa la API de Jules v1alpha:
- **URL Base**: `https://jules.googleapis.com/v1alpha`
- **Autenticación**: Header `X-Goog-Api-Key`
- **Documentación**: https://jules.google/docs/api/reference/overview

## Recursos

- **Interfaz Web de Jules**: https://jules.google.com
- **Obtener API Key**: https://jules.google.com/settings#api
- **Conectar GitHub**: https://jules.google.com (sección de integración con GitHub)
- **Documentación MCP**: https://modelcontextprotocol.io
- **Claude Desktop**: https://claude.ai/download

## Licencia

MIT

## Contribuir

¡Las contribuciones son bienvenidas! Por favor asegúrate de:
- TypeScript compile sin errores
- Todas las herramientas sigan el patrón de manejo de errores
- La documentación esté actualizada para nuevas características
- No haya API keys o secretos en los commits

## Changelog

### v1.2.2 (2026-02-09)
- **Corregido:** Detección de Pull Requests — la API devuelve `outputs[]` con múltiples elementos (`changeSet` + `pullRequest`); antes solo se miraba `outputs[0]`, ahora se busca en **todos** los outputs con `.find()`
- **Cambiado:** `automationMode` ahora es `AUTO_CREATE_PR` por defecto — Jules siempre creará PRs automáticamente
- **Nuevo:** Tipos `ChangeSet` y `GitPatch` para representar la estructura real de la API
- **Nuevo:** Commit sugerido mostrado junto a la información del PR en `jules_get_session_output`
- **Nuevo:** Debug dump de `outputs` cuando no se detecta PR, para diagnóstico

### v1.2.1 (2026-02-09)
- **Corregido:** `formatActivity` reescrito para detectar tipos de actividad con campos polimórficos de la API (`planGenerated`, `agentMessaged`, `progressUpdated`, etc.) — antes mostraba `undefined`
- **Corregido:** Estado `WAITING_FOR_PLAN_APPROVAL` cambiado a `AWAITING_PLAN_APPROVAL` (5 archivos) para coincidir con la API oficial
- **Corregido:** Campos fantasma `type` y `reasoning` eliminados de la interfaz `Activity`
- **Nuevo:** Visualización de artefactos (diffs de código, salida de comandos, media) en actividades
- **Nuevo:** Mocks para tipos de actividad faltantes (agentMessaged, userMessaged, sessionCompleted, sessionFailed, artefactos)

### v1.2.0 (2025-12-15)
- **Nuevo:** Soporte para Cloudflare Workers como servidor MCP remoto
- Endpoint SSE en `/sse` para clientes MCP
- Endpoint JSON-RPC en `/message`
- Health check en `/health` con info de herramientas
- Documentación de uso con MCP Inspector y mcp-remote
- Instrucciones de deploy a Cloudflare Workers propio

### v1.1.0 (2025-12-10)
- Agregadas 3 nuevas herramientas: `jules_get_source`, `jules_get_activity`, `jules_delete_session`
- Soporte para `automationMode` en creación de sesiones
- Soporte para filtrado en `jules_list_sources`
- Traducciones completas al español
- Documentación mejorada con guía de uso
- Nuevos tipos para artefactos (ChangeSet, BashOutput, Media)
- Estados de sesión adicionales (AWAITING_USER_FEEDBACK, PAUSED)

### v1.0.0 (2025-01-15)
- Lanzamiento inicial
- 8 herramientas core para integración con la API de Jules
- Transporte stdio para Claude Desktop
- Manejo de errores comprehensivo y logging
- Seguridad de tipos completa con TypeScript
