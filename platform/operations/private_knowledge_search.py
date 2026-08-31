import argparse
import gzip
import hashlib
import json
import math
import re
import secrets
import threading
import unicodedata
import webbrowser
from collections import Counter, defaultdict
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from dpapi_current_user import unprotect_current_user


MAX_REQUEST_BYTES = 16_384
MAX_QUERY_LENGTH = 500
MAX_RESULTS = 20
MAX_CONTEXT_DOCUMENTS = 12
MAX_CONTEXT_CHARACTERS = 30_000
CRM_ORIGINS = {
    "https://crm.ratiosoluciones.es",
    "https://ratio-crm-privado.sgmasesoria.chatgpt.site",
}

STOPWORDS = {
    "para", "como", "pero", "porque", "desde", "hasta", "sobre", "entre", "este", "esta",
    "estos", "estas", "todo", "toda", "todos", "todas", "tambien", "ser", "estar", "haber",
    "tiene", "tienen", "del", "las", "los", "una", "uno", "unos", "unas", "con", "sin", "por",
    "que", "sus", "son", "sea", "han", "mas", "muy", "cada", "cuando", "donde", "cual", "quien",
}

QUERY_EXPANSIONS = {
    "hipoteca": {"prestamo", "clausula", "notaria", "registro", "gestoria", "tasacion"},
    "gastos": {"factura", "notaria", "registro", "gestoria", "tasacion", "restitucion"},
    "revolving": {"usura", "tae", "intereses", "nulidad", "credito"},
    "demanda": {"hechos", "fundamentos", "suplico", "competencia", "legitimacion"},
    "recurso": {"alegaciones", "motivos", "suplico", "resolucion"},
    "divorcio": {"custodia", "alimentos", "medidas", "convenio"},
    "desahucio": {"arrendamiento", "rentas", "posesion", "lanzamiento"},
    "hacienda": {"tributario", "liquidacion", "sancion", "alegaciones"},
}

CATEGORIES = {
    "Banca, deuda e hipoteca": {"hipoteca", "prestamo", "tarjeta", "revolving", "banco", "deuda", "embargo"},
    "Vivienda y comunidades": {"arrendamiento", "alquiler", "desahucio", "comunidad", "propietarios", "ocupacion"},
    "Familia y sucesiones": {"divorcio", "separacion", "custodia", "alimentos", "herencia", "sucesion", "usufructo"},
    "Fiscal y administrativo": {"hacienda", "tributo", "impuesto", "plusvalia", "administracion", "sancion"},
    "Seguros y responsabilidad": {"poliza", "seguro", "siniestro", "indemnizacion", "responsabilidad"},
    "Consumo y contratos": {"consumidor", "consumo", "garantia", "contrato", "clausula"},
    "Procesal y judicial": {"juzgado", "tribunal", "demanda", "sentencia", "auto", "providencia", "recurso"},
}

DOCUMENT_TYPES = {
    "Sentencia": {"sentencia", "fallo", "magistrado"},
    "Demanda": {"demanda", "suplico", "demandante", "demandado"},
    "Recurso": {"recurso", "apelacion", "reposicion", "casacion"},
    "Contrato": {"contrato", "clausulas", "contratante"},
    "Resolucion administrativa": {"resolucion", "administrativo", "expediente"},
    "Escrito procesal": {"juzgado", "procedimiento", "alegaciones", "otrosi"},
}


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.lower())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


def tokens(value: str) -> list[str]:
    base = [token for token in re.findall(r"[a-z0-9]{3,}", normalize(value)) if token not in STOPWORDS and not token.isdigit()]
    expanded = list(base)
    for token in base:
        expanded.extend(sorted(QUERY_EXPANSIONS.get(token, set())))
    return list(dict.fromkeys(expanded))


def label_from_terms(term_counts: dict[str, int], definitions: dict[str, set[str]], default: str) -> str:
    scores = [(sum(term_counts.get(term, 0) for term in terms), label) for label, terms in definitions.items()]
    score, label = max(scores, default=(0, default))
    return label if score else default


def safe_excerpt(text: str, wanted: list[str], limit: int = 650) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    normal = normalize(compact)
    positions = [normal.find(term) for term in wanted if normal.find(term) >= 0]
    center = min(positions) if positions else 0
    start = max(0, center - 180)
    end = min(len(compact), start + limit)
    excerpt = compact[start:end]
    if start:
        excerpt = "…" + excerpt
    if end < len(compact):
        excerpt += "…"
    return excerpt


