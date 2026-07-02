#!/usr/bin/env node
/**
 * Seed 10 realistic business_cards with i18n + storage images.
 *
 * Usage:
 *   node scripts/seed-business-cards/seed.mjs [--dry-run] [--skip-images] [--no-google]
 *   node scripts/seed-business-cards/seed.mjs --city Paris
 *   node scripts/seed-business-cards/seed.mjs --type Restaurants --city Almaty
 *   node scripts/seed-business-cards/seed.mjs --google-photo-max-kb 200
 *   node scripts/seed-business-cards/seed.mjs --count 5 --city Paris
 *   node scripts/seed-business-cards/seed.mjs --tags restaurant,fine dining,paris
 *   node scripts/seed-business-cards/seed.mjs --tags '["restaurant","luxury","paris"]'
 *   node scripts/seed-business-cards/seed.mjs --city Paris --names "Le Meurice,Septime"
 *   node scripts/seed-business-cards/seed.mjs --city Istanbul --names '["Nobu Istanbul","Mikla"]'
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc123"
 *   node scripts/seed-business-cards/seed.mjs --link '["https://maps.app.goo.gl/one","https://maps.app.goo.gl/two"]'
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --listing-type featured
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --tags=restaurants,dining,luxury --listing-type featured
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --allow-duplicate
 *   node scripts/seed-business-cards/seed.mjs --city Paris --count 3 --listing-type recommended
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --images 10
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --images all
 *   node scripts/seed-business-cards/seed.mjs --link "https://maps.app.goo.gl/abc" --external-booking
 *   node scripts/seed-business-cards/seed.mjs --source osm --city Almaty --count 5
 *   node scripts/seed-business-cards/seed.mjs --osm --city Paris --names "Le Comptoir,Septime"
 *   node scripts/seed-business-cards/seed.mjs --source osm --link "https://www.openstreetmap.org/node/123456789"
 */
import { resolveSeedCategoryType, selectVenueDefinitions } from "./categoryTypes.mjs";
import {
  applyCityCenterToVenue,
  applyGooglePlaceToVenue,
  applyOsmPlaceToVenue,
  normalizeCityInput,
  pickRandomCityNames,
  resolveCity,
  resolveCityList,
  SEED_CITY_POOL,
} from "./cities.mjs";
import {
  existingCountForCity,
  isDuplicateListing,
  loadExistingVenueIndex,
  registerPreparedListing,
} from "./dedupe.mjs";
import { findPlaceByName, findPlaceForVenue, findPlaceFromMapsLink } from "./googleMaps.mjs";
import {
  findPlaceByName as findOsmPlaceByName,
  findPlaceForVenue as findOsmPlaceForVenue,
  findPlaceFromOsmLink,
} from "./openStreetMap.mjs";
import { createSeedImageRegistry, uploadVenueImages } from "./images.mjs";
import { loadExistingImageUrls } from "./seedImageRegistry.mjs";
import {
  RNG_SEED,
  SEED_IMAGES_DEFAULT_MAX,
  SEED_IMAGES_DEFAULT_MIN,
  SEED_IMAGES_MAX,
  SEED_IMAGES_MIN,
  cloneVenueDefinition,
  createRng,
  createSupabaseAdmin,
  formatBusinessCardLocation,
  loadGoogleMapsApiKey,
  log,
  normalizeSeedPhone,
  parseCliArgs,
  pickInt,
  sleep,
  withRetry,
} from "./lib.mjs";
import { validateBatch, validatePersistedRows, validateRow } from "./validate.mjs";
import { buildVenueLocalizedFields } from "./venueLocalizedCopy.mjs";
import { VENUE_DEFINITIONS } from "./venues.mjs";

const cli = parseCliArgs(process.argv);
const categoryType = cli.type ? resolveSeedCategoryType(cli.type) : null;
const venueDefinitions = selectVenueDefinitions(VENUE_DEFINITIONS, categoryType, cli.count);

