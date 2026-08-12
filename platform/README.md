# Ratio Soluciones · CRM y plataforma privada

Sistema único de expedientes. El primer contacto crea un expediente interno; no existe una entidad separada de «consulta» ni una conversión posterior. El portal del cliente permanece desactivado hasta que el sistema recibe y valida las evidencias de firma.

## Modelo operativo

- Un expediente desde el primer contacto hasta el cierre.
- Situación actual escrita libremente por Ratio, sin fases comerciales o procesales premarcadas.
- Estado general mínimo: abierto, no contratado o archivado. La contratación se registra aparte y no cierra el expediente.
- Cronología inmutable de notas, avances, solicitudes, entregas y accesos.
- Contrato sin estados prefijados: Ratio escribe una anotación libre y el sistema conserva por separado los hechos verificables de envío y firma.
- Portal privado activado expresamente solo después de acreditar la firma.
- Solicitudes de documentación o aclaraciones dentro del portal.
- Solicitudes de aclaración o llamada iniciadas por el cliente, con respuesta trazable y coordinación desde Ratio.
- Documentos de trabajo con tipo y anotación libres.
- Versiones ilimitadas por documento: cada borrador se conserva y nunca sustituye al anterior.
- Solo las versiones publicadas expresamente pueden ser visibles para el cliente.
- Análisis interno por expediente, siempre manual, con revisión humana y auditoría.

## Seguridad y privacidad

- Supabase Auth con MFA AAL2 obligatorio para el equipo interno.
- RLS por expediente y escritura administrativa exclusivamente mediante funciones Edge.
- Archivos en almacenamiento privado y enlaces temporales.
- El navegador no recibe la clave de servicio.
- Las notificaciones externas no incluyen información sensible.
- La identidad profesional se muestra al cliente únicamente después de su asignación.

## Arquitectura

- `clientes.ratiosoluciones.es`: portal privado del cliente.
- `crm.ratiosoluciones.es`: aplicación interna.
- PostgreSQL: perfiles, expedientes, miembros, cronología, solicitudes, archivos, documentos de trabajo, versiones y auditoría.
- Edge Functions: alta, actualización, activación del portal, documentos, análisis y notificaciones.
- SMTP corporativo: acceso y avisos genéricos.

## Pruebas locales

```powershell
npm run build
npm run test:unified-cases
npm run test:contract-signature
npm run test:communications
npm run test:security
npm run test:documents
npm run test:ai
```

El modo de demostración utiliza datos ficticios. Las pruebas locales no sustituyen la comprobación autenticada y pública tras desplegar.
