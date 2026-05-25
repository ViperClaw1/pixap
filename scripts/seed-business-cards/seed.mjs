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
 */
import { resolveSeedCategoryType, selectVenueDefinitions } from "./categoryTypes.mjs";
import {
  applyCityCenterToVenue,
  applyGooglePlaceToVenue,
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
import { findPlaceForVenue } from "./googleMaps.mjs";
import { createSeedImageRegistry, uploadVenueImages } from "./images.mjs";
import { loadExistingImageUrls } from "./seedImageRegistry.mjs";
import {
  RNG_SEED,
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

function buildInsertRow(venue, rng, images, usedNames) {
  const ratingJitter = (rng() - 0.5) * 0.4;
  const rating = roundRating(Math.min(5, Math.max(3.5, venue.ratingBase + ratingJitter)));
  const booking_price = 0;

  return {
    ...buildVenueLocalizedFields(venue, {
      listingType: venue.listingType,
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
  { cityResolved, googleApiKey, rng, supabase, usedPlaceIds, usedNames, existingIndex, imageRegistry },
) {
  const venue = cloneVenueDefinition(venueTemplate);
  const useGoogle = Boolean(googleApiKey) && !cli.skipImages && !cli.noGoogle;
  const requireGooglePhotos = useGoogle;
  const priorInCity = existingCountForCity(cityResolved.label, existingIndex);
  const maxPoiAttempts = useGoogle ? 5 : 1;

  let prepared = null;
  let place = null;

  for (let attempt = 0; attempt < maxPoiAttempts; attempt += 1) {
    const geoSlot = index + priorInCity + attempt;
    prepared = applyCityCenterToVenue(venue, cityResolved, geoSlot);
    place = null;

    if (!useGoogle) break;

    try {
      place = await withRetry(
        `places:${venueTemplate.slug}@${cityResolved.label}`,
        () =>
          findPlaceForVenue(prepared, cityResolved.label, googleApiKey, {
            excludePlaceIds: usedPlaceIds,
            excludeAddresses: existingIndex.addresses,
          }),
        { attempts: 4, baseDelayMs: 1200 },
      );
    } catch (err) {
      return skipVenue(
        `${venueTemplate.slug} (${cityResolved.label})`,
        "Google Places lookup failed",
        err.message,
      );
    }

    if (!place) break;

    const dupReason = isDuplicateListing(place.name, place.formatted_address, existingIndex);
    if (dupReason) {
      usedPlaceIds.add(place.placeId);
      log("dedupe", `"${place.name}" skipped — ${dupReason}`);
      place = null;
      continue;
    }

    break;
  }

  if (!prepared) {
    return skipVenue(venue.name.en, "Could not assign seed coordinates");
  }

  if (useGoogle) {
    if (place) {
      usedPlaceIds.add(place.placeId);
      prepared = applyGooglePlaceToVenue(prepared, place);
      const phoneNote = place.phone ? `, tel ${place.phone}` : "";
      const priceNote =
        typeof place.price_level === "number" ? `, price_level=${place.price_level}` : "";
      log(
        "google",
        `Template "${venueTemplate.slug}" → POI "${place.name}" (${place.distanceM}m, ${place.formatted_address}${phoneNote}${priceNote}, ${place.photoReferences.length} photos)`,
      );
    } else if (prepared.photoPool === "restaurant") {
      return skipVenue(
        prepared.name.en,
        "No new upscale restaurant with Google photos near seed point",
        "catalogue may be exhausted for this area, or relax --google-photo-max-kb",
      );
    } else {
      return skipVenue(
        prepared.name.en,
        "No new Google Places POI with photos near seed coordinates",
      );
    }
  }

  const imageCount = pickInt(rng, 3, 6);
  const listingLabel = prepared._googlePlace?.name?.trim() ?? prepared.name.en;
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
    const source = useGoogle && prepared._googlePlace ? "google-places-only" : "stock";
    images = Array.from({ length: imageCount }, (_, j) => `https://example.com/${prepared.slug}/${j + 1}.jpg`);
    log("images", `Dry run — would use ${source} (${imageCount} files)`);
  } else {
    images = await uploadVenueImages(supabase, prepared, imageCount, {
      googleApiKey: useGoogle ? googleApiKey : null,
      googlePhotoMaxBytes: useGoogle ? cli.googlePhotoMaxBytes : null,
      requireGooglePhotos,
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
  if (prepared._googlePlace) {
    log("copy", `${row.name}: ${row.description.slice(0, 72)}…`);
  }
  const dupReason = isDuplicateListing(row.name, row.address, existingIndex);
  if (dupReason) {
    return skipVenue(row.name, dupReason);
  }

  registerPreparedListing(row.name, row.address, cityResolved.label, existingIndex);
  return { skipped: false, row };
}

async function main() {
  const googleApiKey = cli.noGoogle ? null : loadGoogleMapsApiKey();
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

  let cityAssignments;
  if (cli.city) {
    if (cli.cityParsedAsShorthand) {
      log(
        "cli",
        `Parsed "${cli.city}" as city (shorthand). Prefer: --city ${normalizeCityInput(cli.city)}`,
      );
    }
    const resolved = await resolveCity(cli.city, googleApiKey);
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
    cityAssignments = await resolveCityList(names, googleApiKey);
    log("city", `Random cities: ${names.join(" · ")}`);
  }

  if (categoryType) {
    log(
      "type",
      `Category filter: ${categoryType.displayName} (Places search: ${categoryType.photoPool}, category_id=${categoryType.categoryId})`,
    );
  }

  const dedupeCities = [...new Set(cityAssignments.map((c) => c.label))];
  if (!cli.dryRun && supabase) {
    existingIndex = await loadExistingVenueIndex(supabase, {
      cities: dedupeCities,
      categoryId: categoryType?.categoryId ?? null,
    });
  } else if (cli.dryRun) {
    try {
      const admin = createSupabaseAdmin();
      existingIndex = await loadExistingVenueIndex(admin, {
        cities: dedupeCities,
        categoryId: categoryType?.categoryId ?? null,
      });
    } catch (err) {
      log("dedupe", `Dry-run: could not load existing rows (${err.message})`);
    }
  }

  if (!googleApiKey && !cli.skipImages && !cli.noGoogle) {
    log(
      "google",
      "No Google API key — images will use Unsplash/Picsum (not Google). Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for Places-only photos.",
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
  }

  const googlePhotoCapLabel =
    cli.googlePhotoMaxBytes != null
      ? `${cli.googlePhotoMaxKb} KB`
      : "none";

  log(
    "seed",
    `Starting business_cards seed (${venueCount} venues, count=${cli.count}, dryRun=${cli.dryRun}, skipImages=${cli.skipImages}, city=${cli.city ?? "random"}, type=${categoryType?.displayName ?? "all"}, tags=${cli.tags?.join(", ") ?? "from venues.mjs"}, googlePhotoMax=${googlePhotoCapLabel})`,
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

  const googleVenueGapMs =
    googleApiKey && !cli.skipImages && !cli.noGoogle ? 450 : 0;

  for (let i = 0; i < venueDefinitions.length; i += 1) {
    if (i > 0 && googleVenueGapMs > 0) await sleep(googleVenueGapMs);
    const outcome = await prepareVenue(venueDefinitions[i], i, venueCount, {
      cityResolved: cityAssignments[i],
      googleApiKey,
      rng,
      supabase,
      usedPlaceIds,
      usedNames,
      existingIndex,
      imageRegistry,
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
      `Skipped ${skippedVenues.length}/${venueCount} venue(s) — no stock image fallback when Google mode is on`,
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
    throw new Error(
      "No new venues ready to insert — catalogue may already cover these cities; try another city, --count, or --type",
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
