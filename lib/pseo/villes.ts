export interface Ville {
  slug: string
  nom: string
  region: string
  codePostal: string
  cci: string
  chambreMetiers: string
}

export const VILLES: Ville[] = [
  { slug: "paris", nom: "Paris", region: "Île-de-France", codePostal: "75", cci: "CCI Paris Île-de-France", chambreMetiers: "Chambre de métiers et de l'artisanat de Paris" },
  { slug: "lyon", nom: "Lyon", region: "Auvergne-Rhône-Alpes", codePostal: "69", cci: "CCI Lyon Métropole", chambreMetiers: "CMA Auvergne-Rhône-Alpes" },
  { slug: "marseille", nom: "Marseille", region: "Provence-Alpes-Côte d'Azur", codePostal: "13", cci: "CCI Aix-Marseille-Provence", chambreMetiers: "CMA des Bouches-du-Rhône" },
  { slug: "toulouse", nom: "Toulouse", region: "Occitanie", codePostal: "31", cci: "CCI Toulouse Haute-Garonne", chambreMetiers: "CMA de la Haute-Garonne" },
  { slug: "nice", nom: "Nice", region: "Provence-Alpes-Côte d'Azur", codePostal: "06", cci: "CCI Nice Côte d'Azur", chambreMetiers: "CMA des Alpes-Maritimes" },
  { slug: "nantes", nom: "Nantes", region: "Pays de la Loire", codePostal: "44", cci: "CCI Nantes Saint-Nazaire", chambreMetiers: "CMA de Loire-Atlantique" },
  { slug: "strasbourg", nom: "Strasbourg", region: "Grand Est", codePostal: "67", cci: "CCI Alsace Eurométropole", chambreMetiers: "CMA d'Alsace" },
  { slug: "montpellier", nom: "Montpellier", region: "Occitanie", codePostal: "34", cci: "CCI Hérault", chambreMetiers: "CMA de l'Hérault" },
  { slug: "bordeaux", nom: "Bordeaux", region: "Nouvelle-Aquitaine", codePostal: "33", cci: "CCI Bordeaux Gironde", chambreMetiers: "CMA de la Gironde" },
  { slug: "lille", nom: "Lille", region: "Hauts-de-France", codePostal: "59", cci: "CCI Grand Lille", chambreMetiers: "CMA Hauts-de-France" },
  { slug: "rennes", nom: "Rennes", region: "Bretagne", codePostal: "35", cci: "CCI Ille-et-Vilaine", chambreMetiers: "CMA d'Ille-et-Vilaine" },
  { slug: "reims", nom: "Reims", region: "Grand Est", codePostal: "51", cci: "CCI Marne en Champagne", chambreMetiers: "CMA de la Marne" },
  { slug: "saint-etienne", nom: "Saint-Étienne", region: "Auvergne-Rhône-Alpes", codePostal: "42", cci: "CCI Lyon-Saint-Étienne-Roanne", chambreMetiers: "CMA de la Loire" },
  { slug: "toulon", nom: "Toulon", region: "Provence-Alpes-Côte d'Azur", codePostal: "83", cci: "CCI du Var", chambreMetiers: "CMA du Var" },
  { slug: "le-havre", nom: "Le Havre", region: "Normandie", codePostal: "76", cci: "CCI Seine-Estuaire", chambreMetiers: "CMA de Seine-Maritime" },
  { slug: "grenoble", nom: "Grenoble", region: "Auvergne-Rhône-Alpes", codePostal: "38", cci: "CCI de Grenoble", chambreMetiers: "CMA de l'Isère" },
  { slug: "dijon", nom: "Dijon", region: "Bourgogne-Franche-Comté", codePostal: "21", cci: "CCI Côte-d'Or Dijon Métropole", chambreMetiers: "CMA de Côte-d'Or" },
  { slug: "angers", nom: "Angers", region: "Pays de la Loire", codePostal: "49", cci: "CCI de Maine-et-Loire", chambreMetiers: "CMA de Maine-et-Loire" },
  { slug: "nimes", nom: "Nîmes", region: "Occitanie", codePostal: "30", cci: "CCI du Gard", chambreMetiers: "CMA du Gard" },
  { slug: "clermont-ferrand", nom: "Clermont-Ferrand", region: "Auvergne-Rhône-Alpes", codePostal: "63", cci: "CCI Puy-de-Dôme Clermont", chambreMetiers: "CMA du Puy-de-Dôme" },
]

export function getVilleBySlug(slug: string): Ville | undefined {
  return VILLES.find(v => v.slug === slug)
}
