import {programme,sourceBase} from "./programme";
import type {Skill} from "./domain";
export type ChapterTemplate={id:string;title:string;skills:Skill[];source:typeof sourceBase & {excerpt:string;sectionTitle?:string}};
const additions = [
  {
    "id": "derivation",
    "title": "Dérivation",
    "skills": [
      {
        "id": "derivation-1-1",
        "label": "Calculer un taux de variation",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-1-2",
        "label": "Interpréter une limite de taux de variation",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-1-3",
        "label": "Lire la pente d’une tangente",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-1-4",
        "label": "Interpréter le nombre dérivé en contexte",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-1-5",
        "label": "Déterminer une équation de tangente",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-1-6",
        "label": "Utiliser une approximation linéaire",
        "group": "Nombre dérivé",
        "weight": 1
      },
      {
        "id": "derivation-2-1",
        "label": "Identifier un intervalle de dérivabilité",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-2",
        "label": "Dériver les fonctions carré et cube",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-3",
        "label": "Dériver une puissance entière",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-4",
        "label": "Dériver la fonction inverse",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-5",
        "label": "Dériver la racine carrée sur son domaine",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-6",
        "label": "Dériver une somme",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-7",
        "label": "Dériver un produit",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-8",
        "label": "Dériver un quotient",
        "group": "Fonctions dérivées",
        "weight": 1
      },
      {
        "id": "derivation-2-9",
        "label": "Étudier la dérivabilité de la valeur absolue en zéro",
        "group": "Fonctions dérivées",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Dérivation\nContenus\nPoint de vue local\n − Taux de variation. Sécantes à la courbe représentative d’une fonction en un point donné.\n − Nombre dérivé d’une fonction en un point, comme limite du taux de variation. Notation ƒ ’(a).\n − Tangente à la courbe représentative d’une fonction en un point, comme « limite des sécantes ». Pente. Équation : la\n   tangente à la courbe représentative de ƒ au point d’abscisse a est la droite d’équation 𝑦 = ƒ (a) + ƒ ‘(a)(𝑥 – a).\n − Approximation linéaire : fonction affine tangente 𝑥 ↦ ƒ (a) + ƒ ‘(a)(𝑥 – a) et approximation de ƒ (a + h) par ƒ (a) + ƒ ‘(a)h.\nPoint de vue global\n −   Fonction dérivable sur un intervalle. Fonction dérivée.\n −   Fonction dérivée des fonctions carré, cube, inverse, racine carrée.\n −   Opérations sur les fonctions dérivables : somme, produit, inverse, quotient.\n −   Pour 𝑛 dans ℤ, fonction dérivée de la fonction 𝑥 ↦ 𝑥 𝑛.\n −   Fonction valeur absolue : étude de la dérivabilité en 0.\nCapacités attendues\n − Calculer un taux de variation, la pente d’une sécante.\n − Interpréter le nombre dérivé en contexte : pente d’une tangente, vitesse instantanée, cout marginal, etc.\n − Déterminer graphiquement un nombre dérivé par la pente de la tangente. Construire la tangente en un point à une courbe\n   représentative connaissant le nombre dérivé.\n − Déterminer l’équation de la tangente en un point à la courbe représentative d’une fonction.\n − Calculer une valeur approchée de ƒ (a + h).\n − Dans des cas simples, calculer une fonction dérivée en utilisant les propriétés des opérations sur les fonctions dérivables.\n\n\n\nDémonstrations\n −   Équation de la tangente en un point à une courbe représentative.\n −   La fonction racine carrée n’est pas dérivable en 0.\n −   Fonction dérivée de la fonction carrée, de la fonction inverse.\n −   Fonction dérivée d’un produit.\nExemple d’algorithme\n − Écrire la liste des coefficients directeurs des sécantes pour un pas donné.",
      "page": 7,
      "sectionTitle": "Dérivation"
    }
  },
  {
    "id": "variations",
    "title": "Variations et courbes représentatives des fonctions",
    "skills": [
      {
        "id": "variations-1-1",
        "label": "Reconnaître la parité d’une fonction",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-1-2",
        "label": "Traduire graphiquement la parité",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-1-3",
        "label": "Étudier le signe d’une dérivée",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-1-4",
        "label": "Construire un tableau de variations",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-1-5",
        "label": "Repérer et calculer un extremum",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-1-6",
        "label": "Justifier la constance sur un intervalle",
        "group": "Étude de fonctions",
        "weight": 1
      },
      {
        "id": "variations-2-1",
        "label": "Résoudre un problème d’optimisation",
        "group": "Applications",
        "weight": 1
      },
      {
        "id": "variations-2-2",
        "label": "Établir une inégalité par les variations",
        "group": "Applications",
        "weight": 1
      },
      {
        "id": "variations-2-3",
        "label": "Comparer deux courbes",
        "group": "Applications",
        "weight": 1
      },
      {
        "id": "variations-2-4",
        "label": "Étudier un trinôme par la dérivation",
        "group": "Applications",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Variations et courbes représentatives des fonctions\nContenus\n − Représentation algébrique et graphique de fonctions paires, impaires. Traduction géométrique.\n − Lien entre le sens de variation d’une fonction dérivable sur un intervalle et signe de sa fonction dérivée ; caractérisation\n   des fonctions constantes.\n − Nombre dérivé en un extrémum, tangente à la courbe représentative.\nCapacités attendues\n − Étudier les variations d’une fonction. Déterminer les extrémums.\n − Résoudre un problème d’optimisation.\n − Exploiter les variations d’une fonction pour établir une inégalité. Étudier la position relative de deux courbes\n   représentatives.\n − Étudier, en lien avec la dérivation, une fonction polynôme du second degré : variations, extrémum, allure selon le signe du\n   coefficient de 𝑥².\nExemple d’algorithme\n − Méthode de Newton, en se limitant à des cas favorables.",
      "page": 8,
      "sectionTitle": "Variations et courbes représentatives des fonctions"
    }
  },
  {
    "id": "exponentielle",
    "title": "Fonction exponentielle",
    "skills": [
      {
        "id": "exponentielle-1-1",
        "label": "Utiliser exp(0) = 1 et exp′ = exp",
        "group": "Définition et calcul",
        "weight": 1
      },
      {
        "id": "exponentielle-1-2",
        "label": "Passer des notations exp(x) à eˣ",
        "group": "Définition et calcul",
        "weight": 1
      },
      {
        "id": "exponentielle-1-3",
        "label": "Transformer exp(x + y)",
        "group": "Définition et calcul",
        "weight": 1
      },
      {
        "id": "exponentielle-1-4",
        "label": "Transformer exp(−x) et un quotient",
        "group": "Définition et calcul",
        "weight": 1
      },
      {
        "id": "exponentielle-1-5",
        "label": "Simplifier une expression exponentielle",
        "group": "Définition et calcul",
        "weight": 1
      },
      {
        "id": "exponentielle-2-1",
        "label": "Exploiter la positivité de l’exponentielle",
        "group": "Étude et modèles",
        "weight": 1
      },
      {
        "id": "exponentielle-2-2",
        "label": "Utiliser sa croissance pour comparer des valeurs",
        "group": "Étude et modèles",
        "weight": 1
      },
      {
        "id": "exponentielle-2-3",
        "label": "Dériver une fonction t ↦ exp(at)",
        "group": "Étude et modèles",
        "weight": 1
      },
      {
        "id": "exponentielle-2-4",
        "label": "Représenter une croissance ou une décroissance exponentielle",
        "group": "Étude et modèles",
        "weight": 1
      },
      {
        "id": "exponentielle-2-5",
        "label": "Construire un modèle exponentiel en contexte",
        "group": "Étude et modèles",
        "weight": 1
      },
      {
        "id": "exponentielle-2-6",
        "label": "Relier un modèle exponentiel à une suite géométrique",
        "group": "Étude et modèles",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Fonction exponentielle\nContenus\n\n − Définition de la fonction exponentielle comme unique fonction dérivable sur ℝ vérifiant ƒ ‘ = ƒ et ƒ (0) = 1. L’existence et\n   l’unicité sont admises. Notation exp(𝑥).\n − Pour tous réels 𝑥 et 𝑦, exp(𝑥 + 𝑦) = exp(𝑥) exp(𝑦) et exp(𝑥) exp(–𝑥) = 1. Nombre e. Notation e 𝑥.\n − Signe, sens de variation et courbe représentative de la fonction exponentielle. Lien avec les suites géométriques.\nCapacités attendues\n −   Transformer une expression en utilisant les propriétés algébriques de la fonction exponentielle.\n −   Pour a réel, dérivée de la fonction t ↦ eat.\n −   Pour une valeur numérique strictement positive de k, représenter graphiquement les fonctions t ↦ e–kt et t ↦ ekt.\n −   Modéliser une situation par une croissance, une décroissance exponentielle (par exemple évolution d’un capital à taux fixe,\n     décroissance radioactive).\nExemple d’algorithme\n − Construction de l’exponentielle par la méthode d’Euler.\n                                                                               1 𝑛\n − Détermination d’une valeur approchée de e à l’aide de la suite ((1 + ) ).\n                                                                               𝑛\n\nApprofondissements possibles\n\n − Unicité d’une fonction ƒ dérivable sur ℝ telle que vérifiant ƒ ‘ = ƒ et ƒ (0) = 1.\n − Pour tous réels 𝑥 et 𝑦, exp(𝑥 + 𝑦) = exp(𝑥) exp(𝑦).\n − La fonction exponentielle est strictement positive et croissante.",
      "page": 8,
      "sectionTitle": "Fonction exponentielle"
    }
  },
  {
    "id": "trigonometrie",
    "title": "Trigonométrie",
    "skills": [
      {
        "id": "trigonometrie-1-1",
        "label": "Utiliser le radian et une longueur d’arc",
        "group": "Cercle et angles",
        "weight": 1
      },
      {
        "id": "trigonometrie-1-2",
        "label": "Associer un réel à un point du cercle",
        "group": "Cercle et angles",
        "weight": 1
      },
      {
        "id": "trigonometrie-1-3",
        "label": "Placer un point sur le cercle trigonométrique",
        "group": "Cercle et angles",
        "weight": 1
      },
      {
        "id": "trigonometrie-1-4",
        "label": "Reconnaître des angles associés",
        "group": "Cercle et angles",
        "weight": 1
      },
      {
        "id": "trigonometrie-2-1",
        "label": "Lire le sinus et le cosinus sur le cercle",
        "group": "Sinus et cosinus",
        "weight": 1
      },
      {
        "id": "trigonometrie-2-2",
        "label": "Connaître les valeurs remarquables",
        "group": "Sinus et cosinus",
        "weight": 1
      },
      {
        "id": "trigonometrie-2-3",
        "label": "Relier le cercle au triangle rectangle",
        "group": "Sinus et cosinus",
        "weight": 1
      },
      {
        "id": "trigonometrie-2-4",
        "label": "Déduire les valeurs pour des angles associés",
        "group": "Sinus et cosinus",
        "weight": 1
      },
      {
        "id": "trigonometrie-2-5",
        "label": "Justifier une valeur remarquable",
        "group": "Sinus et cosinus",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Trigonométrie\nContenus\n − Cercle trigonométrique. Longueur d’arc. Radian.\n − Enroulement de la droite sur le cercle trigonométrique. Image d’un nombre réel.\n − Cosinus et sinus d’un nombre réel. Lien avec le sinus et le cosinus dans un triangle rectangle. Valeurs remarquables.\nCapacités attendues\n − Placer un point sur le cercle trigonométrique.\n − Par lecture du cercle trigonométrique, déterminer, pour des valeurs remarquables de 𝑥, les cosinus et sinus d’angles\n   associés à 𝑥.\nDémonstration\n                   𝜋           𝜋           𝜋        𝜋\n − Calcul de cos       , sin       , cos       , sin .\n                   4           4           3        3\n\nExemple d’algorithme\n\n − Approximation de π par la méthode d’Archimède.",
      "page": 8,
      "sectionTitle": "Trigonométrie"
    }
  },
  {
    "id": "produit-scalaire",
    "title": "Calcul vectoriel et produit scalaire",
    "skills": [
      {
        "id": "produit-scalaire-1-1",
        "label": "Calculer par projection orthogonale",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-1-2",
        "label": "Calculer avec les normes et un angle",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-1-3",
        "label": "Calculer dans un repère orthonormé",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-1-4",
        "label": "Utiliser la symétrie",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-1-5",
        "label": "Utiliser la bilinéarité",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-1-6",
        "label": "Choisir une méthode de calcul adaptée",
        "group": "Calculer un produit scalaire",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-1",
        "label": "Démontrer une orthogonalité",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-2",
        "label": "Calculer un angle",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-3",
        "label": "Calculer une longueur",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-4",
        "label": "Développer une norme au carré",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-5",
        "label": "Appliquer la formule d’Al-Kashi",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-6",
        "label": "Transformer une expression MA · MB",
        "group": "Résoudre un problème",
        "weight": 1
      },
      {
        "id": "produit-scalaire-2-7",
        "label": "Caractériser le cercle de diamètre AB",
        "group": "Résoudre un problème",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Calcul vectoriel et produit scalaire\nContenus\n − Produit scalaire à partir de la projection orthogonale et de la formule avec le cosinus. Caractérisation de l’orthogonalité.\n − Bilinéarité, symétrie. En base orthonormée, expression du produit scalaire et de la norme, critère d’orthogonalité.\n   Expression des coordonnées dans une base orthonormée en termes de produits scalaires avec les vecteurs de la base.\n − Développement de ‖𝑢    ⃗ + 𝑣‖2 et ‖𝑢⃗ − 𝑣 ‖2 . Formule d’Al-Kashi.\n − Transformation de l’expression ⃗⃗⃗⃗⃗⃗⃗ ⃗⃗⃗⃗⃗⃗B.\n                                     MA ⋅ M\nCapacités attendues\n − Utiliser le produit scalaire pour démontrer une orthogonalité, pour calculer un angle, une longueur dans le plan.\n − En vue de la résolution d’un problème, calculer le produit scalaire de deux vecteurs en choisissant une méthode adaptée\n   (en utilisant la projection orthogonale, à l’aide des coordonnées, à l’aide des normes et d’un angle, à l’aide de normes).\n − Utiliser le produit scalaire pour résoudre un problème géométrique.\nDémonstrations\n − Formule d’Al-Kashi (démonstration avec le produit scalaire).\n − Ensemble des points M tels que ⃗⃗⃗⃗⃗⃗⃗\n                                  MA ⋅ M  ⃗⃗⃗⃗⃗⃗B = 0 (démonstration avec le produit scalaire).\n\nApprofondissements possibles\n − Loi des sinus.\n − Concourance des hauteurs d’un triangle.\n − Les médianes d’un triangle concourent au centre de gravité.",
      "page": 9,
      "sectionTitle": "Calcul vectoriel et produit scalaire"
    }
  },
  {
    "id": "geometrie-reperee",
    "title": "Géométrie repérée",
    "skills": [
      {
        "id": "geometrie-reperee-1-1",
        "label": "Identifier un vecteur normal",
        "group": "Droites et projections",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-1-2",
        "label": "Déterminer une équation de droite par un point et un vecteur normal",
        "group": "Droites et projections",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-1-3",
        "label": "Vérifier l’appartenance d’un point à une droite",
        "group": "Droites et projections",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-1-4",
        "label": "Déterminer les coordonnées d’un projeté orthogonal",
        "group": "Droites et projections",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-2-1",
        "label": "Écrire une équation de cercle",
        "group": "Cercles et configurations",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-2-2",
        "label": "Reconnaître une équation de cercle",
        "group": "Cercles et configurations",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-2-3",
        "label": "Déterminer le centre et le rayon",
        "group": "Cercles et configurations",
        "weight": 1
      },
      {
        "id": "geometrie-reperee-2-4",
        "label": "Utiliser un repère pour résoudre une configuration",
        "group": "Cercles et configurations",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Géométrie repérée\nDans cette section, le plan est rapporté à un repère orthonormé.\nContenus\n\n − Vecteur normal à une droite. Le vecteur de coordonnées (a, b) est normal à la droite d’équation a𝑥 + b𝑦 + c = 0.\n − Projection orthogonale d’un point sur une droite.\n − Équation de cercle.\nCapacités attendues\n −   Déterminer une équation cartésienne d’une droite connaissant un point et un vecteur normal.\n −   Déterminer les coordonnées du projeté orthogonal d’un point sur une droite.\n −   Déterminer et utiliser l’équation d’un cercle donné par son centre et son rayon.\n −   Reconnaitre une équation de cercle, déterminer centre et rayon.\n −   Utiliser un repère pour étudier une configuration.\nApprofondissements possibles\n − Recherche de l’ensemble des points équidistants de l’axe des abscisses et d’un point donné.\n − Déterminer l’intersection d’un cercle ou d’une parabole d’équation 𝑦 = a𝑥2 + b𝑥 + c avec une droite parallèle à un axe.",
      "page": 9,
      "sectionTitle": "Géométrie repérée"
    }
  },
  {
    "id": "probabilites-conditionnelles",
    "title": "Probabilités conditionnelles et indépendance",
    "skills": [
      {
        "id": "probabilites-conditionnelles-1-1",
        "label": "Lire une probabilité conditionnelle dans un tableau",
        "group": "Probabilités conditionnelles",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-1-2",
        "label": "Compléter un arbre pondéré",
        "group": "Probabilités conditionnelles",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-1-3",
        "label": "Calculer une probabilité d’intersection",
        "group": "Probabilités conditionnelles",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-1-4",
        "label": "Identifier une partition de l’univers",
        "group": "Probabilités conditionnelles",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-1-5",
        "label": "Utiliser la formule des probabilités totales",
        "group": "Probabilités conditionnelles",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-1",
        "label": "Vérifier l’indépendance de deux évènements",
        "group": "Indépendance et répétitions",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-2",
        "label": "Justifier l’utilisation d’un modèle indépendant",
        "group": "Indépendance et répétitions",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-3",
        "label": "Représenter deux épreuves indépendantes",
        "group": "Indépendance et répétitions",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-4",
        "label": "Reconnaître une épreuve de Bernoulli",
        "group": "Indépendance et répétitions",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-5",
        "label": "Construire un arbre de répétitions pour n ≤ 4",
        "group": "Indépendance et répétitions",
        "weight": 1
      },
      {
        "id": "probabilites-conditionnelles-2-6",
        "label": "Calculer une probabilité sur cet arbre",
        "group": "Indépendance et répétitions",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Probabilités conditionnelles et indépendance\nContenus\n −   Indépendance de deux évènements.\n −   Partition de l’univers (systèmes complets d’évènements). Formule des probabilités totales.\n −   Succession de deux épreuves indépendantes. Représentation par un arbre ou un tableau.\n −   Pour 𝑛 ⩽ 4, répétition de 𝑛 épreuves de Bernoulli indépendantes et identiques.\nCapacités attendues\n −   Dans des cas simples, calculer une probabilité à l’aide de la formule des probabilités totales.\n −   Savoir utiliser ou justifier l’indépendance de deux évènements.\n −   Représenter la succession de deux épreuves indépendantes par un arbre ou un tableau.\n −   Pour 𝑛 ⩽ 4, représenter l’arbre associé à la répétition de 𝑛 épreuves de Bernoulli indépendantes et identiques afin de\n     calculer des probabilités.\nExemple d’algorithme\n\n − Méthode de Monte-Carlo : estimation de l’aire sous la parabole, estimation du nombre π.\nApprofondissements possibles\n − Exemples de succession de plusieurs épreuves indépendantes.\n − Exemples de marches aléatoires.",
      "page": 10,
      "sectionTitle": "Probabilités conditionnelles et indépendance"
    }
  },
  {
    "id": "variables-aleatoires",
    "title": "Variables aléatoires réelles",
    "skills": [
      {
        "id": "variables-aleatoires-1-1",
        "label": "Définir la variable associée à une expérience",
        "group": "Modélisation et loi",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-1-2",
        "label": "Identifier les valeurs possibles",
        "group": "Modélisation et loi",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-1-3",
        "label": "Décrire les évènements X = a et X ≤ a",
        "group": "Modélisation et loi",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-1-4",
        "label": "Déterminer une loi de probabilité",
        "group": "Modélisation et loi",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-1-5",
        "label": "Vérifier que la somme des probabilités vaut 1",
        "group": "Modélisation et loi",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-1",
        "label": "Calculer une espérance",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-2",
        "label": "Interpréter l’espérance en contexte",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-3",
        "label": "Utiliser la linéarité de l’espérance",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-4",
        "label": "Calculer une variance",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-5",
        "label": "Utiliser la formule de König-Huygens",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-6",
        "label": "Calculer un écart type",
        "group": "Indicateurs et problèmes",
        "weight": 1
      },
      {
        "id": "variables-aleatoires-2-7",
        "label": "Déterminer une mise ou un gain pour un jeu équitable",
        "group": "Indicateurs et problèmes",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Variables aléatoires réelles\nLe programme ne considère que des univers finis et des variables aléatoires réelles. L’objectif est simultanément de développer\nune intuition autour de l’idée de nombre dépendant du hasard et de formaliser la notion mathématique de variable aléatoire\ncomme fonction numérique définie sur un univers, permettant d’affecter des probabilités aux valeurs possibles de la variable.\nContenus\n − Variable aléatoire réelle : modélisation du résultat numérique d’une expérience aléatoire ; formalisation comme fonction\n   définie sur l’univers et à valeurs réelles.\n − Loi d’une variable aléatoire.\n − Espérance, variance, écart type d’une variable aléatoire.\n − Linéarité de l’espérance.\n\n\n\n − Formule de König-Huygens.\nCapacités attendues\n\n − Interpréter en situation et utiliser les notations {X = a}, {X ⩽ a}, P(X = a), P(X ⩽ a). Passer du registre de la langue naturelle au\n   registre symbolique et inversement.\n − Modéliser une situation à l’aide d’une variable aléatoire.\n − Déterminer la loi de probabilité d’une variable aléatoire.\n − Calculer une espérance, une variance, un écart type.\n − Utiliser la notion d’espérance dans une résolution de problème (mise pour un jeu équitable, etc.).\nExemples d’algorithmes\n − Algorithme renvoyant l’espérance, la variance ou l‘écart type d’une variable aléatoire.\n − Fréquence d’apparition des lettres d’un texte donné, en français, en anglais.\nApprofondissements possibles\n\n − Pour X variable aléatoire, étude de la fonction du second degré 𝑥 ↦ E((X – 𝑥)²).",
      "page": 10,
      "sectionTitle": "Variables aléatoires réelles"
    }
  },
  {
    "id": "simulations",
    "title": "Expérimentations",
    "skills": [
      {
        "id": "simulations-1-1",
        "label": "Simuler une variable aléatoire en Python ou avec un tableur",
        "group": "Simuler et estimer",
        "weight": 1
      },
      {
        "id": "simulations-1-2",
        "label": "Générer un échantillon de taille donnée",
        "group": "Simuler et estimer",
        "weight": 1
      },
      {
        "id": "simulations-1-3",
        "label": "Écrire une fonction calculant la moyenne d’un échantillon",
        "group": "Simuler et estimer",
        "weight": 1
      },
      {
        "id": "simulations-1-4",
        "label": "Comparer une moyenne observée à l’espérance",
        "group": "Simuler et estimer",
        "weight": 1
      },
      {
        "id": "simulations-2-1",
        "label": "Générer plusieurs échantillons",
        "group": "Répéter une expérience",
        "weight": 1
      },
      {
        "id": "simulations-2-2",
        "label": "Calculer un écart à l’espérance",
        "group": "Répéter une expérience",
        "weight": 1
      },
      {
        "id": "simulations-2-3",
        "label": "Estimer la proportion d’écarts inférieurs à un seuil donné",
        "group": "Répéter une expérience",
        "weight": 1
      },
      {
        "id": "simulations-2-4",
        "label": "Interpréter les résultats d’une simulation",
        "group": "Répéter une expérience",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Expérimentations\nLe travail expérimental de simulation d’échantillons prolonge celui entrepris en seconde. L’objectif est de faire percevoir le\nprincipe de l’estimation de l’espérance d’une variable aléatoire, ou de la moyenne d’une variable statistique dans une\npopulation, par une moyenne observée sur un échantillon.\n − Simuler une variable aléatoire avec Python ou un tableur.\n − Lire, comprendre et écrire une fonction Python renvoyant la moyenne d’un échantillon de taille n d’une variable aléatoire.\n − Étudier sur des exemples la distance entre la moyenne d’un échantillon simulé de taille n d’une variable aléatoire et\n   l’espérance de cette variable aléatoire.\n − Simuler, avec Python ou un tableur, N échantillons de taille n d’une variable aléatoire, d’espérance μ et d’écart type σ. Si m\n                                                                                                                             2𝜎\n    désigne la moyenne d’un échantillon, calculer la proportion des cas où l’écart entre m et μ est inférieur ou égal à           .\n                                                                                                                             √n",
      "page": 11,
      "sectionTitle": "Expérimentations"
    }
  },
  {
    "id": "algorithmique",
    "title": "Algorithmique et programmation",
    "skills": [
      {
        "id": "algorithmique-1-1",
        "label": "Utiliser les variables et l’affectation",
        "group": "Programmer un calcul",
        "weight": 1
      },
      {
        "id": "algorithmique-1-2",
        "label": "Écrire une instruction conditionnelle",
        "group": "Programmer un calcul",
        "weight": 1
      },
      {
        "id": "algorithmique-1-3",
        "label": "Choisir et écrire une boucle",
        "group": "Programmer un calcul",
        "weight": 1
      },
      {
        "id": "algorithmique-1-4",
        "label": "Définir et appeler une fonction",
        "group": "Programmer un calcul",
        "weight": 1
      },
      {
        "id": "algorithmique-1-5",
        "label": "Décomposer un problème en fonctions",
        "group": "Programmer un calcul",
        "weight": 1
      },
      {
        "id": "algorithmique-2-1",
        "label": "Créer une liste",
        "group": "Listes",
        "weight": 1
      },
      {
        "id": "algorithmique-2-2",
        "label": "Accéder à un élément par son indice",
        "group": "Listes",
        "weight": 1
      },
      {
        "id": "algorithmique-2-3",
        "label": "Parcourir une liste",
        "group": "Listes",
        "weight": 1
      },
      {
        "id": "algorithmique-2-4",
        "label": "Construire une liste de valeurs",
        "group": "Listes",
        "weight": 1
      },
      {
        "id": "algorithmique-2-5",
        "label": "Comprendre une liste en compréhension",
        "group": "Listes",
        "weight": 1
      },
      {
        "id": "algorithmique-2-6",
        "label": "Calculer une somme ou une moyenne à partir d’une liste",
        "group": "Listes",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Algorithmique et programmation\nObjectifs\nLa démarche algorithmique est, depuis les origines, une composante essentielle de l’activité mathématique. Au collège, en\nmathématiques et en technologie, les élèves ont appris à écrire, mettre au point et exécuter un programme simple. La classe\nde seconde a permis de consolider les acquis du cycle 4 autour de deux idées essentielles :\n − la notion de fonction ;\n − la programmation comme production d’un texte dans un langage informatique.\nL’enseignement de spécialité de mathématiques de classe de première vise la consolidation des notions de variable,\nd’instruction conditionnelle et de boucle ainsi que l’utilisation des fonctions. La seule notion nouvelle est celle de liste qui\ntrouve naturellement sa place dans de nombreuses parties du programme et aide à la compréhension de notions\nmathématiques telles que les suites numériques, les tableaux de valeurs, les séries statistiques, etc.\nComme en classe de seconde, les algorithmes peuvent être écrits en langage naturel ou utiliser le langage Python.\nLes notions relatives aux types de variables et à l’affectation sont consolidées. Comme en classe de seconde, on utilise le\nsymbole « ← » pour désigner l’affectation dans un algorithme écrit en langage naturel.\nL’accent est mis sur la programmation modulaire qui permet de découper une tâche complexe en tâches plus simples.\nHistoire des mathématiques\nDe nombreux textes témoignent d’une préoccupation algorithmique au long de l’Histoire. Lorsqu’un texte historique a une\nvisée algorithmique, transformer les méthodes qu’il présente en un algorithme, voire en un programme, ou inversement, est\nl’occasion de travailler des changements de registre qui donnent du sens au formalisme mathématique.\n\nNotion de liste\nLa génération des listes en compréhension et en extension est mise en lien avec la notion d’ensemble. Les conditions\napparaissant dans les listes définies en compréhension permettent de travailler la logique. Afin d’éviter des confusions, on se\nlimite aux listes sans présenter d’autres types de collections.\n −   Générer une liste (en extension, par ajouts successifs ou en compréhension).\n −   Manipuler des éléments d’une liste (ajouter, supprimer, etc.) et leurs indices.\n −   Parcourir une liste.\n −   Itérer sur les éléments d’une liste.",
      "page": 4,
      "sectionTitle": "Algorithmique et programmation"
    }
  },
  {
    "id": "logique",
    "title": "Vocabulaire ensembliste et logique",
    "skills": [
      {
        "id": "logique-1-1",
        "label": "Utiliser appartenance et inclusion",
        "group": "Ensembles",
        "weight": 1
      },
      {
        "id": "logique-1-2",
        "label": "Décrire une réunion et une intersection",
        "group": "Ensembles",
        "weight": 1
      },
      {
        "id": "logique-1-3",
        "label": "Décrire un complémentaire",
        "group": "Ensembles",
        "weight": 1
      },
      {
        "id": "logique-1-4",
        "label": "Manipuler des intervalles",
        "group": "Ensembles",
        "weight": 1
      },
      {
        "id": "logique-1-5",
        "label": "Utiliser un cardinal dans un ensemble fini",
        "group": "Ensembles",
        "weight": 1
      },
      {
        "id": "logique-2-1",
        "label": "Distinguer implication et équivalence",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-2",
        "label": "Formuler une réciproque",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-3",
        "label": "Formuler une contraposée",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-4",
        "label": "Construire un contre-exemple",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-5",
        "label": "Nier une proposition quantifiée",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-6",
        "label": "Raisonner par disjonction des cas",
        "group": "Raisonnement",
        "weight": 1
      },
      {
        "id": "logique-2-7",
        "label": "Reconnaître un raisonnement par l’absurde",
        "group": "Raisonnement",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Vocabulaire ensembliste et logique\nL’apprentissage des notations mathématiques et de la logique est transversal à tous les chapitres du programme. Aussi, il\nimporte d’y travailler d’abord dans des contextes où ils se présentent naturellement, puis de prévoir des temps où les concepts\net types de raisonnement sont étudiés, après avoir été rencontrés plusieurs fois en situation.\n\n\n\nLes élèves doivent connaitre les notions d’élément d’un ensemble, de sous-ensemble, d’ensemble vide, d’appartenance et\nd’inclusion, de réunion, d’intersection et de complémentaire et savoir utiliser les symboles de base correspondants : Ø, ∈, ⊂, ∩,\n∪, { … }, ainsi que la notation des ensembles de nombres et des intervalles. Ils rencontrent également la notion de couple et\ncelle de produit cartésien de deux ensembles.\nPour le complémentaire d’un sous-ensemble A de E, on utilise la notation A\n                                                                         ̅ des probabilités, ou la notation E \\ A. On utilise la\nnotation Card(A) pour le cardinal (nombre d’éléments) d’un ensemble fini A.\nLes élèves apprennent en situation à :\n − lire et écrire des propositions contenant les connecteurs logiques « et », « ou » ;\n − mobiliser un contre-exemple pour montrer qu’une proposition est fausse ;\n − formuler une implication, une équivalence logique, et à les mobiliser dans un raisonnement simple;\n − formuler la réciproque d'une implication, la contraposée ;\n − employer les expressions « condition nécessaire », « condition suffisante » ;\n − identifier le statut des égalités (identité, équation) et celui des lettres utilisées (variable, inconnue, paramètre) ;\n − utiliser les quantificateurs (les symboles ∀ et ∃ ne sont pas exigibles) et repérer les quantifications implicites dans certaines\n    propositions, particulièrement dans les propositions conditionnelles ;\n − formuler la négation de propositions quantifiées.\nPar ailleurs, les élèves produisent des raisonnements par disjonction des cas, par l'absurde, par contraposée, et en découvrent\nla structure.",
      "page": 3,
      "sectionTitle": "Vocabulaire ensembliste et logique"
    }
  },
  {
    "id": "automatismes",
    "title": "Automatismes",
    "skills": [
      {
        "id": "automatismes-1-1",
        "label": "Calculer une proportion et un taux d’évolution",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-1-2",
        "label": "Utiliser un coefficient multiplicateur",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-1-3",
        "label": "Calculer une évolution réciproque",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-1-4",
        "label": "Calculer des évolutions successives",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-1-5",
        "label": "Manipuler puissances et fractions",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-1-6",
        "label": "Développer et factoriser une expression",
        "group": "Calcul et évolutions",
        "weight": 1
      },
      {
        "id": "automatismes-2-1",
        "label": "Lire une image et un antécédent",
        "group": "Lectures et données",
        "weight": 1
      },
      {
        "id": "automatismes-2-2",
        "label": "Résoudre graphiquement une équation ou une inéquation",
        "group": "Lectures et données",
        "weight": 1
      },
      {
        "id": "automatismes-2-3",
        "label": "Lire le signe et les variations d’une fonction",
        "group": "Lectures et données",
        "weight": 1
      },
      {
        "id": "automatismes-2-4",
        "label": "Calculer ou interpréter une moyenne et un écart type",
        "group": "Lectures et données",
        "weight": 1
      },
      {
        "id": "automatismes-2-5",
        "label": "Calculer une fréquence conditionnelle",
        "group": "Lectures et données",
        "weight": 1
      },
      {
        "id": "automatismes-2-6",
        "label": "Interpréter une probabilité dans un modèle fini",
        "group": "Lectures et données",
        "weight": 1
      }
    ],
    "source": {
      "excerpt": "Automatismes\nCette partie du programme vise à construire et à entretenir des habiletés dans les domaines du calcul, de l’information chiffrée\net des représentations graphiques. Il s’agit d’automatiser le recours à des connaissances, des procédures, des méthodes et des\nstratégies, afin de permettre aux élèves de les mobiliser plus rapidement. Leur acquisition permet aux élèves une meilleure\nréussite dans l’apprentissage des mathématiques, participe du développement de leur esprit critique par une meilleure\nmaitrise des nombres et du calcul et leur permet une meilleure lecture et compréhension des représentations de données dont\nles graphiques.\nLes capacités attendues énoncées ci-dessous n’ont pas vocation à faire l’objet d’un chapitre d’enseignement spécifique car les\nnotions qui les sous-tendent ont été travaillées dans les classes antérieures et doivent être entretenues et consolidées au cours\nde l’année. Cependant les nouvelles notions du programme peuvent donner lieu également à un travail d’automatisation tout\nle long de l’année. Elles relèvent d’un entrainement régulier sur l’ensemble du cycle terminal privilégiant l’activité mentale. Les\ndifférents thèmes proposés doivent être travaillés tout au long de l’année et la présentation par blocs thématiques ne signifie\npas, bien au contraire, qu’il faille les aborder les uns après les autres. Les modalités de mise en œuvre peuvent être variées et\nprendre appui sur différents supports : à l’oral, à l’écrit, individuellement ou en groupe, utilisant éventuellement des outils\nnumériques de vidéoprojection, de recensement instantané des réponses, etc.\nÀ la liste ci-dessous s’ajoute la liste des automatismes travaillés en classe de seconde, qui doivent être entretenus en classe de\npremière.\n\n\n\nÉvolutions et variations\n −   Appliquer un taux d’évolution pour calculer une valeur finale ou initiale.\n −   Calculer un taux d’évolution, l’exprimer en pourcentage.\n −   Calculer le taux d’évolution équivalent à plusieurs évolutions successives.\n −   Calculer un taux d’évolution réciproque.\n\nCalcul numérique et algébrique\n − Déterminer les solutions d’une équation produit nul.\n − Déterminer le signe d’une expression du premier degré, d’une expression factorisée du second degré.\n − Développer, factoriser, réduire une expression algébrique simple.\n\nFonctions et représentations\n −   Résoudre graphiquement une équation, une inéquation du type : ƒ (𝑥) = k, ƒ (𝑥) < k, etc.\n −   Déterminer graphiquement le signe d’une fonction ou son tableau de variations.\n −   Tracer une droite donnée par son équation réduite ou par un point et son coefficient directeur.\n −   Lire graphiquement l’équation réduite d’une droite.\n −   Déterminer le coefficient directeur d’une droite à partir des coordonnées de deux de ses points.\n\nStatistiques\n − Lire un graphique, un histogramme, un diagramme en barres ou circulaire, un diagramme en boite ou toute autre\n   représentation (repérer l’origine du repère, les unités de graduations ou les échelles, etc.).\n − Passer du graphique aux données et vice-versa.\n − Calculer et interpréter des indicateurs statistiques pour une série statistique.\n\nProbabilités\n − Calculer des probabilités conditionnelles lorsque les évènements sont présentés sous forme de tableau croisé d’effectifs\n   ou d’arbres pondérés.\n − Distinguer P(A ∩ B), PA (B), PB (A).",
      "page": 4,
      "sectionTitle": "Automatismes"
    }
  }
];
export const chapterCatalogue:ChapterTemplate[]=[...programme.map(p=>({id:p.id,title:p.title,skills:p.skills,source:{...sourceBase,excerpt:p.excerpt,sectionTitle:p.title}})),...additions.map(p=>({...p,source:{...sourceBase,...p.source}}))];
