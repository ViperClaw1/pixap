import { LOCALES, disambiguateListingName } from "./lib.mjs";

/** @typedef {{ placeName: string, cityShort: string, cityLabel: string, photoPool: string }} CopyContext */

/** @type {Record<string, Record<string, (ctx: CopyContext) => string>>} */
const DESCRIPTION_BY_POOL = {
  restaurant: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — restaurant in ${cityShort}. Reserve a table for lunch or dinner.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — ресторан в ${cityShort}. Забронируйте стол на обед или ужин.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: restaurante en ${cityShort}. Reserva mesa para comer o cenar.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — restaurante em ${cityShort}. Reserve mesa para almoço ou jantar.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — restaurant à ${cityShort}. Réservez une table pour déjeuner ou dîner.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Restaurant in ${cityShort}. Tisch für Mittag- oder Abendessen reservieren.`,
  },
  bar: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — bar in ${cityShort}. Drinks, small plates, and evening atmosphere.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — бар в ${cityShort}. Напитки, закуски и вечерняя атмосфера.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: bar en ${cityShort}. Copas, tapas y ambiente nocturno.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — bar em ${cityShort}. Drinks, petiscos e ambiente noturno.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — bar à ${cityShort}. Boissons, planches et ambiance du soir.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Bar in ${cityShort}. Drinks, kleine Gerichte und Abendstimmung.`,
  },
  cafe: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — café in ${cityShort}. Coffee, pastries, and a relaxed stop anytime.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — кафе в ${cityShort}. Кофе, выпечка и спокойная атмосфера.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: cafetería en ${cityShort}. Café, bollería y ambiente tranquilo.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — café em ${cityShort}. Café, pastelaria e pausa descontraída.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — café à ${cityShort}. Boissons chaudes, pâtisseries et pause détente.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Café in ${cityShort}. Kaffee, Gebäck und entspannte Atmosphäre.`,
  },
  hotel: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — hotel stay in ${cityShort}. Comfortable rooms and central access.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — отель в ${cityShort}. Комфортные номера и удобное расположение.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: hotel en ${cityShort}. Habitaciones cómodas y buena ubicación.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — hotel em ${cityShort}. Quartos confortáveis e localização central.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — hôtel à ${cityShort}. Chambres confortables et accès pratique.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Hotel in ${cityShort}. Komfortable Zimmer und zentrale Lage.`,
  },
  gym: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — fitness club in ${cityShort}. Training floors and flexible memberships.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — фитнес-клуб в ${cityShort}. Залы для тренировок и гибкие абонементы.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: gimnasio en ${cityShort}. Zonas de entrenamiento y membresías flexibles.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — ginásio em ${cityShort}. Áreas de treino e planos flexíveis.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — salle de sport à ${cityShort}. Espaces d'entraînement et abonnements flexibles.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Fitnessstudio in ${cityShort}. Trainingsbereiche und flexible Mitgliedschaften.`,
  },
  beauty: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — beauty salon in ${cityShort}. Hair, skin, and appointment-based services.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — салон красоты в ${cityShort}. Услуги для волос и кожи по записи.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: salón de belleza en ${cityShort}. Pelo, piel y citas previas.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — salão de beleza em ${cityShort}. Cabelo, pele e marcação de horário.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — salon de beauté à ${cityShort}. Cheveux, peau et rendez-vous sur réservation.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Beauty-Salon in ${cityShort}. Haar, Haut und Termine nach Vereinbarung.`,
  },
  club: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — nightclub in ${cityShort}. Late nights, DJs, and weekend energy.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — ночной клуб в ${cityShort}. Вечеринки, DJ и выходные.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: club nocturno en ${cityShort}. Noches largas, DJ y ambiente de fin de semana.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — clube noturno em ${cityShort}. Noites longas, DJs e energia de fim de semana.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — club nocturne à ${cityShort}. Soirées tardives, DJ et week-ends animés.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Nachtclub in ${cityShort}. Lange Nächte, DJs und Wochenendstimmung.`,
  },
  coworking: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — workspace in ${cityShort}. Desks, meeting rooms, and day passes.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — коворкинг в ${cityShort}. Рабочие места, переговорные и дневные пропуска.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: espacio de trabajo en ${cityShort}. Escritorios, salas y pases diarios.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — coworking em ${cityShort}. Mesas, salas de reunião e passes diários.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — espace de coworking à ${cityShort}. Bureaux, salles et pass journée.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Coworking in ${cityShort}. Arbeitsplätze, Meetingräume und Tagespässe.`,
  },
  hookah: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — lounge in ${cityShort}. Hookah, drinks, and relaxed seating.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — лаунж в ${cityShort}. Кальян, напитки и уютная посадка.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: lounge en ${cityShort}. Shisha, copas y ambiente relajado.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — lounge em ${cityShort}. Hookah, bebidas e ambiente descontraído.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — lounge à ${cityShort}. Chicha, boissons et ambiance détendue.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Lounge in ${cityShort}. Shisha, Drinks und entspannte Sitzplätze.`,
  },
  tourism: {
    en: ({ placeName, cityShort }) =>
      `${placeName} — attraction in ${cityShort}. Discover local history, culture, and memorable views.`,
    ru: ({ placeName, cityShort }) =>
      `«${placeName}» — достопримечательность в ${cityShort}. Познакомьтесь с историей, культурой и знаковыми видами города.`,
    es: ({ placeName, cityShort }) =>
      `${placeName}: atracción en ${cityShort}. Descubre la historia, la cultura y vistas memorables.`,
    pt: ({ placeName, cityShort }) =>
      `${placeName} — atração em ${cityShort}. Descubra a história, a cultura e vistas memoráveis.`,
    fr: ({ placeName, cityShort }) =>
      `${placeName} — attraction à ${cityShort}. Découvrez l'histoire, la culture et des vues mémorables.`,
    de: ({ placeName, cityShort }) =>
      `${placeName} — Sehenswürdigkeit in ${cityShort}. Entdecke Geschichte, Kultur und besondere Ausblicke.`,
  },
};