function roundRating(value) {
  return Math.round(value * 10) / 10;
}

function resolveVenueImageCount(rng, venue, cliImages) {
  if (cliImages === "all") {
    const googleAvailable = venue._googlePlace?.photoReferences?.length ?? 0;
    const osmAvailable = venue._osmPlace?.imageUrls?.length ?? 0;
    const available = googleAvailable || osmAvailable;
    if (available >= SEED_IMAGES_MIN) {
      return Math.min(available, SEED_IMAGES_MAX);
    }
    return pickInt(rng, SEED_IMAGES_DEFAULT_MIN, SEED_IMAGES_DEFAULT_MAX);
  }
  if (typeof cliImages === "number") return cliImages;
  return pickInt(rng, SEED_IMAGES_DEFAULT_MIN, SEED_IMAGES_DEFAULT_MAX);
}

function buildInsertRow(venue, rng, images, usedNames) {
  const ratingJitter = (rng() - 0.5) * 0.4;
  const rating = roundRating(Math.min(5, Math.max(3.5, venue.ratingBase + ratingJitter)));
  const booking_price = 0;

  return {
    ...buildVenueLocalizedFields(venue, {
      listingType: cli.listingType ?? venue.listingType,
      usedNames,
      cliTags: cli.tags,
    }),
    category_id: venue.categoryId,
    city: venue.city,
    address: venue.address,
    location: formatBusinessCardLocation(venue.address, venue.latitude, venue.longitude),
    latitude: venue.latitude,
    longitude: venue.longitude,
    phone: normalizeSeedPhone(venue.phone) ?? venue.phone,
    contact_whatsapp:
      normalizeSeedPhone(venue.contact_whatsapp) ??
      normalizeSeedPhone(venue.phone) ??
      venue.contact_whatsapp,
    rating,
    booking_price,
    google_place_id: venue._googlePlace?.placeId ?? null,
    cuisine_types: venue._googlePlace?.cuisine_types ?? venue._osmPlace?.cuisine_types ?? [],
    menu_items: venue._googlePlace?.menu_items ?? venue._osmPlace?.menu_items ?? [],
    price_tier: venue._googlePlace?.price_tier ?? venue._osmPlace?.price_tier ?? null,
    external_booking_platform: venue._googlePlace?.external_booking_platform ?? null,
    external_booking_url: venue._googlePlace?.external_booking_url ?? null,
    images: images ?? [],
    image: images?.[0] ?? null,
  };
}

function skipVenue(name, reason, details = "") {
  const detail = details ? `: ${details}` : "";
  log("skip", `${name} — ${reason}${detail}`);
  return { skipped: true, name, reason, details };
}

const INSERT_CHUNK_SIZE = 5;

async function insertBusinessCardsWithRetry(supabase, rows) {
  const inserted = [];
  const select =
    "id, name, city, images, rating, booking_price";

  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + INSERT_CHUNK_SIZE);
    const chunkLabel = `insert rows ${offset + 1}-${offset + chunk.length}/${rows.length}`;

    const chunkRows = await withRetry(
      chunkLabel,
      async () => {
        const { data, error } = await supabase
          .from("business_cards")
          .insert(chunk)
          .select(select);
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error("insert returned 0 rows");
        return data;
      },
      { attempts: 5, baseDelayMs: 1500 },
    );

    inserted.push(...chunkRows);
    if (offset + INSERT_CHUNK_SIZE < rows.length) await sleep(400);
  }

  return inserted;
}

