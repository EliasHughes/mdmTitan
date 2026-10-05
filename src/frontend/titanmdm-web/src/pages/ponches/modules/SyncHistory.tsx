import { useEffect, useState } from "react";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";
import { authFetch } from "../lib/api";
import { Btn, PageHeader, Panel } from "../ui/kit";

type Row = {
  id?: number;
  fecha?: string;
  evento?: string;
  detalle?: string;
  registros?: number;
  estado?: string;
};

type Payload = {
  device: string;
  start: string;
  end: string;
};

type Result = {
  candidates?: number;
  inserts?: number;
  updates?: number;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  ignored?: number;
  sql_confirmed?: boolean;
  message?: string;
  warning?: string;
};

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

async function read(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Error ${response.status}`,
    );
  }

  return data;
}

export default function SyncHistory() {
  const [items, setItems] = useState<Row[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [device, setDevice] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    payload: Payload;
    result: Result;
  } | null>(null);

  async function load() {
    setLoading(true);

    try {
      const data = await read(
        await authFetch("/api/records/sync-history?limit=150"),
      );

      setItems(data.items ?? []);
      setDevices(
        (data.devices ?? []).map(
          (item: { name: string }) => item.name,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setError("");

    try {
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo cargar el historial",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function invalidate() {
    setPreview(null);
    setMessage("");
  }

  async function inspect() {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);

    const payload = { device, start, end };

    try {
      if (!device || !devices.includes(device)) {
        throw new Error("Selecciona un reloj registrado");
      }

      const result = await read(
        await authFetch("/api/records/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            dry_run: true,
            confirm: false,
          }),
        }),
      );

      setPreview({ payload, result });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo leer el reloj",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result: Result = await read(
        await authFetch("/api/records/sync-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...preview.payload,
            dry_run: false,
            confirm: true,
          }),
        }),
      );

      if (!result.sql_confirmed) {
        throw new Error(
          "El servidor no confirmó la escritura en SQL",
        );
      }

      setMessage(
        `${result.message || "Importación confirmada"}${
          result.warning ? ` · ${result.warning}` : ""
        }`,
      );

      setPreview(null);

      try {
        await load();
      } catch {
        setError(
          "SQL confirmado; no se pudo actualizar la bitácora " +
          "en pantalla. Presiona Actualizar historial.",
        );
      }
    } catch (e) {
      setPreview(null);
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo confirmar la importación",
      );
    } finally {
      setBusy(false);
    }
  }

  const completed = items.filter(
    (row) => row.estado === "ok",
  ).length;

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-5 page-enter">
      <PageHeader
        kicker="Operación"
        title="Sincronización de asistencia"
        subtitle="Importación reloj → SQL con vista previa y conservación de datos existentes."
        actions={
          <Btn
            tone="ghost"
            disabled={busy || loading}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} />
            Actualizar historial
          </Btn>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Eventos del historial", items.length, "kpi-violet"],
          ["Completados", completed, "kpi-emerald"],
          [
            "Otros estados",
            items.length - completed,
            "kpi-amber",
          ],
        ].map(([label, value, color]) => (
          <div
            key={String(label)}
            className={`kpi-tile ${color}`}
          >
            <span className="shine" />
            <p className="text-xs text-white/80">{label}</p>
            <p className="text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}

      <Panel>
        <h3 className="font-semibold">Importar desde un reloj</h3>
        <p className="my-3 text-xs text-zinc-500">
          Selecciona un reloj registrado y entre uno y siete días.
          La lectura no borra los datos del reloj.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void inspect();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs">
              Reloj
              <select
                required
                value={device}
                disabled={busy || loading}
                className={input}
                onChange={(event) => {
                  setDevice(event.target.value);
                  invalidate();
                }}
              >
                <option value="">
                  {loading
                    ? "Cargando relojes…"
                    : "Selecciona un reloj"}
                </option>
                {devices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              Desde
              <input
                type="date"
                required
                value={start}
                max={end}
                disabled={busy}
                className={input}
                onChange={(event) => {
                  setStart(event.target.value);
                  invalidate();
                }}
              />
            </label>

            <label className="grid gap-1 text-xs">
              Hasta
              <input
                type="date"
                required
                value={end}
                min={start}
                max={today()}
                disabled={busy}
                className={input}
                onChange={(event) => {
                  setEnd(event.target.value);
                  invalidate();
                }}
              />
            </label>
          </div>

          {!loading && !devices.length && (
            <p className="text-sm text-amber-700">
              No hay relojes disponibles en el catálogo recibido.
              Regístralos en Dispositivos y actualiza el historial.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || loading || !device}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Download size={16} />
            {busy ? "Procesando…" : "Leer y previsualizar"}
          </button>
        </form>
      </Panel>

      {preview && (
        <Panel>
          <h3 className="font-semibold">
            Vista previa · {preview.payload.device}
          </h3>
          <p className="my-2 text-sm text-zinc-500">
            {preview.payload.start} al {preview.payload.end}.
            Todavía no se ha escrito en SQL.
          </p>

          <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Filas candidatas", preview.result.candidates],
              ["Nuevas", preview.result.inserts],
              ["A completar", preview.result.updates],
              ["Sin cambios", preview.result.unchanged],
              ["Marcas ignoradas", preview.result.ignored],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl bg-zinc-50 p-3"
              >
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="text-xl font-bold">{value ?? 0}</p>
              </div>
            ))}
          </div>

          <p className="mb-3 text-xs text-zinc-500">
            Al confirmar se vuelve a leer el reloj.
            Se completan únicamente campos vacíos;
            los totales pueden cambiar si llegan nuevas marcas.
          </p>

          <Btn
            tone="primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            <ShieldCheck size={16} />
            Confirmar importación a SQL
          </Btn>
        </Panel>
      )}

      <Panel>
        <h3 className="mb-3 font-semibold">
          Historial de operaciones
        </h3>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-zinc-500">
                <th className="py-2">Fecha</th>
                <th>Evento</th>
                <th>Detalle</th>
                <th>Registros</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr
                  key={row.id ?? index}
                  className="border-t border-zinc-100"
                >
                  <td className="py-3 text-xs">{row.fecha}</td>
                  <td>{row.evento}</td>
                  <td className="max-w-lg whitespace-normal text-xs text-zinc-500">
                    {row.detalle}
                  </td>
                  <td>{row.registros ?? 0}</td>
                  <td
                    className={
                      row.estado === "ok"
                        ? "font-semibold text-emerald-600"
                        : "text-amber-700"
                    }
                  >
                    {row.estado}
                  </td>
                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-zinc-500"
                  >
                    {loading
                      ? "Cargando…"
                      : "Sin operaciones registradas"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}