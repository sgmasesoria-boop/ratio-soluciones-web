# Correo de acceso y MFA

## Estado real

- El segundo factor TOTP está desplegado, es obligatorio para perfiles internos y existe al menos un factor administrador verificado en producción.
- Las funciones administrativas comprueban sesión, rol activo y nivel AAL2 dentro de la función.
- Las plantillas de invitación y recuperación de Ratio están preparadas en `supabase/email-templates/`.
- El SMTP usado por `public-intake` no configura automáticamente el SMTP de Supabase Auth: son dos configuraciones independientes.

## Datos preparados para Supabase Auth

- Remitente: `clientes@ratiosoluciones.es`
- Nombre: `Ratio Soluciones`
- Servidor: `smtp.serviciodecorreo.es`
- Puerto: `465`
- Usuario: `clientes@ratiosoluciones.es`
- Contraseña: debe introducirla Sergio directamente; no se guarda en este repositorio.
- Asunto de invitación: `Ratio Soluciones | Tu acceso privado está preparado`
- Asunto de recuperación: `Ratio Soluciones | Recupera el acceso a tu expediente`

## Validación obligatoria antes del primer cliente

1. Activar Custom SMTP en Authentication > SMTP Settings.
2. Guardar los datos anteriores y la contraseña real del buzón.
3. Copiar las dos plantillas en Authentication > Email Templates.
4. Enviar una invitación a una dirección de prueba externa.
5. Comprobar remitente, asunto, logotipo textual, botón, creación de contraseña y entrada al portal.
6. Solicitar recuperación de contraseña y completar el recorrido.
7. Confirmar que el acceso interno vuelve a exigir el código TOTP.

Nunca se almacenan en Git la contraseña SMTP, una clave de OpenAI ni un token personal de Supabase.
