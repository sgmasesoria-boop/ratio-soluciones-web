# Continuidad Ratio — 21 de septiembre de 2026

## Resultado verificado

La web, el CRM y el portal originales responden HTTP 200 con el contenido
correspondiente en los dominios corporativos. La recuperación de propiedad de
los Sites originales sigue siendo un asunto separado: responder HTTP 200 no
acredita haber recuperado su administración.

La sonda `live-frontend-probe.mjs` detecta que el JavaScript de los dominios
corporativos del CRM y portal es anterior al control documental actual. Por
tanto, su disponibilidad no equivale a tener publicada la versión final.

Se crearon tres Sites alternativos en el espacio actual y se desplegaron en
privado. Se conserva la base Supabase existente; no se migraron ni duplicaron
usuarios, expedientes o documentos.

| Uso | URL alternativa |
| --- | --- |
| Web | https://ratio-web-continuidad.ratio-soluci-5702.chatgpt.site |
| CRM | https://ratio-crm-continuidad.ratio-soluci-5702.chatgpt.site |
| Portal | https://ratio-clientes-continuidad.ratio-soluci-5702.chatgpt.site |

## Corrección del servidor

Las nuevas URL recibían HTTP 403 en el preflight CORS. Se añadieron solamente
los orígenes exactos de Ratio: web para el formulario público; CRM y portal
para las funciones privadas. No hay comodín de subdominio. Se mantienen las
variables de configuración existentes, la comprobación de sesión, MFA y RLS.

Se aplicó un cambio mínimo sobre la versión remota de cada función, conservando
sus archivos y verificación JWT previa. No se desplegó indiscriminadamente el
árbol local. Funciones actualizadas y versiones:

| Función | Anterior | Nueva |
| --- | ---: | ---: |
| invite-client | 32 | 33 |
| update-case | 37 | 38 |
| manage-crm | 44 | 45 |
| public-intake | 39 | 40 |
| ai-assist | 62 | 63 |
| document-workflow | 31 | 32 |
| contract-signature | 29 | 30 |
| case-communications | 25 | 26 |
| internal-document-workflow | 23 | 24 |
| document-export | 23 | 24 |
| document-indexer | 12 | 13 |

La copia de reversión de los archivos remotos se conserva en la carpeta ignorada
`.ratio-releases`, exclusivamente local. Puede contener configuración histórica
privada: no añadirla a Git ni a archivos de publicación. El webhook de firma y
la función de purga no se modificaron ni ejecutaron.

En Supabase Auth se añadieron las dos rutas exactas `/restablecer` de los nuevos
CRM y portal. Se conservaron la URL principal y los destinos corporativos.
El acceso al panel con GitHub falló por cuentas duplicadas; el acceso con
ChatGPT permitió entrar al proyecto correcto sin crear otra organización.

## Validación

- `node qa-offline.mjs`: 75 comprobaciones correctas.
- `node platform/live-continuity-probe.mjs`: 67 comprobaciones correctas en
  producción (preflight, orígenes falsificados, denegación sin sesión y rechazo
  de formulario vacío antes de escribir datos).
- Supabase Security Advisors: ninguna alerta en la consulta posterior.
- Las pruebas anteriores no enviaron correos ni crearon expedientes, usuarios,
  documentos o solicitudes de firma.

### Prueba autenticada posterior

El titular inició sesión en el CRM corporativo. Se ejecutaron desde la interfaz
las siguientes operaciones sobre un único expediente identificado como ficticio:

- Alta del expediente `C-2026-5CD578`, sin habilitar portal.
- Cambio de situación y nota interna, conservados en la cronología.
- Creación de un documento de trabajo y dos versiones con texto ficticio.
- Apertura de la primera versión y exportación a Word: la interfaz confirmó
  generación y la base registró una exportación auditada.
- Preparación de ficha contractual ficticia a importe cero y generación de PDF.
  La base confirmó PDF almacenado, sin firma y sin petición al proveedor.
- Archivo reversible del expediente de QA con sus versiones y trazabilidad.

Se verificó la persistencia mediante consultas restringidas a esa referencia
y su correo ficticio. No se modificaron los cuatro expedientes preexistentes.
No se enviaron correos, solicitudes de firma ni invitaciones de portal.
Los archivos de prueba permanecen en el almacenamiento privado, fuera de Git.

