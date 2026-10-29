"""Saca del almacenamiento de GoHighLevel las imágenes, el video y los PDF del sitio (29-oct-2026).

GHL se canceló y la cuenta puede borrarse en cualquier momento. Los archivos ya están descargados
en backups/ghl/<fecha>/archivos (scripts/ghl-archivos.mjs). Este script:

  1. Sube imágenes y video a Cloudinary (cuenta dm4vljcnv, carpeta ecoviva/) con nombres descriptivos.
  2. Copia los PDF a public/ (los planos de Río Celeste salen de los originales visados de Alejandro;
     Cloudinary gratis bloquea la entrega de PDF).
  3. Reemplaza cada URL de GHL en el código por la nueva. La entrega usa f_auto,q_auto (WebP/AVIF según
     el navegador) y un ancho tope; el brochure en PDF usa JPG/PNG porque pdf-lib no lee WebP.

  python3 scripts/migrar-archivos-ghl.py backups/ghl/<fecha> [--subir]
Sin --subir solo muestra el plan.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time

RESPALDO = sys.argv[1]
SUBIR = "--subir" in sys.argv
PLANOS_RC = "/Users/alejandro/Documents/Work/Eco viva desarrollos/Rio Celeste/Planos visados rio celeste"

env = {}
for linea in open(".env.local"):
    if "=" in linea and not linea.startswith("#"):
        k, v = linea.rstrip("\n").split("=", 1)
        env[k] = v.strip().strip('"').strip("'")
CLOUD, KEY, SECRET = env["CLOUDINARY_CLOUD_NAME"], env["CLOUDINARY_API_KEY"], env["CLOUDINARY_API_SECRET"]
mapa = json.load(open(os.path.join(RESPALDO, "archivos", "_mapa.json")))

# id del archivo en GHL → (public_id en Cloudinary, tipo)
NOMBRES = {
    # marca
    "69000469edac70e1d55bc3f3.png": "marca/logo-principal",
    "69c305d3bbd71922fc0c18af.png": "marca/logo-blanco-horizontal",
    "69c305d3fe4d0d2527d5329a.png": "marca/logo-gris-horizontal",
    "69c305d339e3092e1873e357.png": "marca/logo-color-horizontal",
    "69c305d35108033476d8d97a.png": "marca/logo-color-vertical",
    "69c305d3bbd719a10c0c18b0.png": "marca/logo-blanco-vertical",
    "69c305d339e30902d473e358.png": "marca/logo-gris-vertical",
    "68f1f483a1e01adaf9ecb898.png": "marca/favicon",
    "68f202db4c291a48cd5466df.jpeg": "marca/compartir-redes",
    # inicio
    "69000dd3edac70812a5cac20.webp": "inicio/hero-1",
    "6982f5f42dd98576bbee6e8b.jpg": "inicio/hero-2",
    "6982f51e0708e42ab38c2735.jpg": "inicio/hero-3",
    "6982f6cc0708e42b488c5dc9.jpg": "inicio/hero-4",
    # Río Celeste
    "68f1ffe2175e59ba63672f87.jpeg": "rio-celeste/portada-1",
    "68f1ffe2a1e01a2679ee14be.jpeg": "rio-celeste/portada-2",
    "68f1fe534c291a1efd53d7a3.jpeg": "rio-celeste/portada-3",
    "68f1fe534c291af16553d7a1.jpeg": "rio-celeste/portada-4",
    # Lomas de la Llanada
    "6977ce95eb392bad08976b19.png": "llanada/galeria-1",
    "6977ce95f62bb7268496bdf7.png": "llanada/galeria-2",
    "6977ce95a87beb359e18dcf7.jpeg": "llanada/galeria-3",
    "6977ce95c1fa0c7535d7678f.jpeg": "llanada/galeria-4",
    "6977ce95d4fb90fa691c3dfb.jpeg": "llanada/galeria-5",
    "6977ce9529dcf5340895c73a.png": "llanada/galeria-6",
    "6977def1c1fa0c8c75dae07d.mp4": "llanada/video-recorrido",
    "69a39268753f157bbe49458c.png": "llanada/mapa-lotes-frente-a-calle",
    # funnels de anuncios
    "69c5813e146bc515f6df1405.jpg": "funnel/hero",
    "69c5813e6b0a70ae03223880.jpg": "funnel/lomas-1",
    "69c5813e52ad3bc301da4b5c.jpg": "funnel/lomas-2",
    "69c5813e4a4efa87ee0b7f00.jpg": "funnel/oasis-1",
    "69c5813e22e1edd33ceea225.jpg": "funnel/oasis-2",
    "69c5813e350cfe580a318cce.jpg": "funnel/franja-1",
    "69c5813e146bc5fcfedf1406.jpg": "funnel/franja-2",
    "69c5813e81e6bc935b6b211c.jpg": "funnel/cta",
    "69c58bd9e24981254b18a539.jpg": "funnel/llanada-fondo",
    # brandbook
    "69c30f0c4d943dc8a198868f.jpg": "brandbook/tarjeta-de-presentacion",
    "69c30f0c39e30927a3752581.jpg": "brandbook/identidad-corporativa",
    "69c30f0c51080376d3da1822.jpg": "brandbook/papeleria",
    "69c30f0c6bd30faa07319fcf.jpg": "brandbook/senalizacion-exterior",
    "69c30f0c7fba4b2f93d3cb65.jpg": "brandbook/laptop-taza-mousepad",
    "69c30f0c510803d8a8da1823.jpg": "brandbook/tazas",
    "69c30f0c3ab4d95775c8afda.jpg": "brandbook/gorras",
    "69c30f0c6bd30f9e9c319fd0.jpg": "brandbook/uniformes",
}
# Galería de Río Celeste: 19 fotos en el orden en que aparecen.
GALERIA_RC = [
    "6949c9f883fecf179ff0cb55", "6949c9f8eb54328052b38267", "6949c9f883fecf8958f0cb58", "6949c9f883fecf9209f0cb57",
    "6949c9f883fecf77c5f0cb56", "6949c9f8b624f91967606b7c", "6949c9f8671d502465db3676", "6949c9f8671d50d371db3675",
    "6949c9f859a0a6a81e790787", "6949d089eb54327c7eb48807", "6949d089eb543246ebb48806", "6949d089b624f939506172a3",
    "6949d08979fc96d018e380e8", "6949d08959a0a6eda17a1d22", "6949d08ab624f9d59f6172a4", "6949d089adf7e4751ccdbe80",
    "6949d089938f5c1938174c2d", "6949d089ee99d04d65b0d535", "6949d089b624f90a006172a2",
]
for i, gid in enumerate(GALERIA_RC, 1):
    NOMBRES[f"{gid}.jpg"] = f"rio-celeste/galeria-{i:02d}"

# PDF → ruta pública
PDF_LLANADA = {
    "6992aab1a9efde116d93226d.pdf": "/documentos/lomas-de-la-llanada-informacion.pdf",
    "69a38db5167da40c2a8967b1.pdf": "/documentos/lomas-de-la-llanada-lotes-frente-a-calle.pdf",
}
# Planos de Río Celeste: id en GHL → lote (el que GHL compartía entre 17 y 18 es el del 18).
PLANOS_GHL = {
    "6980e7b71311f6803fc45e31": 3, "6980e7b710efd660795e1e98": 4, "6980e7b766e7cab0330346a3": 5,
    "6980e7b766e7caf78c03469e": 6, "6980e7b77675770f0e3e8a77": 7, "6980e7b718ecce76ce26b5e1": 8,
    "6980e7b7767577e8b83e8a7d": 9, "6980e7b7f7a87780474e9c07": 10, "6980e7b71311f65290c45e33": 11,
    "6980e7b776757794463e8a7e": 14, "6980e7b8f7a87718884e9c0b": 15, "6980e7b83c458e581bd62b57": 16,
    "6980e7b71311f678e1c45e32": 18, "6980e7b776757707553e8a78": 19, "6980e7b766e7ca56f70346a2": 20,
}

PATRON = re.compile(r"https?://(?:storage\.googleapis\.com/msgsndr|assets\.cdn\.filesafe\.space)/[A-Za-z0-9]+/media/([A-Za-z0-9]+\.[a-z0-9]+)")


def entrega(public_id, archivo, contexto):
    """URL de entrega según dónde se usa."""
    base = f"https://res.cloudinary.com/{CLOUD}"
    if public_id.endswith("video-recorrido"):
        return f"{base}/video/upload/q_auto,vc_auto,w_1280,c_limit/ecoviva/{public_id}.mp4"
    if public_id == "marca/favicon":
        return f"{base}/image/upload/f_png,w_256,c_limit/ecoviva/{public_id}.png"
    if public_id == "marca/compartir-redes":
        return f"{base}/image/upload/f_jpg,q_auto,w_1200,h_630,c_fill,g_auto/ecoviva/{public_id}.jpg"
    if contexto.endswith("brochure.ts"):
        # pdf-lib solo lee JPG y PNG.
        if public_id.startswith("marca/"):
            return f"{base}/image/upload/f_png,w_800,c_limit/ecoviva/{public_id}.png"
        return f"{base}/image/upload/f_jpg,q_auto,w_1600,c_limit/ecoviva/{public_id}.jpg"
    ancho = 800 if public_id.startswith("marca/") else 1920
    return f"{base}/image/upload/f_auto,q_auto,w_{ancho},c_limit/ecoviva/{public_id}"


def local(ghl_id):
    for url, v in mapa.items():
        if url.endswith("/" + ghl_id) and v.get("archivo"):
            return os.path.join(RESPALDO, "archivos", v["archivo"])
    raise SystemExit(f"No está descargado: {ghl_id}")


def aligerar(ruta):
    """Cloudinary gratis acepta imágenes de hasta 10 MB: las más pesadas pasan a JPG de alta calidad."""
    if os.path.getsize(ruta) <= 9_500_000:
        return ruta
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(ruta).convert("RGB")
    im.thumbnail((4000, 4000))
    salida = ruta + ".liviano.jpg"
    im.save(salida, quality=92, optimize=True)
    print(f"  (aligerada: {round(os.path.getsize(ruta) / 1e6, 1)} MB → {round(os.path.getsize(salida) / 1e6, 1)} MB)")
    return salida


def subir(ruta, public_id, tipo):
    if tipo == "image":
        ruta = aligerar(ruta)
    ts = str(int(time.time()))
    params = {"public_id": f"ecoviva/{public_id}", "overwrite": "true", "timestamp": ts}
    firma = hashlib.sha1(("&".join(f"{k}={params[k]}" for k in sorted(params)) + SECRET).encode()).hexdigest()
    cmd = ["curl", "-s", "-X", "POST", f"https://api.cloudinary.com/v1_1/{CLOUD}/{tipo}/upload", "-F", f"file=@{ruta}",
           "-F", f"api_key={KEY}", "-F", f"signature={firma}"] + sum([["-F", f"{k}={v}"] for k, v in params.items()], [])
    r = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout or "{}")
    if "error" in r or "secure_url" not in r:
        raise SystemExit(f"Cloudinary {public_id}: {r.get('error', r)}")
    return r


# 1) Archivos usados en el código
salida = subprocess.run(["grep", "-rlE", PATRON.pattern, "src", "api", "index.html", "supabase"], capture_output=True, text=True).stdout.split()
ids = set()
for f in salida:
    ids.update(PATRON.findall(open(f).read()))

print(f"{len(ids)} archivos de GHL en {len(salida)} archivos del código")
plan = {}
for gid in sorted(ids):
    if gid.endswith(".pdf"):
        stem = gid[:-4]
        if stem in PLANOS_GHL:
            plan[gid] = ("plano", f"/planos/rio-celeste/lote-{PLANOS_GHL[stem]}.pdf")
        elif gid in PDF_LLANADA:
            plan[gid] = ("pdf", PDF_LLANADA[gid])
        else:
            raise SystemExit(f"PDF sin destino: {gid}")
    elif gid in NOMBRES:
        plan[gid] = ("video" if gid.endswith(".mp4") else "image", NOMBRES[gid])
    else:
        raise SystemExit(f"Archivo sin nombre asignado: {gid}")

for gid, (tipo, destino) in plan.items():
    print(f"  {tipo:6} {gid} → {destino}")
if not SUBIR:
    raise SystemExit("\n(solo plan; corré con --subir)")

# 2) Subir / copiar
os.makedirs("public/planos/rio-celeste", exist_ok=True)
os.makedirs("public/documentos", exist_ok=True)
for lote in [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20]:
    shutil.copyfile(os.path.join(PLANOS_RC, f"Inscripcion Celeste {lote}.pdf"), f"public/planos/rio-celeste/lote-{lote}.pdf")
for gid, (tipo, destino) in plan.items():
    if tipo == "pdf":
        shutil.copyfile(local(gid), "public" + destino)
    elif tipo in ("image", "video"):
        r = subir(local(gid), destino, tipo)
        print(f"  ✓ {destino}: {r['format']} {r.get('width')}×{r.get('height')} {round(r['bytes'] / 1e6, 1)} MB")

# 3) Reemplazar en el código
cambios = 0
for f in salida:
    texto = open(f).read()

    def reemplazo(m):
        gid = m.group(1)
        tipo, destino = plan[gid]
        if tipo in ("plano", "pdf"):
            return destino
        return entrega(destino, gid, f)

    nuevo = PATRON.sub(reemplazo, texto)
    if nuevo != texto:
        open(f, "w").write(nuevo)
        cambios += 1
print(f"{cambios} archivos del código actualizados")
