# Integración de firma electrónica

## Decisión del piloto

El piloto utiliza Signaturit en su entorno `sandbox`. El cliente recibe la solicitud del proveedor y puede firmar desde móvil u ordenador. Ratio conserva en almacenamiento privado:

- PDF exacto enviado y huella SHA-256.
- Identificadores de solicitud y documento del proveedor.
- PDF firmado y huella SHA-256.
- Documento probatorio y huella SHA-256.
- Fechas verificadas y registro inmutable de eventos.

El webhook no acredita por sí mismo la firma. Solo despierta el proceso; la función consulta nuevamente la API autenticada de Signaturit, descarga ambos PDF y verifica su formato y huellas antes de actualizar el contrato.

## Secretos necesarios

Se configuran exclusivamente como secretos de las Edge Functions. No se escriben en el repositorio ni en el navegador:

- `SIGNATURIT_MODE=sandbox`
- `SIGNATURIT_ACCESS_TOKEN=<token del sandbox>`
- `SIGNATURIT_WEBHOOK_TOKEN=<valor aleatorio de al menos 32 caracteres>`
- `SIGNATURIT_EVENTS_URL=https://bvpeztdfwdbiielaione.supabase.co/functions/v1/signaturit-webhook/events.json?token=<mismo valor>`
- `CONTRACT_TEMPLATE_VALIDATED=false`

La producción exige `SIGNATURIT_MODE=production` y `CONTRACT_TEMPLATE_VALIDATED=true`. La aplicación rechaza el envío de producción si falta la validación jurídica.

## Operativa

1. Ratio completa o modifica la ficha contractual sin estados prefijados.
2. `Generar PDF` crea una copia exacta, guarda su huella y registra la actuación.
3. Una persona revisa identidad, causa, alcance y precio.
4. Si el cliente firma electrónicamente, `Enviar a firma` exige administrador con MFA AAL2 y remite el PDF al proveedor.
5. El webhook se registra como aviso no confiable.
6. El servidor consulta la API del proveedor y solo continúa si el documento figura completado.
7. Descarga, valida y archiva el PDF firmado y el documento probatorio.
8. Si el cliente firma en papel, `Registrar firma en papel` exige administrador con MFA AAL2, fecha de firma, localización del original, confirmación de custodia y el contrato firmado completo en PDF.
9. El servidor calcula las huellas, guarda el PDF en almacenamiento privado, crea un acta interna de verificación y registra la operación de forma transaccional y auditable.
10. En ambos recorridos, la firma acreditada aparece en la cronología interna. El portal no se activa automáticamente; Ratio conserva esa decisión expresa después de comprobar los datos de contacto del cliente.

## Momento de activación del portal

El expediente se crea desde la primera atención, aunque haya comenzado presencialmente. El acceso del cliente se habilita únicamente cuando Ratio ha verificado una contratación válida, ya sea electrónica o firmada en papel, y ha comprobado el correo del cliente. La apertura del portal es una actuación posterior y expresa: no se produce al crear el expediente, generar el contrato, enviarlo a firma ni recibir un aviso del proveedor.

## Límites antes de producción

- Validación jurídica de la plantilla y de cada cláusula de consumo, desistimiento, privacidad, responsabilidad, impuestos y pagos.
- Firma del contrato de encargado y revisión de ubicación, subencargados, retención y exportación con el proveedor.
- Confirmación comercial de acceso API: los precios públicos reservan la API al plan Enterprise.
- Prueba completa con identidades y documentos totalmente ficticios en sandbox.
- Rotación del token del webhook si aparece en registros, capturas o comunicaciones.
- Prueba de reintentos, evento duplicado, caída temporal y recuperación.
