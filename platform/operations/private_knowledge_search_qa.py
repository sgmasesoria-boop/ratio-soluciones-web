import gzip
import json
import re
import tempfile
import threading
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

from dpapi_current_user import protect_current_user
from private_knowledge_search import KnowledgeLibrary, make_handler


def terms_for(text: str) -> list[list[object]]:
    counts = Counter(re.findall(r"[a-záéíóúüñ0-9]{3,}", text.lower()))
    return [[word, count] for word, count in counts.most_common(200) if not word.isdigit()]


def main() -> None:
    samples = {
        "a" * 64: "Doña Persona Ficticia Pruebas, DNI 12345678Z, correo qa@example.invalid y teléfono 600000000. Demanda sobre tarjeta revolving y préstamo bancario. Se solicita la nulidad de la cláusula y devolución de intereses.",
        "b" * 64: "Sentencia de divorcio con medidas de custodia, alimentos y régimen de visitas.",
        "c" * 64: "Recurso administrativo frente a liquidación tributaria y sanción de Hacienda.",
    }
    with tempfile.TemporaryDirectory(prefix="ratio-knowledge-qa-") as temporary:
        root = Path(temporary)
        (root / "text-encrypted").mkdir(parents=True)
        (root / "ocr-encrypted").mkdir(parents=True)
        (root / "index-encrypted").mkdir(parents=True)
        documents = []
        for sha, text in samples.items():
            cipher = protect_current_user(text.encode("utf-8"))
            (root / "text-encrypted" / f"{sha}.text.dpapi").write_bytes(cipher)
            documents.append({"sha256": sha, "terms": terms_for(text), "characters": len(text)})
        payload = {"version": 1, "documents": documents}
        compressed = gzip.compress(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        (root / "index-encrypted" / "biblioteca-juridica.index.json.gz.dpapi").write_bytes(protect_current_user(compressed))

        library = KnowledgeLibrary(root)
        results = library.search("tarjeta revolving banco", 5)
        assert results and results[0]["sha256"] == "a" * 64
        assert "revolving" in results[0]["matchedTerms"]
        assert "12345678Z" not in results[0]["excerpt"]
        assert "qa@example.invalid" not in results[0]["excerpt"]
        assert "600000000" not in results[0]["excerpt"]
        context = library.context("tarjeta revolving banco", [results[0]["sha256"]])
        assert context["documents"] and "revolving" in context["documents"][0]["excerpt"].lower()
        assert context["externalTransmission"] is False
        assert context["anonymized"] is True
        assert context["anonymization"] == "automatic_redaction_review_required"
        assert context["redactionVersion"] == "ratio-local-v2"
        assert context["directIdentifiersDetected"] is False
        audit = (root / "logs" / "private-search-audit.jsonl").read_text(encoding="utf-8")
        assert "tarjeta revolving banco" not in audit
        assert '"queryTextStored":false' in audit

        token = "synthetic-session-token"
        from http.server import ThreadingHTTPServer
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(library, token))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with urllib.request.urlopen(base + "/", timeout=5) as response:
                page = response.read().decode("utf-8")
                assert response.status == 200
                assert "Biblioteca jurídica privada" in page
                assert response.headers["Cache-Control"] == "no-store, max-age=0"
                assert response.headers["X-Frame-Options"] == "DENY"
            request = urllib.request.Request(
                base + "/api/search",
                data=json.dumps({"query": "tarjeta revolving banco", "limit": 5}).encode("utf-8"),
                headers={"Content-Type": "application/json", "X-Ratio-Session": token},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
                assert response.status == 200
                assert payload["results"][0]["sha256"] == "a" * 64
                assert payload["externalTransmission"] is False
            preflight = urllib.request.Request(
                base + "/api/search",
                headers={
                    "Origin": "https://crm.ratiosoluciones.es",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type,x-ratio-session",
                    "Access-Control-Request-Private-Network": "true",
                },
                method="OPTIONS",
            )
            with urllib.request.urlopen(preflight, timeout=5) as response:
                assert response.status == 204
                assert response.headers["Access-Control-Allow-Origin"] == "https://crm.ratiosoluciones.es"
                assert response.headers["Access-Control-Allow-Private-Network"] == "true"
            unauthorized = urllib.request.Request(
                base + "/api/search",
                data=json.dumps({"query": "tarjeta revolving banco"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                urllib.request.urlopen(unauthorized, timeout=5)
                raise AssertionError("Unauthorized request unexpectedly succeeded")
            except urllib.error.HTTPError as error:
                assert error.code == 403
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
    print("PRIVATE_KNOWLEDGE_SEARCH_QA_OK")


if __name__ == "__main__":
    main()