async function prepareVenue(
  venueTemplate,
  index,
  venueCount,
  {
    cityResolved,
    googleApiKey,
    source,
    rng,
    supabase,
    usedPlaceIds,
    usedNames,
    existingIndex,
    imageRegistry,
    targetPlaceName = null,
    targetMapsLink = null,
  },
) {
  const venue = cloneVenueDefinition(venueTemplate);
  if (cli.listingType) venue.listingType = cli.listingType;
  const useOsm = source === "osm";
  const useGoogle = Boolean(googleApiKey) && !cli.skipImages && !cli.noGoogle && !useOsm;
  const requireGooglePhotos = useGoogle;
  const requireOsmPhotos = useOsm && !cli.skipImages;
  const usePoiLookup = useGoogle || useOsm;
  const priorInCity = existingCountForCity(cityResolved.label, existingIndex);
  const linkLookup = Boolean(targetMapsLink?.trim());
  const namedLookup = Boolean(targetPlaceName?.trim()) && !linkLookup;
  const directLookup = linkLookup || namedLookup;
  const maxPoiAttempts = usePoiLookup && !directLookup ? 5 : 1;

  let prepared = null;
  let place = null;

  for (let attempt = 0; attempt < maxPoiAttempts; attempt += 1) {
    const geoSlot = index + priorInCity + attempt;
    prepared = applyCityCenterToVenue(venue, cityResolved, geoSlot);
    place = null;

    if (!usePoiLookup) break;

    try {
      if (useOsm) {
        place = await withRetry(
          linkLookup
            ? `osm:link:${index + 1}`
            : namedLookup
              ? `osm:name:${targetPlaceName}@${cityResolved.label}`
              : `osm:${venueTemplate.slug}@${cityResolved.label}`,
          async () => {
            if (linkLookup) {
              const outcome = await findPlaceFromOsmLink(targetMapsLink, {
                venue: prepared,
                excludePlaceIds: usedPlaceIds,
                excludeAddresses: existingIndex.addresses,
                allowDuplicate: cli.allowDuplicate,
              });
              if (outcome.failure) {
                outcome.failure._osmLinkFailure = true;
                throw outcome.failure;
              }
              return outcome.place;
            }
            if (namedLookup) {
              return findOsmPlaceByName(targetPlaceName, cityResolved.label, {
                venue: prepared,
                excludePlaceIds: usedPlaceIds,
                excludeAddresses: existingIndex.addresses,
              });
            }
            return findOsmPlaceForVenue(prepared, cityResolved.label, {
              excludePlaceIds: usedPlaceIds,
              excludeAddresses: existingIndex.addresses,
            });
          },
          { attempts: 4, baseDelayMs: 1500 },
        );
      } else {
        place = await withRetry(
          linkLookup
            ? `places:link:${index + 1}`
            : namedLookup
              ? `places:name:${targetPlaceName}@${cityResolved.label}`
              : `places:${venueTemplate.slug}@${cityResolved.label}`,
          async () => {
            if (linkLookup) {
              const outcome = await findPlaceFromMapsLink(targetMapsLink, googleApiKey, {
                venue: prepared,
                excludePlaceIds: usedPlaceIds,
                excludeAddresses: existingIndex.addresses,
                allowDuplicate: cli.allowDuplicate,
                includeExternalBooking: cli.externalBooking,
              });
              if (outcome.failure) {
                outcome.failure._mapsLinkFailure = true;
                throw outcome.failure;
              }
              return outcome.place;
            }
            if (namedLookup) {
              return findPlaceByName(targetPlaceName, cityResolved.label, googleApiKey, {
                venue: prepared,
                excludePlaceIds: usedPlaceIds,
                excludeAddresses: existingIndex.addresses,
                includeExternalBooking: cli.externalBooking,
              });
            }
            return findPlaceForVenue(prepared, cityResolved.label, googleApiKey, {
              excludePlaceIds: usedPlaceIds,
              excludeAddresses: existingIndex.addresses,
              includeExternalBooking: cli.externalBooking,
            });
          },
          { attempts: 4, baseDelayMs: 1200 },
        );
      }
    } catch (err) {
      if (useOsm && linkLookup && err && typeof err === "object" && err._osmLinkFailure) {
        const label = err.placeName ?? targetMapsLink.slice(0, 80);
        const reasonByCode = {
          duplicate: "Venue already exists in business_cards",
          unresolved: "Could not resolve OpenStreetMap link to a POI",
          no_details: "Nominatim lookup returned no data",
          no_poi: "OSM element has no usable name/address tags",
          used_in_run: "Same OSM id already seeded in this run",
        };
        return skipVenue(label, reasonByCode[err.reason] ?? "OpenStreetMap link lookup failed", err.details);
      }
      if (linkLookup && err && typeof err === "object" && err._mapsLinkFailure) {
        const label = err.placeName ?? targetMapsLink.slice(0, 80);
        const reasonByCode = {
          duplicate: "Venue already exists in business_cards",
          unresolved: "Could not resolve Google Maps link to a place",
          no_details: "Google Place Details returned no data",
          no_photos: "Google place has no usable photos",
          used_in_run: "Same place already seeded in this run",
        };
        return skipVenue(label, reasonByCode[err.reason] ?? "Google Maps link lookup failed", err.details);
      }
      return skipVenue(
        linkLookup
          ? targetMapsLink.slice(0, 80)
          : namedLookup
            ? `${targetPlaceName} (${cityResolved.label})`
            : `${venueTemplate.slug} (${cityResolved.label})`,
        useOsm ? "OpenStreetMap lookup failed" : "Google Places lookup failed",
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!place) break;

    const dupReason =
      linkLookup && cli.allowDuplicate
        ? null
        : isDuplicateListing(place.name, place.formatted_address, existingIndex);
    if (dupReason) {
      usedPlaceIds.add(place.placeId);
      log("dedupe", `"${place.name}" skipped — ${dupReason}`);
      place = null;
      if (directLookup) break;
      continue;
    }

    break;
  }

  if (!prepared) {
    return skipVenue(venue.name.en, "Could not assign seed coordinates");
  }

  if (usePoiLookup) {
    if (place) {
      usedPlaceIds.add(place.placeId);
      prepared = useOsm ? applyOsmPlaceToVenue(prepared, place) : applyGooglePlaceToVenue(prepared, place);
      const phoneNote = place.phone ? `, tel ${place.phone}` : "";
      const priceNote =
        typeof place.price_level === "number" ? `, price_level=${place.price_level}` : "";
      const cuisineNote =
        place.cuisine_types?.length ? `, cuisine=[${place.cuisine_types.slice(0, 4).join(", ")}]` : "";
      const imageNote = useOsm
        ? `, ${place.imageUrls?.length ?? 0} image tag(s)`
        : `, ${place.photoReferences.length} photos`;
      const poiLabel = useOsm ? "osm" : "google";
      log(
        poiLabel,
        `Template "${venueTemplate.slug}" → POI "${place.name}" (${place.distanceM}m, ${place.formatted_address}${phoneNote}${priceNote}${cuisineNote}${imageNote})`,
      );
    } else if (linkLookup) {
      return skipVenue(
        targetMapsLink.slice(0, 80),
        useOsm ? "Could not load venue from OpenStreetMap link" : "Could not load venue from Google Maps link",
        useOsm ? "check the URL points to a node/way/relation with name tags" : "check the URL opens a place page with photos",
      );
    } else if (namedLookup) {
      return skipVenue(
        targetPlaceName,
        useOsm
          ? "No OpenStreetMap match for requested venue name"
          : "No Google Places match for requested venue name",
        `try a more specific --names value in ${cityResolved.label}`,
      );
    } else if (prepared.photoPool === "restaurant") {
      return skipVenue(
        prepared.name.en,
        useOsm
          ? "No new upscale restaurant near seed point in OSM"
          : "No new upscale restaurant with Google photos near seed point",
        useOsm
          ? "catalogue may be exhausted for this area"
          : "catalogue may be exhausted for this area, or relax --google-photo-max-kb",
      );
    } else {
      return skipVenue(
        prepared.name.en,
        useOsm
          ? "No new OpenStreetMap POI near seed coordinates"
          : "No new Google Places POI with photos near seed coordinates",
      );
    }
  }

  const imageCount = resolveVenueImageCount(rng, prepared, cli.images);
  const listingLabel =
    prepared._googlePlace?.name?.trim() ?? prepared._osmPlace?.name?.trim() ?? prepared.name.en;
  log(
    "venue",
    `[${index + 1}/${venueCount}] ${listingLabel} (${prepared.city}) — ${imageCount} images`,
  );

  let images;
  if (cli.skipImages) {
    images = Array.from(
      { length: imageCount },
      (_, j) => `https://picsum.photos/seed/${prepared.slug}-${j}/1200/800`,
    );
    log("images", "Skipped upload (--skip-images); placeholder URLs only");
  } else if (cli.dryRun) {
    const sourceLabel = useOsm
      ? "osm-wikimedia+stock"
      : useGoogle && prepared._googlePlace
        ? "google-places-only"
        : "stock";
    images = Array.from({ length: imageCount }, (_, j) => `https://example.com/${prepared.slug}/${j + 1}.jpg`);
    log("images", `Dry run — would use ${sourceLabel} (${imageCount} files)`);
  } else {
    images = await uploadVenueImages(supabase, prepared, imageCount, {
      googleApiKey: useGoogle ? googleApiKey : null,
      googlePhotoMaxBytes: useGoogle ? cli.googlePhotoMaxBytes : null,
      requireGooglePhotos,
      requireOsmPhotos,
      registry: imageRegistry,
    });
    if (requireGooglePhotos && (!images || images.length === 0)) {
      log(
        "images",
        `${listingLabel}: no unique Google Places photos — inserting with empty images[]`,
      );
      images = [];
    }
  }

  const row = buildInsertRow(prepared, rng, images, usedNames);
  if (prepared._googlePlace || prepared._osmPlace) {
    log("copy", `${row.name}: ${row.description.slice(0, 72)}…`);
  }
  const dupReason =
    linkLookup && cli.allowDuplicate ? null : isDuplicateListing(row.name, row.address, existingIndex);
  if (dupReason) {
    return skipVenue(row.name, dupReason);
  }

  registerPreparedListing(row.name, row.address, prepared.city ?? cityResolved.label, existingIndex);
  return { skipped: false, row };
}

async function main() {
  const useOsm = cli.source === "osm";

  if (cli.links?.length) {
    if (useOsm) {
      log("link", `OpenStreetMap URLs: ${cli.links.length} place(s)`);
    } else if (cli.noGoogle) {
      throw new Error("--link requires Google Places API (do not use --no-google)");
    } else {
      log("link", `Maps URLs: ${cli.links.length} place(s)`);
    }
  }

  if (cli.names?.length) {
    if (!cli.city) {
      throw new Error(
        useOsm
          ? "--names requires --city so Nominatim can scope venue names"
          : "--names requires --city so Google Text Search can scope venue names",
      );
    }
    if (!useOsm && cli.noGoogle) {
      throw new Error("--names requires Google Places API (do not use --no-google)");
    }
    log("names", `Target venues: ${cli.names.join(" · ")}`);
  }

  const googleApiKey = useOsm || cli.noGoogle ? null : loadGoogleMapsApiKey();
  const rng = createRng(RNG_SEED);
  const venueCount = venueDefinitions.length;

  let supabase = null;
  let existingIndex = {
    addresses: new Set(),
    nameAddressKeys: new Set(),
    countByCity: new Map(),
  };

  if (!cli.dryRun) {
    supabase = createSupabaseAdmin();
  }

  const LINK_CITY_PLACEHOLDER = {
    label: useOsm ? "from OpenStreetMap link" : "from Google Maps link",
    lat: 0,
    lng: 0,
  };

  let cityAssignments;
  if (cli.links?.length && !cli.city) {
    cityAssignments = Array.from({ length: venueCount }, () => LINK_CITY_PLACEHOLDER);
    log("city", `--link mode: city will be taken from each ${useOsm ? "OSM" : "Maps"} place`);
  } else if (cli.city) {
    if (cli.cityParsedAsShorthand) {
      log(
        "cli",
        `Parsed "${cli.city}" as city (shorthand). Prefer: --city ${normalizeCityInput(cli.city)}`,
      );
    }
    const resolved = await resolveCity(cli.city, googleApiKey, cli.source);
    cityAssignments = Array.from({ length: venueCount }, () => resolved);
    log("city", `All ${venueCount} venues → ${resolved.label}`);
  } else {
    if (venueCount > SEED_CITY_POOL.length) {
      log(
        "city",
        `No --city: spreading ${venueCount} venues across random cities (pool has ${SEED_CITY_POOL.length}, expect repeats). Use --city "<name>" for one city.`,
      );
    }
    const names = pickRandomCityNames(rng, venueCount);
    cityAssignments = await resolveCityList(names, googleApiKey, cli.source);
    log("city", `Random cities: ${names.join(" · ")}`);
  }

  if (categoryType) {
    log(
      "type",
      `Category filter: ${categoryType.displayName} (Places search: ${categoryType.photoPool}, category_id=${categoryType.categoryId})`,
    );
  }

  const dedupeCities = [...new Set(cityAssignments.map((c) => c.label))];
  const dedupeAllCities = Boolean(cli.links?.length && !cli.city);
  if (!cli.dryRun && supabase) {
    existingIndex = await loadExistingVenueIndex(supabase, {
      cities: dedupeCities,
      categoryId: categoryType?.categoryId ?? null,
      allCities: dedupeAllCities,
    });
  } else if (cli.dryRun) {
    try {
      const admin = createSupabaseAdmin();
      existingIndex = await loadExistingVenueIndex(admin, {
        cities: dedupeCities,
        categoryId: categoryType?.categoryId ?? null,
        allCities: dedupeAllCities,
      });
    } catch (err) {
      log("dedupe", `Dry-run: could not load existing rows (${err.message})`);
    }
  }

  if (!googleApiKey && !cli.skipImages && !cli.noGoogle && !useOsm) {
    log(
      "google",
      "No Google API key — images will use Unsplash/Picsum (not Google). Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for Places-only photos.",
    );
  } else if (useOsm) {
    log(
      "osm",
      "OpenStreetMap mode: Nominatim + Overpass for POI/geo; images from Wikimedia/OSM tags, stock fills gaps.",
    );
  } else if (googleApiKey && !cli.skipImages && !cli.noGoogle) {
    const restaurantNote =
      categoryType?.photoPool === "restaurant"
        ? " Restaurants: upscale filter (no fast food / beer halls)."
        : "";
    log(
      "google",
      `Google mode: photos only from Places API (no Unsplash/Picsum fallback).${restaurantNote}`,
    );
    if (cli.externalBooking) {
      log(
        "google",
        "External booking enabled: Places New `websiteUri` will be checked for Resy/OpenTable/Tock links.",
      );
    }
  }

  const googlePhotoCapLabel =
    cli.googlePhotoMaxBytes != null
      ? `${cli.googlePhotoMaxKb} KB`
      : "none";

  const linkSourceLabel = cli.links?.length
    ? `${cli.links.length} ${useOsm ? "OSM" : "Maps"} link(s)`
    : cli.names?.join(", ") ?? "random nearby POI";

  log(
    "seed",
    `Starting business_cards seed (${venueCount} venues, count=${cli.count}, dryRun=${cli.dryRun}, skipImages=${cli.skipImages}, source=${cli.source}, city=${cli.city ?? (cli.links?.length ? "from link" : "random")}, poi=${linkSourceLabel}, category=${categoryType?.displayName ?? "all"}, listingType=${cli.listingType ?? "from venues.mjs"}, images=${cli.images ?? `random ${SEED_IMAGES_DEFAULT_MIN}-${SEED_IMAGES_DEFAULT_MAX}`}, tags=${cli.tags?.join(", ") ?? "from venues.mjs"}, googlePhotoMax=${googlePhotoCapLabel}, externalBooking=${cli.externalBooking})`,
  );

  const prepared = [];
  const skippedVenues = [];
  const usedPlaceIds = new Set();
  const usedNames = new Set();
  const imageRegistry = createSeedImageRegistry();

  if (!cli.dryRun && supabase) {
    await loadExistingImageUrls(supabase, imageRegistry, {
      cities: dedupeCities,
      categoryId: categoryType?.categoryId ?? null,
    });
  }

  const poiVenueGapMs =
    (googleApiKey && !cli.skipImages && !cli.noGoogle) || useOsm ? (useOsm ? 1200 : 450) : 0;

  for (let i = 0; i < venueDefinitions.length; i += 1) {
    if (i > 0 && poiVenueGapMs > 0) await sleep(poiVenueGapMs);
    const outcome = await prepareVenue(venueDefinitions[i], i, venueCount, {
      cityResolved: cityAssignments[i],
      googleApiKey,
      source: cli.source,
      rng,
      supabase,
      usedPlaceIds,
      usedNames,
      existingIndex,
      imageRegistry,
      targetPlaceName: cli.names?.[i] ?? null,
      targetMapsLink: cli.links?.[i] ?? null,
    });
    if (outcome.skipped) {
      skippedVenues.push(outcome);
      continue;
    }
    const rowErrors = validateRow(outcome.row);
    if (rowErrors.length) throw new Error(`${outcome.row.name}: ${rowErrors.join(", ")}`);
    prepared.push(outcome.row);
  }

  if (skippedVenues.length) {
    log(
      "seed",
      `Skipped ${skippedVenues.length}/${venueCount} venue(s)${useOsm ? "" : " — no stock image fallback when Google mode is on"}`,
    );
    console.table(
      skippedVenues.map((s) => ({
        name: s.name,
        reason: s.reason,
        details: s.details?.slice(0, 120) ?? "",
      })),
    );
  }

  if (!prepared.length) {
    const duplicateOnly =
      skippedVenues.length > 0 &&
      skippedVenues.every((s) => s.reason === "Venue already exists in business_cards" || s.reason.includes("already in business_cards"));
    throw new Error(
      duplicateOnly
        ? "All requested venues are already in business_cards — use --allow-duplicate with --link to insert again"
        : "No new venues ready to insert — catalogue may already cover these cities; try another city, --count, or --type",
    );
  }

  validateBatch(prepared, { label: "pre-insert payload", expectedCount: prepared.length });

  if (cli.dryRun) {
    log("seed", "Dry run complete — no database writes.");
    console.log(JSON.stringify(prepared.map((r) => ({ name: r.name, city: r.city, images: r.images.length })), null, 2));
    return;
  }

  log("insert", `Batch inserting ${prepared.length} rows…`);
  const data = await insertBusinessCardsWithRetry(supabase, prepared);

  log("insert", `Inserted ${data.length} business_cards`);

  const ids = data.map((r) => r.id);
  const { data: verifyRows, error: verifyErr } = await supabase.from("business_cards").select("*").in("id", ids);

  if (verifyErr) throw new Error(`post-insert verify failed: ${verifyErr.message}`);
  if (!verifyRows?.length) {
    throw new Error("post-insert verify returned 0 rows — check RLS or project URL in .env");
  }

  validatePersistedRows(verifyRows, prepared, prepared.length);
  log("done", "Seed finished successfully. Rows are in public.business_cards.");
  console.table(
    data.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      images: r.images?.length ?? 0,
      rating: r.rating,
      booking_price: r.booking_price,
    })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
