Plan de Implementación: Agente de Monitoreo y Auditoría - Avoxi API
1. Descripción del Proyecto
El objetivo es desarrollar un agente que se integre con la API de Avoxi para automatizar la detección de llamadas no contestadas y la auditoría de grabaciones. Actualmente, este proceso es manual y consume mucho tiempo, dependiendo de reportes por WhatsApp y búsquedas individuales de IDs de llamada
.
2. Objetivos Principales
Detección de Llamadas Perdidas: Monitorear el "Call Journey" para identificar llamadas que no fueron atendidas por agentes, especialmente durante los horarios de guardia (lunes a viernes después de las 21:00 ART y fines de semana)
.
Auditoría de Llamadas: Acceder a los logs y grabaciones para interpretar el flujo que siguió el usuario y, eventualmente, transcribir el audio para análisis de contenido
.
Automatización del Flujo: Reemplazar el reporte manual en WhatsApp y la búsqueda manual del Call ID en el panel de Avoxi
.
3. Contexto Técnico (Basado en las Fuentes)
API de Avoxi: Permite el uso de tokens para autenticación y acceso a Service Providers (SPs)
.
Concepto Clave - Call Journey: Registro detallado de cada paso del cliente en el flujo telefónico (espera, derivación a equipos, asignación a agentes)
.
Identificador Único: El sistema debe trabajar sobre el Call ID para rastrear eventos específicos
.
Consideración de Privacidad: El proceso de transcripción de audio y su paso por modelos de IA requiere una revisión de políticas de privacidad de los datos
.
4. Flujo de Trabajo Actual (Manual)
Los agentes de guardia informan llamadas perdidas por un grupo de WhatsApp
.
El equipo técnico busca manualmente el Call ID en Avoxi
.
Se revisa el historial y se envía la información a los responsables para su análisis final
.
5. Estructura Sugerida del Proyecto (Skeleton)
/avoxi-call-agent
├── /docs
│   └── api_spec.md         # Documentación de los endpoints de Avoxi (por investigar)
├── /src
│   ├── auth.py             # Gestión de tokens de API [2]
│   ├── monitor.py          # Lógica para detectar llamadas perdidas en tiempo real
│   ├── audit.py            # Extracción de Call Journey y descarga de grabaciones [2]
│   ├── analyzer.py         # Integración con LLM para transcripción e interpretación
│   └── notifier.py         # Alertas (reemplazo del proceso de WhatsApp)
├── config.yaml             # Configuración de horarios de guardia y credenciales
└── main.py                 # Punto de entrada del agente
