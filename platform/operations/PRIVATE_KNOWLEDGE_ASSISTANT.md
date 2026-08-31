# Biblioteca privada y asistente de expedientes

## Finalidad

La biblioteca privada aporta experiencia histórica al análisis de un expediente sin subir el repositorio completo a Internet. El CRM combina cuatro capas:

1. ficha, cronología y peticiones del expediente;
2. documentos del cliente e internos previamente admitidos e indexados;
3. antecedentes históricos seleccionados en el equipo local;
4. normativa y jurisprudencia comprobadas en fuentes oficiales.

El resultado es un análisis o borrador profesional para revisión humana. No se presenta ni se envía automáticamente.

## Flujo diario

1. Abrir `BUSCAR-BIBLIOTECA-RATIO.cmd` en el equipo autorizado.
2. Pulsar **Conectar con el CRM**. El enlace contiene una credencial efímera en el fragmento de la URL; el navegador la retira inmediatamente y la conserva solo durante esa sesión.
3. Abrir el expediente y escribir la tarea, por ejemplo: `Prepara demanda de gastos hipotecarios a partir de las escrituras y facturas del expediente`.
4. Pulsar **Trabajar con el expediente**. El CRM consulta el índice local, selecciona los antecedentes mejor puntuados, aplica el filtro de identificadores y envía al análisis únicamente el contexto limitado.
5. Revisar hechos, cálculos, fuentes oficiales y documento generado antes de utilizarlo.

La búsqueda manual y la descarga de un paquete JSON se mantienen como alternativa controlada.

## Límites y protección

- La biblioteca completa y sus rutas permanecen en el equipo local.
- El servicio local solo escucha en `127.0.0.1` y exige una credencial aleatoria por apertura.
- Solo acepta solicitudes del CRM corporativo y bloquea otros orígenes.
- Se utilizan como máximo 12 antecedentes y 30.000 caracteres por análisis.
- No se incorpora al paquete el texto escrito en el buscador.
- Se eliminan correos, teléfonos, DNI/NIE, IBAN, domicilios, referencias internas y nombres probables.
- El backend vuelve a validar tamaño, versión de redacción e identificadores antes de aceptar el contexto.
- Los antecedentes se etiquetan como históricos: ayudan con estructura, argumentos y comprobaciones, pero no acreditan hechos del expediente ni sustituyen fuentes jurídicas vigentes.
- Las consultas jurídicas externas se limitan a dominios oficiales configurados.
- La llamada al modelo utiliza `store:false`. El resultado final y su catálogo mínimo de fuentes sí quedan registrados en el expediente para trazabilidad.

La redacción automática reduce el riesgo, pero no equivale por sí sola a una certificación formal de anonimización. Si el filtro detecta un identificador o la biblioteca local deja de responder, el análisis se detiene y no continúa silenciosamente con un contexto dudoso.

## Revocación inmediata

Para cortar la conexión local basta con cerrar la ventana negra de la biblioteca o la sesión del CRM. Al abrir de nuevo el servicio se genera otra credencial; la anterior deja de funcionar.


