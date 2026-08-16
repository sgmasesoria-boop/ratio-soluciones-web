# Plan de aprovechamiento de licencias de Ratio Soluciones

Fecha de revisión: 16 de agosto de 2026.

Este inventario evita contratar herramientas duplicadas. Las prestaciones y
precios deben volver a comprobarse antes de una ampliación o renovación.

## Decisiones inmediatas

| Servicio | Uso aprobado en Ratio | Qué cubre ahora | Qué no debe atribuírsele |
|---|---|---|---|
| Supabase Pro | Base de datos, autenticación, almacenamiento privado, funciones y registros | Copia diaria de la base de datos con 7 días de retención, protección de contraseñas filtradas, 7 días de registros y capacidad suficiente para el piloto | Las copias de base de datos no incluyen los archivos de Storage. PITR es un complemento de pago y no se activa por defecto. No incluye análisis antivirus de los documentos subidos |
| Signaturit Sandbox | Pruebas completas de firma electrónica | API de pruebas, avisos de eventos, consulta del estado y descarga del contrato firmado y documento probatorio | El acceso API de producción requiere oferta Enterprise. El aviso recibido no acredita por sí solo una firma |
| Microsoft 365 Premium / Copilot | Word, Excel, plantillas, revisión de documentos, OneDrive cifrado como segundo destino y protección de los equipos | Aplicaciones de Office, Copilot para el titular, Defender, recuperación de OneDrive y detección de ransomware | No analiza automáticamente los archivos alojados en Supabase antes de que el CRM los abra. Una cuenta personal no sustituye la administración, auditoría y cumplimiento de un entorno empresarial |
| Codex | Desarrollo, pruebas repetibles, documentación y revisión técnica | Automatización del código, pruebas y preparación de documentación | No sustituye una prueba de intrusión independiente, un dictamen jurídico ni una certificación de seguridad |
| OpenAI API | Asistente interno del CRM y lectura controlada de expedientes | Análisis bajo demanda, límites de gasto propios y trazabilidad técnica por proyecto | Se factura y administra aparte de la licencia de Codex o ChatGPT. `store:false` evita guardar estado de la respuesta, pero no equivale por sí solo a retención cero |
| Arsys | Dominio, DNS y correo corporativo | Identidad de dominio y entrega de correo mediante el SMTP configurado | No sustituye el archivo del expediente ni la trazabilidad del CRM |
| OneDrive y Google Drive | Dos destinos externos de copias cifradas | Redundancia frente a pérdida del proveedor principal | No son una copia válida hasta completar una restauración controlada y documentar el resultado |

## Política de gasto

1. No activar PITR de Supabase durante el piloto. Mantener la copia diaria
   incluida y las dos copias cifradas externas. Revisar PITR cuando el volumen
   real justifique un RPO inferior a 24 horas.
2. No contratar otro proveedor de firma. Completar el ciclo ficticio en
   Signaturit Sandbox y pedir oferta de API de producción solo cuando la
   plantilla contractual esté validada.
3. No comprar de momento otra suite ofimática ni almacenamiento. Usar Microsoft
   365 para los documentos de trabajo y OneDrive/Google Drive solo con los
   archivos de copia ya cifrados.
4. No presentar Microsoft Defender como antivirus del portal. Hasta disponer de
   un escáner integrado, los documentos deben permanecer privados, con tipos y
   tamaño limitados, revisión humana previa y sin análisis automático cuando no
   estén aceptados.
5. Reservar el primer gasto externo adicional para dos servicios que no pueden
   autocertificarse: prueba de intrusión independiente y revisión jurídica de
   privacidad/contratación.

## Evidencia pendiente antes de clientes reales

- Restaurar una copia cifrada en un entorno aislado y registrar duración,
  integridad y responsables.
- Ejecutar una firma completa con datos ficticios en Sandbox, incluido evento
  duplicado, retraso y recuperación.
- Probar separación entre dos clientes reales de prueba (IDOR/BOLA).
- Definir y probar el tratamiento de documentos potencialmente maliciosos.
- Confirmar por escrito el plan de Signaturit contratado y si incluye API de
  producción, volumen, DPA, retención y subencargados.
