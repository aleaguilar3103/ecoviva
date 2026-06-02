// Cálculo de financiamiento EcoViva.
// Tasas: USD 9% anual, CRC 8% anual. Amortización francesa (cuota fija).
// Plazo hasta 20 años. Prima solo en lotes "frente a calle" de Llanada (25%).

export type Moneda = "USD" | "CRC";

export interface CuotaInput {
  monto: number;        // precio total del lote
  moneda: Moneda;
  plazoAnios: number;   // 5, 10, 15, 20
  primaPct?: number;    // 0 por defecto; 25 en frente a calle
}

export interface CuotaResultado {
  cuotaMensual: number;
  montoFinanciado: number;
  prima: number;
  primaPct: number;
  tasaAnual: number;
  plazoAnios: number;
  plazoMeses: number;
  moneda: Moneda;
}

export function tasaAnualPara(moneda: Moneda): number {
  return moneda === "USD" ? 9 : 8;
}

export function calcularCuota({ monto, moneda, plazoAnios, primaPct = 0 }: CuotaInput): CuotaResultado {
  const tasaAnual = tasaAnualPara(moneda);
  const prima = Math.round((monto * primaPct) / 100);
  const montoFinanciado = monto - prima;
  const r = tasaAnual / 100 / 12;
  const n = plazoAnios * 12;
  const cuotaMensual =
    r === 0 ? montoFinanciado / n : (montoFinanciado * r) / (1 - Math.pow(1 + r, -n));
  return {
    cuotaMensual: Math.round(cuotaMensual * 100) / 100,
    montoFinanciado,
    prima,
    primaPct,
    tasaAnual,
    plazoAnios,
    plazoMeses: n,
    moneda,
  };
}

export function formatMoneda(valor: number, moneda: Moneda): string {
  if (moneda === "USD") return `$${valor.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `₡${valor.toLocaleString("es-CR", { maximumFractionDigits: 0 })}`;
}
