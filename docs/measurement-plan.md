# Plan de medición — EcoViva

Fuente de verdad del tracking. GTM (`GTM-KWQLH93V`) enruta cada evento del `dataLayer`
a **GA4** (todos los eventos) y a **Meta** vía **Adsmurai OneTag** (solo conversiones).

## Arquitectura

```
Sitio (React SPA) → dataLayer.push(...) → GTM (GTM-KWQLH93V)
                                          ├─→ GA4 Event tags            → GA4 (todo)
                                          └─→ Adsmurai OneTag (Both)    → Meta Pixel + CAPI (dedup por event_id)
```

- Toda la instrumentación vive en [`src/lib/tracking.ts`](../src/lib/tracking.ts).
- Datos de cliente (email, phone, nombre) van en claro al `dataLayer`; **Adsmurai/Meta los hashea** (SHA-256) para *advanced matching*. Esto es lo que sube el EMQ de los eventos de conversión.
- Cada conversión lleva un `event_id` único → deduplicación navegador + servidor en Meta. Si más adelante GHL/n8n envían CAPI, deben reusar ese mismo `event_id`.

## Eventos

| dataLayer `event` | Dispara cuando | Parámetros | GA4 | Meta | Advanced matching |
|---|---|---|---|---|---|
| `appointment_booked` | `/api/reserve` responde OK en el funnel — visita agendada | `event_id`, `proyecto`, `presupuesto`, `email`, `phone`, `first_name`, `last_name` | `appointment_booked` | `Schedule` | email, phone, fn, ln |
| `generate_lead` | `/api/survey` responde OK — solicitud de financiamiento enviada | `event_id`, `form_type`, `email`, `phone`, `first_name`, `last_name` | `generate_lead` | `Lead` | email, phone, fn, ln |
| `view_content` | Se monta una página de proyecto (detalle Llanada / detalle Río Celeste / landing Llanada) | `event_id`, `content_name`, `content_type` | `view_content` | `ViewContent` | — |
| `locale_change` | El usuario cambia de idioma (ES/EN) | `page_locale` | `locale_change` | — (solo GA4) | — |

### Dónde se dispara cada uno

| Evento | Archivo |
|---|---|
| `appointment_booked` | [`FunnelPage.tsx`](../src/components/FunnelPage.tsx) tras `res.ok` de `/api/reserve` |
| `generate_lead` | [`SurveyPage.tsx`](../src/components/SurveyPage.tsx) tras `res.ok` de `/api/survey` |
| `view_content` | [`LomasLlanadaDetail.tsx`](../src/components/LomasLlanadaDetail.tsx), [`RioCelesteDetail.tsx`](../src/components/RioCelesteDetail.tsx), [`FunnelLlanada.tsx`](../src/components/FunnelLlanada.tsx) |
| `locale_change` | [`LanguageContext.tsx`](../src/contexts/LanguageContext.tsx) (ya existía) |

## Reglas de mapeo a Meta

- **Solo eventos con valor de conversión van a Meta.** Meta optimiza mal con ruido y tiene límite de 8 eventos de conversión priorizados.
- Micro-eventos de funnel (inicio de form, pasos, abandono) → **solo GA4**, nunca Meta.
- `PageView` lo dispara Adsmurai OneTag en *All Pages* (ya existía).

## Prioridad de eventos de conversión en Meta (recomendada)

Configurar en Events Manager → Configuración de eventos agregados:

1. `Schedule` (visita agendada — conversión principal del funnel de ads)
2. `Lead` (solicitud de financiamiento)
3. `ViewContent` (audiencias de retargeting por proyecto)
4. `PageView`

## Normalización de datos de cliente (para matching)

Implementada en [`src/lib/tracking.ts`](../src/lib/tracking.ts):

- **email** → `trim().toLowerCase()`
- **phone** → solo dígitos; si es local CR de 8 dígitos, antepone `506`
- **first_name / last_name** → `trim().toLowerCase()`

## Consentimiento

El survey exige `consent` (Ley 8968 CR) antes de enviar, así que el `generate_lead` solo
se dispara con consentimiento otorgado. El funnel de reserva recolecta datos que el usuario
entrega voluntariamente para ser contactado (base legal equivalente).

## Pendiente de confirmar

- **¿GHL/n8n ya disparan CAPI (Lead/Schedule) del lado servidor?** Si es así, deben compartir
  el `event_id` con el navegador para deduplicar. Hoy el sitio no envía `fbc`/`fbp`/`event_id`
  al backend, por lo que un CAPI server-side de GHL sería *server-only*, sin dedup y con EMQ bajo.
