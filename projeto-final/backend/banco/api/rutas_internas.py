"""Rutas entre backends. El cliente no las usa: van directo de nodo a nodo.

`/interno/latido` renueva el arrendamiento. `/interno/replicar` trae una
entrada del log. `/interno/votar` solo corre cuando hay 3 nodos o más.
`/interno/log` es la puesta al día de quien volvió.
"""

from fastapi import APIRouter, HTTPException, Request

from banco.api.dependencias import NODO

router = APIRouter(prefix="/interno", tags=["interno"])


@router.get("/estado")
def estado_del_nodo():
    return NODO.estado()


@router.post("/latido")
async def latido(request: Request):
    if not NODO.base_disponible():
        raise HTTPException(status_code=503, detail={"erro": "sin_base"})
    return NODO.recibir_latido(await request.json())


@router.post("/replicar")
async def replicar(request: Request):
    return NODO.recibir_replicacion(await request.json())


@router.post("/votar")
async def votar(request: Request):
    return NODO.recibir_voto(await request.json())


@router.get("/log")
def log(desde: int = 0):
    return {"entradas": NODO.entradas_desde(desde)}