/** @type {Record<string, Record<string, string[]>>} */
const TAGS_BY_POOL = {
  restaurant: {
    en: ["restaurant", "dining", "reservations", "local"],
    ru: ["ресторан", "ужин", "бронирование", "локально"],
    es: ["restaurante", "cena", "reservas", "local"],
    pt: ["restaurante", "jantar", "reservas", "local"],
    fr: ["restaurant", "dîner", "réservation", "local"],
    de: ["restaurant", "essen", "reservierung", "lokal"],
  },
  bar: {
    en: ["bar", "drinks", "cocktails", "nightlife"],
    ru: ["бар", "напитки", "коктейли", "ночь"],
    es: ["bar", "copas", "cócteles", "noche"],
    pt: ["bar", "drinks", "cocktails", "vida noturna"],
    fr: ["bar", "boissons", "cocktails", "nuit"],
    de: ["bar", "drinks", "cocktails", "nachtleben"],
  },
  cafe: {
    en: ["cafe", "coffee", "pastries", "breakfast"],
    ru: ["кафе", "кофе", "выпечка", "завтрак"],
    es: ["café", "café", "bollería", "desayuno"],
    pt: ["café", "café", "pastelaria", "pequeno-almoço"],
    fr: ["café", "café", "pâtisserie", "petit-déjeuner"],
    de: ["café", "kaffee", "gebäck", "frühstück"],
  },
  hotel: {
    en: ["hotel", "stay", "rooms", "travel"],
    ru: ["отель", "проживание", "номера", "поездка"],
    es: ["hotel", "estancia", "habitaciones", "viaje"],
    pt: ["hotel", "estadia", "quartos", "viagem"],
    fr: ["hôtel", "séjour", "chambres", "voyage"],
    de: ["hotel", "übernachtung", "zimmer", "reise"],
  },
  gym: {
    en: ["gym", "fitness", "training", "wellness"],
    ru: ["фитнес", "тренировка", "зал", "здоровье"],
    es: ["gimnasio", "fitness", "entreno", "bienestar"],
    pt: ["ginásio", "fitness", "treino", "bem-estar"],
    fr: ["sport", "fitness", "entraînement", "bien-être"],
    de: ["fitness", "training", "studio", "wellness"],
  },
  beauty: {
    en: ["beauty", "salon", "hair", "appointments"],
    ru: ["красота", "салон", "волосы", "запись"],
    es: ["belleza", "salón", "cabello", "citas"],
    pt: ["beleza", "salão", "cabelo", "marcação"],
    fr: ["beauté", "salon", "cheveux", "rendez-vous"],
    de: ["beauty", "salon", "haare", "termin"],
  },
  club: {
    en: ["club", "nightlife", "music", "dance"],
    ru: ["клуб", "ночь", "музыка", "танцы"],
    es: ["club", "noche", "música", "baile"],
    pt: ["clube", "noite", "música", "dança"],
    fr: ["club", "nuit", "musique", "danse"],
    de: ["club", "nachtleben", "musik", "tanzen"],
  },
  coworking: {
    en: ["coworking", "workspace", "meetings", "wifi"],
    ru: ["коворкинг", "офис", "встречи", "wifi"],
    es: ["coworking", "oficina", "reuniones", "wifi"],
    pt: ["coworking", "escritório", "reuniões", "wifi"],
    fr: ["coworking", "bureau", "réunions", "wifi"],
    de: ["coworking", "büro", "meetings", "wlan"],
  },
  hookah: {
    en: ["lounge", "hookah", "drinks", "relax"],
    ru: ["лаунж", "кальян", "напитки", "отдых"],
    es: ["lounge", "shisha", "copas", "relax"],
    pt: ["lounge", "hookah", "bebidas", "relax"],
    fr: ["lounge", "chicha", "boissons", "détente"],
    de: ["lounge", "shisha", "drinks", "entspannung"],
  },
  tourism: {
    en: ["tourism", "attraction", "sightseeing", "culture"],
    ru: ["туризм", "достопримечательность", "экскурсия", "культура"],
    es: ["turismo", "atracción", "visitas", "cultura"],
    pt: ["turismo", "atração", "passeio", "cultura"],
    fr: ["tourisme", "attraction", "visite", "culture"],
    de: ["tourismus", "sehenswürdigkeit", "besichtigung", "kultur"],
  },
};

