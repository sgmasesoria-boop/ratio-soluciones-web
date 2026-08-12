const STATUS_LABELS:Record<string,string>={
  won:'contratado',lost:'cerrado',new:'nuevo',review:'en estudio',waiting:'pendiente',
  viable:'viable',proposal:'propuesta enviada',contract:'contrato pendiente',
  open:'abierto',study:'en estudio',action:'en gestión',response:'respuesta recibida',
  resolution:'resolución',closed:'cerrado',archived:'archivado'
};
const CONTEXT_STATUS:Record<string,Record<string,string>>={
  case:{open:'expediente abierto',study:'expediente en estudio',action:'expediente en gestión',response:'respuesta recibida',resolution:'expediente en resolución',closed:'expediente cerrado',archived:'expediente archivado'},
  lead:{new:'consulta nueva',review:'consulta en estudio',waiting:'consulta pendiente de información',viable:'consulta viable',proposal:'propuesta enviada',contract:'contrato pendiente',won:'consulta contratada',lost:'consulta no viable o cerrada'},
  request:{pending:'petición pendiente',submitted:'respuesta entregada',accepted:'petición revisada',cancelled:'petición cancelada'},
  document:{uploaded:'documento recibido',submitted:'documento entregado',accepted:'documento revisado',rejected:'documento rechazado'}
};

const INTERNAL_REFERENCE=/\[(?:case|lead|lead_note|event|request|document):[^\]]+\]/gi;
const BARE_INTERNAL_REFERENCE=/\b(?:case|lead|lead_note|event|request|document):[0-9a-f-]{8,}\b/gi;
const UUID=/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const INTERNAL_STATUS=new RegExp(`\\b(${Object.keys(STATUS_LABELS).join('|')})\\b`,'gi');
const TECHNICAL_SENTENCE=/\b(source_ids?|uuid|metadatos?|base de datos|tabla interna|campo interno|modelo de (?:ia|inteligencia artificial)|contenido_anali[sz]ado)\b/i;

export function humanizeInternalStatus(value:unknown,context:string){
  const status=String(value??'').trim().toLowerCase();
  return CONTEXT_STATUS[context]?.[status]||STATUS_LABELS[status]||status;
}

export function sanitizeClientDraft(value:unknown,max=1800){
  const withoutReferences=String(value??'')
    .replace(INTERNAL_REFERENCE,'')
    .replace(BARE_INTERNAL_REFERENCE,'')
    .replace(UUID,'')
    .replace(INTERNAL_STATUS,match=>STATUS_LABELS[match.toLowerCase()]||match);
  const sentences=withoutReferences.split(/(?<=[.!?])\s+|\n+/).filter(sentence=>sentence.trim()&&!TECHNICAL_SENTENCE.test(sentence));
  const sanitized=sentences.join(' ')
    .replace(/[«»]/g,'')
    .replace(/[ \t]{2,}/g,' ')
    .replace(/\s+([,.;:])/g,'$1')
    .trim()
    .slice(0,max)
    .trim();
  return sanitized||'Hemos revisado tu expediente. El equipo debe completar una comprobación interna antes de comunicarte el siguiente paso.';
}
