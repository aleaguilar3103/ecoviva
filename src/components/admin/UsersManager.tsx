import { useEffect, useState } from "react";
import {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  type AppUser,
  type AppRole,
} from "../../lib/adminApi";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "Pendiente" no es un estado guardado: es no haber entrado nunca.
function etiquetaEstado(u: AppUser): { texto: string; clase: string } {
  if (u.status === "disabled") return { texto: "Deshabilitado", clase: "bg-red-50 text-red-600" };
  if (!u.last_sign_in_at) return { texto: "Pendiente", clase: "bg-amber-50 text-amber-700" };
  return { texto: "Activo", clase: "bg-emerald-50 text-emerald-700" };
}

// Se compara por user_id y no por correo porque es lo mismo que hace el
// servidor (ver revisarGuardas en api/admin/users.ts): el correo de la sesión
// puede desincronizarse de app_users.email, o venir vacío. El id no cambia.
export default function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Conjunto de ids con una acción en vuelo, no un solo id: clic en la fila A y
  // enseguida en la fila B no debe rehabilitar los controles de A mientras su
  // pedido sigue pendiente.
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<AppRole>("vendedor");
  const [invitando, setInvitando] = useState(false);

  async function recargar() {
    try {
      const { users } = await getUsers();
      setUsuarios(users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function onInvitar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setInvitando(true);
    try {
      const { user, resent } = await inviteUser({
        email,
        full_name: nombre || undefined,
        role: rol,
      });
      setAviso(
        resent
          ? `Le reenviamos el acceso a ${user.email}.`
          : `Invitación enviada a ${user.email}.`,
      );
      setEmail("");
      setNombre("");
      setRol("vendedor");
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo invitar.");
    } finally {
      setInvitando(false);
    }
  }

  async function accion(id: string, fn: () => Promise<unknown>) {
    setError(null);
    setAviso(null);
    setOcupados((prev) => new Set(prev).add(id));
    try {
      await fn();
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupados((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function onReenviar(u: AppUser) {
    await accion(u.user_id, async () => {
      await inviteUser({ email: u.email, full_name: u.full_name ?? undefined, role: u.role });
      setAviso(`Le reenviamos el acceso a ${u.email}.`);
    });
  }

  async function onBorrar(u: AppUser) {
    if (!confirm(`¿Borrar la cuenta de ${u.email}? No se puede deshacer.`)) return;
    await accion(u.user_id, () => deleteUser(u.user_id));
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onInvitar}
        className="bg-white rounded-2xl ring-1 ring-slate-200/80 p-6 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-900 mb-1">Invitar a alguien</h2>
        <p className="text-sm text-slate-500 mb-4">
          Le llega un correo para crear su contraseña. Al terminar queda dentro.
        </p>

        <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
          <input
            type="email"
            required
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as AppRole)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={invitando}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {invitando ? "Enviando…" : "Invitar"}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Vendedor ve solo la guía de venta. Admin ve además este panel.
        </p>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {aviso && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</p>
      )}

      <div className="bg-white rounded-2xl ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Persona</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Último ingreso</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((u) => {
                  const estado = etiquetaEstado(u);
                  const esUnoMismo = u.user_id === currentUserId;
                  const trabajando = ocupados.has(u.user_id);
                  return (
                    <tr key={u.user_id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-900">
                          {u.full_name || u.email}
                        </span>
                        {u.full_name && (
                          <span className="block text-xs text-slate-400">{u.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={esUnoMismo || trabajando}
                          onChange={(e) =>
                            accion(u.user_id, () =>
                              updateUser(u.user_id, { role: e.target.value as AppRole }),
                            )
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none transition focus:border-emerald-500 disabled:opacity-50"
                        >
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}
                        >
                          {estado.texto}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatearFecha(u.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={trabajando || u.status === "disabled"}
                            onClick={() => onReenviar(u)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            Reenviar acceso
                          </button>
                          <button
                            type="button"
                            disabled={esUnoMismo || trabajando}
                            onClick={() =>
                              accion(u.user_id, () =>
                                updateUser(u.user_id, {
                                  status: u.status === "active" ? "disabled" : "active",
                                }),
                              )
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                          >
                            {u.status === "active" ? "Deshabilitar" : "Habilitar"}
                          </button>
                          <button
                            type="button"
                            disabled={esUnoMismo || trabajando}
                            onClick={() => onBorrar(u)}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
