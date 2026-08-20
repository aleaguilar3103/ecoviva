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
