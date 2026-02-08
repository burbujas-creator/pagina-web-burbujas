export function obtenerContextoDolorense({
  timezone = "America/Argentina/Buenos_Aires",
} = {}) {
  const ahora = new Date();
  const fechaAR = new Date(
    ahora.toLocaleString("en-US", { timeZone: timezone })
  );

  const mes = fechaAR.getMonth() + 1;
  const dia = fechaAR.getDate();

  let fiesta = "";

  // FEBRERO: Carnaval del Sol
  if (mes === 2) {
    fiesta =
      "CONTEXTO LOCAL HOY: Estamos en temporada de CARNAVAL DEL SOL. Se hace en el Corsódromo Antú Kawin. Comparsas: Sheg Yenú, Sayén, Kuyén. Recordá recomendar llevar abrigo a la noche y que limpiamos ropa manchada de nieve/espuma.";
  }
  // MARZO: Fiesta Nacional de la Guitarra
  else if (mes === 3 && dia <= 15) {
    fiesta =
      "CONTEXTO LOCAL HOY: Estamos en la FIESTA NACIONAL DE LA GUITARRA. Homenaje a Abel Fleury. Hay desfile tradicionalista y feria artesanal. Ideal lavar ropa de peña.";
  }
  // MAYO: Torta Argentina
  else if (mes === 5 && dia >= 20 && dia <= 28) {
    fiesta =
      "CONTEXTO LOCAL HOY: FIESTA DE LA TORTA ARGENTINA (25 de Mayo) en Plaza Castelli. Receta histórica. Ojo con manchas de chocolate.";
  }
  // AGOSTO: Aniversario
  else if (mes === 8 && dia >= 15 && dia <= 25) {
    fiesta =
      "CONTEXTO LOCAL HOY: ANIVERSARIO DE DOLORES (21 de Agosto). Primer Pueblo Patrio. Actos en Plaza Castelli.";
  }

  return fiesta;
}