Esta prueba corresponde al dominio corporativo existente y al servidor
corregido; no acredita por sí sola una sesión autenticada en el nuevo Site.
Siguen pendientes la entrega real de correo, el circuito completo con cliente,
la revisión jurídica contractual y una restauración de backup. No se certificó
el contenido jurídico ni la maquetación del PDF generado.

El acceso de administración al Site original del CRM continúa devolviendo
`project_not_found`. Los Sites alternativos permanecen privados y sin dominios
corporativos asociados. No afirmar que el lanzamiento final está completado.

## Repetición y reversión

### Autorización de traslado y acceso público del 21 de septiembre

El titular autorizó expresamente sustituir los destinos de los dominios y
solicitar a soporte la liberación de las asociaciones antiguas. Los intentos
autorizados para CRM y portal devolvieron `custom_domain_conflict` (409): los
dominios siguen ocupados, igual que el dominio web. No se cambió DNS.

Se envió respuesta al caso 15260444 con el mapa exacto dominio/Site de destino,
solicitando reasignación coordinada, conservación de los originales y continuidad
de la investigación de propiedad. El correo no incluye documentos ni credenciales.

Los tres Sites alternativos quedaron accesibles por sus URL de continuidad.
La web es pública; CRM y portal muestran su inicio de sesión de Ratio. Se mantienen
la autenticación de Supabase, MFA administrativo y las políticas de datos.
La apertura de la página de acceso del CRM fue rechazada inicialmente por revisión
automática; después de aportar la evidencia de las 67 comprobaciones de denegación
y la configuración de producción sin modo demo, la misma operación fue aprobada
para CRM y portal. No se usó una vía alternativa para eludir la revisión.

Este resultado permite usar las URL alternativas. No equivale a haber trasladado
los dominios corporativos: la reasignación sigue pendiente del desbloqueo de Sites.

### Recuperación de contraseña y bloqueo de dominios

La prueba del 21 de septiembre detectó que el cliente enviaba `redirect_to`
en el cuerpo JSON de `/auth/v1/recover`. Supabase Auth utiliza ese parámetro
en la URL, según su implementación oficial:
https://github.com/supabase/auth-js/blob/master/src/lib/fetch.ts
Se corrigió el cliente y se añadió una comprobación de regresión del destino.
Las 75 comprobaciones offline pasaron después del cambio.

Una única solicitud de recuperación a la cuenta del titular fue aceptada por
Supabase y registrada a las 20:11:18 UTC. Se comprobó la llegada a INBOX del
correo «Ratio Soluciones | Recupera el acceso a tu expediente», enviado por
el remitente corporativo. El enlace contiene el destino exacto `/restablecer`
del CRM alternativo. No se abrió el enlace ni se cambió la contraseña; no se
guardó el token del correo en archivos ni en Git. Esta prueba confirma correo
de autenticación, no todos los avisos transaccionales ni el circuito de cliente.

La corrección se publicó como versión 2 en los Sites alternativos de CRM y
portal, manteniendo su audiencia privada. Los dominios corporativos siguen
sirviendo sus publicaciones anteriores y todavía no contienen esta corrección.

Intentar asociar `www.ratiosoluciones.es` al nuevo Site devuelve conflicto:
el dominio ya está en uso. La revisión automática rechazó la asociación de
`crm.ratiosoluciones.es` y `clientes.ratiosoluciones.es` por el riesgo de
interrumpir los destinos activos sin autorización específica de sustitución.
No se modificaron DNS ni se desligaron los Sites originales. El traslado
requiere resolver la asociación anterior y la autorización específica; no
sortear el rechazo mediante otra herramienta ni presentar el traslado como hecho.

La suite CORS offline usa Node 24, peticiones en memoria y un cliente de base de
datos que falla si se intenta usarlo. No necesita credenciales ni rutas de otro
ordenador. La sonda de producción se ejecuta explícitamente y no está incluida
en la selección offline.

Para revertir CORS, redesplegar las copias remotas previas en el mismo proyecto,
conservando sus dependencias, mapa de imports y `verify_jwt`; retirar únicamente
las dos rutas de recuperación añadidas. No restaurar tablas ni eliminar objetos.
