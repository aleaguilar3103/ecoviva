// Errores de dominio de la agenda. Llevan un código para que cada transporte
// decida cómo presentarlos: el endpoint HTTP los mapea a 404/409, y el bot de
// Telegram los va a traducir a texto para la persona. Antes esto se resolvía
// comparando el mensaje exacto en cada consumidor, lo que obliga a mantener la
// misma cadena sincronizada a mano en varios archivos — un punto final de más
// degradaba un 409 a un 500 sin que ningún test lo notara.
export type CodigoError = "no_encontrada" | "conflicto";

export class ErrorAgenda extends Error {
  constructor(
    public readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorAgenda";
  }
}

// Se identifica por `name` y no con `instanceof` a propósito. `instanceof`
// exige que exista una sola copia del módulo en memoria: si por empaquetado
// o interoperación de formatos hubiera dos, devolvería false en silencio y
// los 404/409 se caerían a 500 sin que nada avise — justo el fallo mudo que
// este archivo vino a eliminar. Comparar el nombre y validar el código
// funciona igual sin importar cuántas copias haya.
export function esErrorAgenda(e: unknown): e is ErrorAgenda {
  return (
    e instanceof Error &&
    e.name === "ErrorAgenda" &&
    ((e as ErrorAgenda).codigo === "no_encontrada" ||
      (e as ErrorAgenda).codigo === "conflicto")
  );
}
