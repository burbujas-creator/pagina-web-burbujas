export function estadoLocalAhora({
  timezone = "America/Argentina/Buenos_Aires",
  locale = "es-AR",
} = {}) {
  const ahora = new Date();

  const opciones = {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
    hour12: false,
  };

  const partes = new Intl.DateTimeFormat(locale, opciones).formatToParts(ahora);

  const hora = parseInt(partes.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minuto = parseInt(partes.find((p) => p.type === "minute")?.value ?? "0", 10);

  const diaRaw = (partes.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  const dia = diaRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quitar acentos

  const habil = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].includes(dia);

  const dentroHorario =
    (hora > 8 && hora < 21) || (hora === 8 && minuto >= 0);

  return habil && dentroHorario ? "abierto" : "cerrado";
}
