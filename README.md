# Ratio Soluciones — web pública

Web responsive orientada a particulares en Andalucía y la Comunidad de Madrid. Presenta soluciones para deudas, banca, vivienda, seguros, familia y consumo, con un formulario guiado que remite las consultas a clientes@ratiosoluciones.es sin admitir documentación.

## Construcción

```bash
npm run build
```

El resultado se genera en `dist/`, incluido el worker de publicación.

## Alcance actual

- Web pública y páginas de servicio.
- Aviso legal, privacidad, cookies e información precontractual revisados con los datos facilitados por el responsable.
- Presentación coherente con el portal privado simplificado.
- Sin almacenamiento documental en la web ni en el portal.

El portal privado se mantiene en un proyecto separado y requiere conexión, pruebas de seguridad y revisión antes de activar clientes reales. FormSubmit es una solución provisional: antes de captar consultas reales deben documentarse el contrato de encargo, la ubicación del tratamiento y las garantías de las posibles transferencias internacionales, o sustituirse por un backend europeo controlado. El texto legal debe revisarse si cambia la actividad, el modelo contractual o los proveedores técnicos.
