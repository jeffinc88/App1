/**
 * Returns true if the materia name suggests "exatas" content
 * (math/physics/chemistry/etc.).
 */
const KEYWORDS = [
  "matematica", "matemática", "math",
  "fisica", "física", "physics",
  "calculo", "cálculo",
  "algebra", "álgebra",
  "geometria",
  "trigonometria",
  "estatistica", "estatística",
  "quimica", "química", "chemistry",
];

function normalize(s = "") {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function isExatasMateria(nome) {
  if (!nome) return false;
  const n = normalize(nome);
  return KEYWORDS.some((kw) => n.includes(normalize(kw)));
}
