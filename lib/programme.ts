import type { Skill } from "./domain";
export const referenceDocument = {
  id: "programme-officiel-2026",
  name: "Programme officiel · Première spécialité mathématiques · 2026",
  size: 354852,
  sha256: "5303df0fcf6335f06d00c969a61dcd82cc3fdfd105271ae5c2ef580ff49b6c08",
  scope: "general",
  created_at: "2026-11-06T00:00:00.000Z",
};
export const sourceBase = {
  reference:
    "BO n° 14 du 2 avril 2026 · arrêté du 26 février 2026 · NOR MENE2602917A",
  version: "Rentrée 2026–2027",
  url: "https://www.education.gouv.fr/bo/2026/Hebdo14/MENE2602917A",
  pdf: "https://www.education.gouv.fr/sites/default/files/document/Annexe%20%E2%80%93%20Programme%20d&%23039;enseignement%20de%20sp%C3%A9cialit%C3%A9%20de%20math%C3%A9matiques%20de%20la%20classe%20de%20premi%C3%A8re%20de%20la%20voie%20g%C3%A9n%C3%A9rale-515408.pdf",
  retrievedAt: "2026-11-06",
  page: 6,
  status: "PDF conservé dans Repère",
  documentId: referenceDocument.id,
  catalogueVersion: "detail-2026-1",
};
const tasks = (
  prefix: string,
  groups: [string, [string, string][]][],
): Skill[] =>
  groups.flatMap(([group, list]) =>
    list.map(([id, label]) => ({ id: prefix + "-" + id, label, group })),
  );
// Pedagogical tasks authored from page 6. These labels are not official quotations.
export const programme = [
  {
    id: "suites",
    title: "Suites numériques",
    initialState: "active",
    excerpt:
      "Calculer des termes d’une suite définie explicitement, par récurrence ou par un algorithme.",
    skills: tasks("su", [
      [
        "Définir et représenter une suite",
        [
          ["indice", "Distinguer le rang n du terme uₙ"],
          ["premier", "Identifier le premier terme et son indice"],
          ["explicite", "Calculer un terme à partir d’une formule en n"],
          ["recurrence", "Calculer plusieurs termes par récurrence"],
          ["nuage", "Placer et lire les points (n ; uₙ)"],
          ["motif", "Traduire un motif géométrique en règle de calcul"],
        ],
      ],
      [
        "Suites arithmétiques",
        [
          ["arith-reconnaitre", "Reconnaître un accroissement constant"],
          ["arith-raison", "Déterminer la raison d’une suite arithmétique"],
          ["arith-recurrence", "Écrire la relation uₙ₊₁ = uₙ + r"],
          ["arith-general", "Calculer uₙ à partir de u₀ ou de uₚ"],
          ["arith-variation", "Relier le signe de r aux variations"],
          ["arith-modele", "Construire un modèle à accroissement constant"],
        ],
      ],
      [
        "Suites géométriques",
        [
          ["geo-reconnaitre", "Reconnaître une multiplication constante"],
          [
            "geo-raison",
            "Déterminer la raison et vérifier les termes non nuls",
          ],
          ["geo-recurrence", "Écrire la relation uₙ₊₁ = q × uₙ"],
          ["geo-general", "Calculer uₙ à partir de u₀ ou de uₚ"],
          ["geo-taux", "Convertir un taux d’évolution en raison"],
          [
            "geo-variation",
            "Étudier les variations en tenant compte du signe des termes",
          ],
          ["geo-modele", "Modéliser des évolutions successives à taux fixe"],
        ],
      ],
      [
        "Sommes et démonstrations",
        [
          [
            "somme-nombre",
            "Compter les termes d’une somme sans erreur de rang",
          ],
          ["somme-arith", "Calculer une somme arithmétique"],
          ["somme-geo", "Calculer une somme géométrique, avec le cas q = 1"],
          ["demo-terme", "Justifier une formule de terme général"],
          ["demo-somme", "Expliquer une formule de somme de termes"],
        ],
      ],
      [
        "Variations, algorithmes et limites",
        [
          ["variation-difference", "Étudier le signe de uₙ₊₁ − uₙ"],
          ["algo-termes", "Écrire une boucle qui calcule des termes"],
          ["algo-somme", "Accumuler une somme avec une boucle"],
          ["algo-seuil", "Chercher le premier rang qui franchit un seuil"],
          ["limite-finie", "Conjecturer une limite finie à partir de valeurs"],
          [
            "limite-infinie",
            "Distinguer limite infinie et absence de limite sur des exemples",
          ],
        ],
      ],
    ]),
  },
  {
    id: "second-degre",
    title: "Second degré",
    initialState: "closed",
    excerpt: "Équations, fonctions polynômes du second degré",
    skills: tasks("sd", [
      [
        "Lire et choisir une forme",
        [
          ["coefficients", "Identifier a, b, c et vérifier a ≠ 0"],
          [
            "developper",
            "Développer et réduire une expression du second degré",
          ],
          [
            "formes-lire",
            "Reconnaître une forme développée, factorisée ou canonique",
          ],
          ["formes-choisir", "Choisir la forme utile pour la question posée"],
        ],
      ],
      [
        "Racines et factorisation",
        [
          ["racine-verifier", "Vérifier qu’un nombre est une racine"],
          ["facteur-racines", "Lire les racines d’une forme factorisée"],
          ["produit-nul", "Résoudre une équation à partir d’un produit nul"],
          ["racine-evidente", "Repérer une racine évidente et factoriser"],
          ["racines-somme", "Utiliser la somme et le produit des racines"],
          ["identite", "Factoriser à l’aide d’une identité remarquable"],
        ],
      ],
      [
        "Discriminant et équations",
        [
          ["delta-calcul", "Calculer Δ = b² − 4ac sans erreur de signe"],
          ["delta-cas", "Déduire le nombre de racines réelles du signe de Δ"],
          ["delta-deux", "Calculer les deux racines lorsque Δ > 0"],
          ["delta-double", "Calculer la racine double lorsque Δ = 0"],
          [
            "delta-factoriser",
            "Écrire une forme factorisée à partir des racines",
          ],
          [
            "equation-justifier",
            "Justifier les formules de résolution du second degré",
          ],
        ],
      ],
      [
        "Signe et inéquations",
        [
          ["signe-facteurs", "Combiner les signes des facteurs"],
          [
            "signe-trinome",
            "Construire le tableau de signes avec les cas de Δ",
          ],
          [
            "inequation-intervalles",
            "Lire les solutions et écrire les bons intervalles",
          ],
          [
            "inequation-bornes",
            "Inclure ou exclure les racines selon l’inégalité",
          ],
        ],
      ],
      [
        "Forme canonique et problèmes",
        [
          ["carre", "Compléter le carré dans un cas simple"],
          ["sommet", "Lire les coordonnées du sommet dans la forme canonique"],
          [
            "variations",
            "Exploiter les variations et l’extremum dans un problème",
          ],
          [
            "modele",
            "Traduire une situation par une expression du second degré",
          ],
          [
            "solution-contexte",
            "Vérifier qu’une solution respecte les contraintes du problème",
          ],
          [
            "deux-racines",
            "Construire un trinôme qui s’annule en deux réels distincts",
          ],
        ],
      ],
    ]),
  },
];