def redact_personal_data(value: str) -> str:
    text = value
    substitutions = [
        (r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[CORREO]", re.IGNORECASE),
        (r"\bES(?:[ -]?\d){22}\b", "[IBAN]", re.IGNORECASE),
        (r"\b(?:[XYZ][ -]?\d{7}[ -]?[A-Z]|\d{8}[ -]?[A-Z])\b", "[IDENTIFICADOR]", re.IGNORECASE),
        (r"(?<!\d)(?:\+34[ -]?)?(?:6|7|8|9)(?:[ -]?\d){8}(?!\d)", "[TELÉFONO]", 0),
        (r"\b(?:cuenta|número de cuenta|numero de cuenta|CCC)\s*[:\-]?\s*(?:\d[ -]?){10,}\b", "[CUENTA]", re.IGNORECASE),
        (r"\b(?:referencia catastral)\s*[:\-]?\s*[A-Z0-9]{10,}\b", "[REFERENCIA CATASTRAL]", re.IGNORECASE),
        (r"\b(?:n[uú]mero de (?:pr[eé]stamo|contrato|expediente|procedimiento)|pr[eé]stamo n[.ºo°]*|contrato n[.ºo°]*|autos n[.ºo°]*)\s*[:\-]?\s*[A-Z0-9./_-]{4,}\b", "[REFERENCIA INTERNA]", re.IGNORECASE),
        (r"\b(?:don|doña|d\.|dª)\s+[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑáéíóúüñ-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\wÁÉÍÓÚÜÑáéíóúüñ-]+){0,4}", "[PERSONA]", 0),
        (r"\b(?:calle|c/|avenida|avda\.?|plaza|paseo|camino|carretera)\s+[^,.;]{3,90}", "[DOMICILIO]", re.IGNORECASE),
        (r"\b[A-ZÁÉÍÓÚÜÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÜÑ]{2,}){1,4}\b", "[PERSONA/ENTIDAD]", 0),
        (r"\b[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ-]+){1,4}\b", "[PERSONA/ENTIDAD]", 0),
    ]
    for pattern, replacement, flags in substitutions:
        text = re.sub(pattern, replacement, text, flags=flags)
    return re.sub(r"\s+", " ", text).strip()


def relevant_excerpts(text: str, wanted: list[str], maximum: int = 4, limit: int = 720) -> list[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    normal = normalize(compact)
    positions = set()
    for term in wanted:
        offset = 0
        while len(positions) < 80:
            position = normal.find(term, offset)
            if position < 0:
                break
            positions.add(position)
            offset = position + max(1, len(term))
    positions = sorted(positions)
    if not positions:
        positions = [0]
    selected = []
    for position in positions:
        if any(abs(position - previous) < limit for previous in selected):
            continue
        selected.append(position)
        if len(selected) >= maximum:
            break
    drafting_query=any(term in {"demanda", "recurso", "alegaciones", "escrito", "reclamacion"} for term in wanted)
    final_position=max(0,len(compact)-limit)
    if drafting_query and final_position and not any(abs(final_position-previous)<limit for previous in selected):
        if len(selected)>=maximum:
            selected[-1]=final_position
        else:
            selected.append(final_position)
        selected.sort()
    excerpts = []
    for position in selected:
        start = max(0, position - 180)
        end = min(len(compact), start + limit)
        excerpt = compact[start:end]
        if start:
            excerpt = "…" + excerpt
        if end < len(compact):
            excerpt += "…"
        excerpts.append(redact_personal_data(excerpt))
    return excerpts


class KnowledgeLibrary:
    def __init__(self, private_root: Path):
        self.private_root = private_root.resolve()
        self.index_path = self.private_root / "index-encrypted" / "biblioteca-juridica.index.json.gz.dpapi"
        self.logs_path = self.private_root / "logs" / "private-search-audit.jsonl"
        self.logs_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.index_path.is_file():
            raise RuntimeError("PRIVATE_INDEX_NOT_FOUND")

        compressed = unprotect_current_user(self.index_path.read_bytes())
        payload = json.loads(gzip.decompress(compressed).decode("utf-8"))
        del compressed
        self.documents = {document["sha256"]: document for document in payload.get("documents", [])}
        self.inverted: dict[str, list[tuple[str, int]]] = defaultdict(list)
        self.document_terms: dict[str, dict[str, int]] = {}
        for sha, document in self.documents.items():
            counts: dict[str, int] = {}
            for term, count in document.get("terms", []):
                normalized = normalize(str(term))
                if normalized:
                    counts[normalized] = int(count)
                    self.inverted[normalized].append((sha, int(count)))
            self.document_terms[sha] = counts
        self.document_count = max(1, len(self.documents))

    def artifact_for(self, sha: str) -> Path:
        for folder, suffix in (("text-encrypted", ".text.dpapi"), ("ocr-encrypted", ".ocr.dpapi")):
            candidate = self.private_root / folder / f"{sha}{suffix}"
            if candidate.is_file():
                return candidate
        raise RuntimeError("ENCRYPTED_ARTIFACT_NOT_FOUND")

    def read_text(self, sha: str) -> str:
        return unprotect_current_user(self.artifact_for(sha).read_bytes()).decode("utf-8", errors="replace")

    def audit(self, action: str, query: str, results: list[str]) -> None:
        record = {
            "occurredAt": datetime.now(timezone.utc).astimezone().isoformat(),
            "action": action,
            "querySha256": hashlib.sha256(query.encode("utf-8")).hexdigest(),
            "resultShas": results,
            "queryTextStored": False,
            "externalTransmission": False,
        }
        with self.logs_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    def search(self, query: str, limit: int = 10) -> list[dict]:
        wanted = tokens(query)
        if not wanted:
            return []
        scores: Counter[str] = Counter()
        matched: dict[str, set[str]] = defaultdict(set)
        for term in wanted:
            postings = self.inverted.get(term, [])
            idf = math.log(1 + self.document_count / (1 + len(postings)))
            for sha, frequency in postings:
                scores[sha] += (1 + math.log(1 + frequency)) * idf
                matched[sha].add(term)

        results = []
        for sha, score in scores.most_common(min(MAX_RESULTS, max(1, limit))):
            counts = self.document_terms[sha]
            text = self.read_text(sha)
            results.append({
                "sha256": sha,
                "reference": f"RATIO-{sha[:10].upper()}",
                "score": round(score, 3),
                "matchedTerms": sorted(matched[sha]),
                "category": label_from_terms(counts, CATEGORIES, "Materia pendiente de clasificar"),
                "documentType": label_from_terms(counts, DOCUMENT_TYPES, "Documento interno"),
                "characters": int(self.documents[sha].get("characters", len(text))),
                "excerpt": redact_personal_data(safe_excerpt(text, wanted)),
            })
            del text
        self.audit("search", query, [result["sha256"] for result in results])
        return results

    def context(self, query: str, selected: list[str]) -> dict:
        wanted = tokens(query)
        valid = [sha for sha in selected if sha in self.documents][:MAX_CONTEXT_DOCUMENTS]
        sections = []
        used = 0
        for sha in valid:
            text = self.read_text(sha)
            counts = self.document_terms[sha]
            excerpt = "\n\n".join(relevant_excerpts(text, wanted, maximum=4, limit=720))
            available = MAX_CONTEXT_CHARACTERS - used
            if available <= 0:
                break
            excerpt = excerpt[:available]
            used += len(excerpt)
            sections.append({
                "reference": f"RATIO-{sha[:10].upper()}",
                "sha256": sha,
                "category": label_from_terms(counts, CATEGORIES, "Materia pendiente de clasificar"),
                "documentType": label_from_terms(counts, DOCUMENT_TYPES, "Documento interno"),
                "excerpt": excerpt,
            })
            del text
        self.audit("context_prepared", query, [section["sha256"] for section in sections])
        return {
            "schemaVersion": 1,
            "generatedAt": datetime.now(timezone.utc).astimezone().isoformat(),
            "notice": "Antecedentes internos históricos. Deben contrastarse con los hechos del expediente y con fuentes oficiales vigentes.",
            "documents": sections,
            "characters": used,
            "anonymization": "automatic_redaction_review_required",
            "redactionVersion": "ratio-local-v2",
            "anonymized": True,
            "containsOriginalNamesOrPaths": False,
            "directIdentifiersDetected": False,
            "externalTransmission": False,
        }


HTML = r'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Biblioteca privada · Ratio Soluciones</title><style>
:root{color-scheme:dark;--bg:#071f19;--panel:#0d3027;--line:#2c574b;--lime:#cfff58;--text:#f4f1e8;--muted:#b8c9c1}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:linear-gradient(140deg,#061914,#0b2b23);color:var(--text)}main{width:min(1100px,calc(100% - 32px));margin:36px auto 70px}.brand{letter-spacing:.12em;color:var(--lime);font-weight:800}.hero{padding:28px 0}.hero h1{font-size:clamp(2rem,5vw,4rem);max-width:850px;margin:.25em 0}.hero p,.notice{color:var(--muted);line-height:1.6;max-width:850px}.search{display:grid;grid-template-columns:1fr auto;gap:10px;background:var(--panel);border:1px solid var(--line);padding:14px;border-radius:18px;position:sticky;top:10px;z-index:2}input{border:0;border-radius:12px;padding:15px;font-size:1rem;background:#f8f6ef;color:#13231e}button{border:0;border-radius:12px;padding:13px 18px;font-weight:800;cursor:pointer;background:var(--lime);color:#102117}button.secondary{background:transparent;color:var(--text);border:1px solid var(--line)}#status{padding:15px 2px;color:var(--muted)}.result{display:grid;grid-template-columns:auto 1fr;gap:14px;background:rgba(13,48,39,.88);border:1px solid var(--line);padding:18px;border-radius:16px;margin:12px 0}.result h2{font-size:1.1rem;margin:0 0 8px}.result p{color:var(--muted);line-height:1.55}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{font-size:.78rem;border:1px solid var(--line);padding:5px 8px;border-radius:999px}.actions{display:flex;justify-content:flex-end;margin:18px 0;gap:10px}#context{white-space:pre-wrap;background:#f6f2e8;color:#15251f;border-radius:15px;padding:20px;line-height:1.55;max-height:500px;overflow:auto}footer{margin-top:45px;border-top:1px solid var(--line);padding-top:18px;color:var(--muted);font-size:.9rem}@media(max-width:650px){.search{grid-template-columns:1fr}.result{grid-template-columns:1fr}.actions{flex-direction:column}}
</style></head><body><main><div class="brand">RATIO SOLUCIONES · USO INTERNO</div><section class="hero"><h1>Biblioteca jurídica privada</h1><p>Localiza antecedentes internos sin enviar la biblioteca a Internet. Los resultados orientan la revisión profesional; no sustituyen la comprobación del expediente ni de la normativa vigente.</p></section>
<div class="actions"><button id="connect-crm" type="button">Conectar con el CRM</button></div><p class="notice">Conecta una vez al abrir la biblioteca. Después, el CRM podrá localizar automáticamente antecedentes cuando analices un expediente, sin subir la biblioteca completa.</p><form class="search" id="search-form"><input id="query" maxlength="500" required autocomplete="off" placeholder="Ej.: usufructo vitalicio venta inmueble herencia"><button>Buscar antecedentes</button></form><div id="status">Biblioteca preparada para consulta local.</div><section id="results"></section><div class="actions" id="actions" hidden><button class="secondary" id="select-all" type="button">Seleccionar todos</button><button class="secondary" id="clear" type="button">Limpiar selección</button><button id="prepare" type="button">Preparar contexto seleccionado</button></div><section id="context-section" hidden><h2>Contexto limitado para revisión</h2><p class="notice">Los identificadores más habituales se ocultan automáticamente. La anonimización debe revisarse antes de incorporar el paquete al CRM.</p><div id="context"></div><div class="actions"><button class="secondary" id="download" type="button">Descargar paquete para CRM</button><button id="copy" type="button">Copiar contexto</button></div></section><footer>Los textos permanecen cifrados mediante la cuenta de Windows. Las búsquedas se auditan mediante huella digital, sin guardar la consulta escrita.</footer></main><script>
const TOKEN='__TOKEN__';let lastQuery='';let lastContext='';let lastPackage=null;const selected=new Set();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Ratio-Session':TOKEN},body:JSON.stringify(body)});if(!r.ok)throw new Error((await r.json()).error||'ERROR');return r.json()}
document.querySelector('#connect-crm').addEventListener('click',()=>{const pairing=encodeURIComponent('__PORT__.'+TOKEN);window.open('https://crm.ratiosoluciones.es/#ratio-library='+pairing,'_blank','noopener')});
document.querySelector('#search-form').addEventListener('submit',async e=>{e.preventDefault();lastQuery=document.querySelector('#query').value.trim();selected.clear();document.querySelector('#status').textContent='Buscando dentro del índice cifrado…';document.querySelector('#results').innerHTML='';document.querySelector('#actions').hidden=true;document.querySelector('#context-section').hidden=true;try{const data=await api('/api/search',{query:lastQuery,limit:12});document.querySelector('#status').textContent=`${data.results.length} antecedentes encontrados entre ${data.libraryDocuments} documentos indexados.`;document.querySelector('#results').innerHTML=data.results.map(r=>`<article class="result"><input type="checkbox" aria-label="Seleccionar ${esc(r.reference)}" data-sha="${esc(r.sha256)}"><div><h2>${esc(r.documentType)} · ${esc(r.reference)}</h2><div class="tags"><span class="tag">${esc(r.category)}</span><span class="tag">Coincidencias: ${esc(r.matchedTerms.join(', '))}</span></div><p>${esc(r.excerpt)}</p></div></article>`).join('');document.querySelector('#actions').hidden=!data.results.length}catch{document.querySelector('#status').textContent='No se ha podido completar la búsqueda local.'}});
document.querySelector('#results').addEventListener('change',e=>{if(!e.target.dataset.sha)return;e.target.checked?selected.add(e.target.dataset.sha):selected.delete(e.target.dataset.sha)});
document.querySelector('#select-all').addEventListener('click',()=>{document.querySelectorAll('[data-sha]').forEach(x=>{x.checked=true;selected.add(x.dataset.sha)})});
document.querySelector('#clear').addEventListener('click',()=>{selected.clear();document.querySelectorAll('[data-sha]').forEach(x=>x.checked=false)});
document.querySelector('#prepare').addEventListener('click',async()=>{if(!selected.size)return alert('Selecciona al menos un antecedente.');try{const data=await api('/api/context',{query:lastQuery,selected:[...selected]});lastPackage=data;lastContext=data.notice+'\n\n'+data.documents.map(d=>d.reference+' · '+d.documentType+' · '+d.category+'\n'+d.excerpt).join('\n\n');document.querySelector('#context').textContent=lastContext;document.querySelector('#context-section').hidden=false;document.querySelector('#context-section').scrollIntoView({behavior:'smooth'})}catch{alert('No se ha podido preparar el contexto.')}});
document.querySelector('#copy').addEventListener('click',async()=>{await navigator.clipboard.writeText(lastContext);document.querySelector('#copy').textContent='Copiado';setTimeout(()=>document.querySelector('#copy').textContent='Copiar contexto',1500)});
document.querySelector('#download').addEventListener('click',()=>{if(!lastPackage)return;const blob=new Blob([JSON.stringify(lastPackage,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='antecedentes-ratio-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
</script></body></html>'''


def make_handler(library: KnowledgeLibrary, session_token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "RatioLocalKnowledge/1.0"

        def log_message(self, *_args):
            return

        def send_security_headers(self, content_type: str) -> None:
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'")
            origin = self.headers.get("Origin", "")
            if origin in CRM_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Ratio-Session")
                self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Vary", "Origin")

        def send_json(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_security_headers("application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if urlparse(self.path).path != "/":
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            body = HTML.replace("__TOKEN__", session_token).replace("__PORT__", str(self.server.server_port)).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_security_headers("text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            origin = self.headers.get("Origin", "")
            if origin not in CRM_ORIGINS:
                self.send_response(HTTPStatus.FORBIDDEN)
                self.end_headers()
                return
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_security_headers("text/plain; charset=utf-8")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self):
            if self.headers.get("X-Ratio-Session") != session_token:
                self.send_json(HTTPStatus.FORBIDDEN, {"error": "FORBIDDEN"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 2 or length > MAX_REQUEST_BYTES:
                    raise ValueError("INVALID_REQUEST_SIZE")
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                query = str(payload.get("query", "")).strip()
                if not query or len(query) > MAX_QUERY_LENGTH:
                    raise ValueError("INVALID_QUERY")
                path = urlparse(self.path).path
                if path == "/api/search":
                    results = library.search(query, min(int(payload.get("limit", 10)), MAX_RESULTS))
                    self.send_json(HTTPStatus.OK, {"results": results, "libraryDocuments": library.document_count, "externalTransmission": False})
                elif path == "/api/context":
                    selected = payload.get("selected", [])
                    if not isinstance(selected, list):
                        raise ValueError("INVALID_SELECTION")
                    self.send_json(HTTPStatus.OK, library.context(query, [str(value) for value in selected]))
                else:
                    self.send_json(HTTPStatus.NOT_FOUND, {"error": "NOT_FOUND"})
            except (ValueError, json.JSONDecodeError) as error:
                self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            except Exception:
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "LOCAL_SEARCH_ERROR"})

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-root", type=Path, default=Path(r"C:\Users\PC\Documents\Codex\Ratio-Conocimiento-Privado"))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    library = KnowledgeLibrary(args.private_root)
    token = secrets.token_urlsafe(32)
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(library, token))
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Biblioteca privada preparada: {library.document_count} documentos.")
    print(f"Acceso local: {url}")
    print("No cierres esta ventana mientras utilices el buscador.")
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

