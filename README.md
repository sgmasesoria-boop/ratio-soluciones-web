# Ratio Soluciones

Repositorio privado de la web pública y de la plataforma de gestión de Ratio Soluciones.

- La raíz contiene la web orientada a particulares en Andalucía y la Comunidad de Madrid.
- [`platform/`](platform/) contiene el CRM interno y el portal privado de clientes, con despliegues independientes.
- El formulario público registra las consultas directamente en el CRM sin admitir documentos adjuntos.

## Construcción

```bash
npm run build
```

El resultado se genera en `dist/`, incluido el worker de publicación.

## Alcance actual

- Web pública y páginas de servicio.
- Aviso legal, privacidad, cookies e información precontractual revisados con los datos facilitados por el responsable.
- Presentación coherente con el portal privado.
- Canal documental privado dentro de la plataforma; la web pública no admite archivos.

La web y la plataforma comparten repositorio para mantener un respaldo coherente, pero se construyen y publican por separado. La plataforma utiliza Supabase para autenticación, datos, funciones y almacenamiento privado. Deben mantenerse documentados los encargados del tratamiento, la ubicación de los datos, las garantías aplicables, las pruebas de acceso y la política de conservación. Los textos legales deben revisarse si cambia la actividad, el modelo contractual o los proveedores técnicos.
