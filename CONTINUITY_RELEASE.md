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

Estas verificaciones no sustituyen la prueba con una sesión administrativa MFA,
la entrega real de correo, el circuito contractual ni una restauración de backup.
La validación contractual y la prueba autenticada siguen pendientes; no afirmar
que el proyecto está completamente terminado hasta cerrarlas.

## Repetición y reversión

La suite CORS offline usa Node 24, peticiones en memoria y un cliente de base de
datos que falla si se intenta usarlo. No necesita credenciales ni rutas de otro
ordenador. La sonda de producción se ejecuta explícitamente y no está incluida
en la selección offline.

Para revertir CORS, redesplegar las copias remotas previas en el mismo proyecto,
conservando sus dependencias, mapa de imports y `verify_jwt`; retirar únicamente
las dos rutas de recuperación añadidas. No restaurar tablas ni eliminar objetos.
