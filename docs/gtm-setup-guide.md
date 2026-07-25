# Guía de setup GTM — EcoViva

Pasos para dejar el tracking funcionando end-to-end. Container: **`GTM-KWQLH93V`** · GA4: **`G-8F9MFN4MR4`** · Pixel/Dataset Meta: **`917314494452621`**.

> **Contexto** (verificado con el MCP de Meta el 2026-07-23): hoy el dataset solo recibe `PageView`. No llega ningún `Lead`, `Schedule` ni `ViewContent`, y GHL/n8n **no** envían CAPI. Estos pasos activan las 3 conversiones que faltan.

---

## 1. Importar el JSON de GA4

1. GTM → **Administrador** → **Importar contenedor**.
2. Archivo: [`docs/gtm-container.json`](./gtm-container.json).
3. Espacio de trabajo: **Existing / Default Workspace**.
4. Opción de importación: **Combinar (Merge)** → **Renombrar tags/triggers/variables en conflicto**.
5. Confirmar. Esto agrega:
   - 1 Google Tag base (GA4) + 4 GA4 Event tags (`appointment_booked`, `generate_lead`, `view_content`, `locale_change`)
   - 4 Custom Event triggers
   - Constante con el Measurement ID (ya hardcodeado) + variables de dataLayer

> El JSON **no incluye los tags de Adsmurai** (dependen del template comunitario ya instalado en tu container). Se hacen a mano en el paso 3.

## 2. Measurement ID de GA4

Ya viene hardcodeado (`G-8F9MFN4MR4`) en la constante `Const - GA4 Measurement ID`. **No hay que tocar nada.**

## 3. Duplicar el tag de Adsmurai (una vez por conversión)

Estos son los que mandan a **Meta** (browser + CAPI dedupeado). Se crean duplicando tu tag **PageView** de Adsmurai existente para heredar la config del OneTag.

Por cada fila: en el tag `PageView` de Adsmurai → menú **⋮** → **Duplicar** → renombrar → cambiar **Event name** → cambiar **Activador** → **guardar**. **No toques el PageView original.**

| Nombre del nuevo tag             | Event name (en el tag) | Activador             |
|----------------------------------|------------------------|-----------------------|
| `Adsmurai \| Schedule`            | `Schedule`             | `CE — appointment_booked` |
| `Adsmurai \| Lead`                | `Lead`                 | `CE — generate_lead`  |
| `Adsmurai \| ViewContent`         | `ViewContent`          | `CE — view_content`   |

### 3.1 Advanced matching (esto sube el EMQ — lo importante)

En los tags `Schedule` y `Lead`, en la sección de **datos de usuario / advanced matching** del OneTag, mapear a las variables de dataLayer (ya creadas por el import):

| Campo Meta        | Variable GTM         |
|-------------------|----------------------|
| Email             | `{{DLV - email}}`    |
| Phone             | `{{DLV - phone}}`    |
| First name        | `{{DLV - first_name}}` |
| Last name         | `{{DLV - last_name}}`  |

> El OneTag hashea (SHA-256) automáticamente. El sitio ya normaliza email/phone/nombre antes de pushearlos.

### 3.2 Event ID para deduplicación

En los 3 tags nuevos, mapear el campo **Event ID** del OneTag a `{{DLV - event_id}}`. Así navegador y servidor se deduplican con el mismo ID. (`ViewContent` no lleva PII pero sí conviene el event_id.)

## 4. Validación (antes de publicar)

1. **Vista Previa** de GTM (botón *Preview*) → abrí `ecovivadesarrollos.com`.
2. Poné un **`test_event_code`** temporal en cada tag Adsmurai (lo tomás de Meta → Events Manager → Probar eventos).
3. Reproducí cada flujo:
   - Abrir detalle de un proyecto → debe disparar `CE — view_content` → **ViewContent**.
   - Completar el funnel y **agendar una visita** → `CE — appointment_booked` → **Schedule**.
   - Enviar el **survey de financiamiento** → `CE — generate_lead` → **Lead**.
4. Confirmar en **Meta → Probar eventos**: cada evento aparece con badges **Navegador** + **Servidor** + **Deduplicado** (mismo `event_id`).
5. Confirmar en **GA4 → DebugView** (se activa solo con la Vista Previa): cada evento aparece con sus parámetros.
6. Revisar el **EMQ** de `Lead`/`Schedule` en Events Manager tras acumular eventos — con advanced matching deberían llegar a **8-9/10** (vs. 6.1 de PageView, que no lleva PII).

## 5. Publicar

1. **Borrar el `test_event_code`** de los 3 tags Adsmurai. ⚠️ Si queda, TODOS los eventos reales van a "Probar eventos" y no a tus campañas.
2. GTM → **Enviar** → nombrar la versión (ej. *"Conversiones Schedule/Lead/ViewContent + advanced matching"*) → **Publicar**.

## 6. Después de publicar (Meta)

1. Events Manager → **Configuración de eventos agregados** → priorizar: `Schedule` (1), `Lead` (2), `ViewContent` (3), `PageView` (4).
2. En las campañas, cambiar el evento de optimización de `PageView` → **`Schedule`** (o `Lead`, según objetivo). Este es el cambio que hace que el algoritmo optimice hacia conversiones reales.

---

## Checklist rápido

- [ ] JSON importado (Merge)
- [ ] 3 tags Adsmurai duplicados (`Schedule`, `Lead`, `ViewContent`)
- [ ] Advanced matching mapeado en `Schedule` y `Lead`
- [ ] `event_id` mapeado en los 3
- [ ] Validado en Meta Test Events (Navegador + Servidor + Deduplicado)
- [ ] Validado en GA4 DebugView
- [ ] `test_event_code` borrado
- [ ] Versión publicada
- [ ] Prioridad de eventos + optimización de campaña actualizadas