export function cityShortFromLabel(cityLabel) {
  return cityLabel?.split(",")[0]?.trim() ?? cityLabel ?? "";
}

function cityTagFromShort(cityShort) {
  return cityShort
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function descriptionFor(pool, loc, ctx) {
  const builders = DESCRIPTION_BY_POOL[pool] ?? DESCRIPTION_BY_POOL.restaurant;
  const fn = builders[loc] ?? builders.en;
  return fn(ctx);
}

function tagsFor(pool, loc, cityShort, cliTags) {
  if (cliTags?.length) return cliTags;
  const base = TAGS_BY_POOL[pool]?.[loc] ?? TAGS_BY_POOL.restaurant[loc];
  const cityTag = cityTagFromShort(cityShort);
  const merged = cityTag ? [base[0], cityTag, ...base.slice(1)] : [...base];
  return [...new Set(merged)].slice(0, 6);
}

/**
 * Build `name`, `description`, `tags` (+ `_ru` … `_de`) for one insert row.
 * When a Google POI is matched, copy is derived from the place name + city + photo pool
 * (never static template text from another city/venue).
 */
export function buildVenueLocalizedFields(venue, { listingType, usedNames, cliTags }) {
  const fromPoi = Boolean(venue._googlePlace?.placeId || venue._osmPlace?.placeId);
  const pool = venue.photoPool ?? "restaurant";
  const cityLabel = venue.city ?? "";
  const cityShort = cityShortFromLabel(cityLabel);

  const rawName = venue._googlePlace?.name?.trim() || venue._osmPlace?.name?.trim() || venue.name.en;
  const nameEn = disambiguateListingName(rawName, venue.address, usedNames);
  usedNames.add(nameEn);

  const ctx = { placeName: nameEn, cityShort, cityLabel, photoPool: pool };

  const row = {
    name: nameEn,
    description: fromPoi ? descriptionFor(pool, "en", ctx) : venue.description.en,
    tags: fromPoi ? tagsFor(pool, "en", cityShort, cliTags) : (cliTags ?? venue.tags.en),
    type: listingType,
  };

  for (const loc of LOCALES) {
    row[`name_${loc}`] = fromPoi ? nameEn : venue.name[loc];
    row[`description_${loc}`] = fromPoi ? descriptionFor(pool, loc, ctx) : venue.description[loc];
    row[`tags_${loc}`] = fromPoi ? tagsFor(pool, loc, cityShort, cliTags) : (cliTags ?? venue.tags[loc]);
  }

  return row;
}
