// Copiar como config.js durante el despliegue y completar únicamente valores públicos.
window.RATIO_CONFIG = Object.freeze({
  mode: 'production',
  supabaseUrl: 'https://bvpeztdfwdbiielaione.supabase.co',
  supabaseAnonKey: 'sb_publishable_0Y0eIdsliv-v2TJ44xRGTw_hhRv0r5h',
  allowDemoAccess: false,
  appMode: 'portal' // Usar 'crm' exclusivamente en el despliegue interno del CRM.
});
