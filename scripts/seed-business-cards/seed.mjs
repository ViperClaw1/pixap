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
  pickRandomCityNames,
  resolveCity,
  resolveCityList,
} from "./cities.mjs";
import { findPlaceForVenue } from "./googleMaps.mjs";
import { GoogleVenueImagesError, uploadVenueImages } from "./images.mjs";
import {
  LOCALES,
  RNG_SEED,
  createRng,
  createSupabaseAdmin,
  disambiguateListingName,
  formatBusinessCardLocation,
  loadGoogleMapsApiKey,
  log,
  normalizeSeedPhone,
  parseCliArgs,
  pickInt,
} from "./lib.mjs";
import { validateBatch, validatePersistedRows, validateRow } from "./validate.mjs";
import { VENUE_DEFINITIONS } from "./venues.mjs";

const cli = parseCliArgs(process.argv);
const categoryType = cli.type ? resolveSeedCategoryType(cli.type) : null;
const venueDefinitions = selectVenueDefinitions(VENUE_DEFINITIONS, categoryType, cli.count);

function roundRating(value) {
  return Math.round(value * 10) / 10;
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function buildLocalizedFields(venue, listingType, usedNames, cliTags) {
  const rawName = venue._googlePlace?.name?.trim() || venue.name.en;
  const nameEn = disambiguateListingName(rawName, venue.address, usedNames);
  usedNames.add(nameEn);
  const row = {
    name: nameEn,
    description: venue.description.en,
    tags: cliTags ?? venue.tags.en,
    type: listingType,
  };
  for (const loc of LOCALES) {
    row[`name_${loc}`] = venue.name[loc];
    row[`description_${loc}`] = venue.description[loc];
    row[`tags_${loc}`] = cliTags ?? venue.tags[loc];
  }
  return row;
}

function buildInsertRow(venue, rng, images, usedNames) {
  const ratingJitter = (rng() - 0.5) * 0.4;
  const priceJitter = (rng() - 0.4) * 0.25;
  const rating = roundRating(Math.min(5, Math.max(3.5, venue.ratingBase + ratingJitter)));
  const booking_price = roundPrice(Math.max(12, venue.bookingPriceBase * (1 + priceJitter)));

  return {
    ...buildLocalizedFields(venue, venue.listingType, usedNames, cli.tags),
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
    images,
    image: images[0] ?? "",
  };
}

function skipVenue(name, reason, details = "") {
  const detail = details ? `: ${details}` : "";
  log("skip", `${name} — ${reason}${detail}`);
  return { skipped: true, name, reason, details };
}

async function prepareVenue(venue, index, venueCount, { cityResolved, googleApiKey, rng, supabase, usedPlaceIds, usedNames }) {
  let prepared = applyCityCenterToVenue(venue, cityResolved, rng, index);

  const useGoogle = Boolean(googleApiKey) && !cli.skipImages && !cli.noGoogle;
  const requireGooglePhotos = useGoogle;

  if (useGoogle) {
    try {
      const place = await findPlaceForVenue(prepared, cityResolved.label, googleApiKey, {
        excludePlaceIds: usedPlaceIds,
      });
      if (place) {
        usedPlaceIds.add(place.placeId);
        prepared = applyGooglePlaceToVenue(prepared, place);
        const phoneNote = place.phone ? `, tel ${place.phone}` : "";
        const priceNote =
          typeof place.price_level === "number" ? `, price_level=${place.price_level}` : "";
        log(
          "google",
          `Seed "${venue.name.en}" → POI "${place.name}" (${place.distanceM}m, ${place.formatted_address}${phoneNote}${priceNote}, ${place.photoReferences.length} photos)`,
        );
      } else if (prepared.photoPool === "restaurant") {
        return skipVenue(
          prepared.name.en,
          "No upscale restaurant with Google photos near seed point",
          "fast food / bars / $ chains filtered; try another city or loosen --google-photo-max-kb",
        );
      } else {
        return skipVenue(
          prepared.name.en,
          "No Google Places POI with photos near seed coordinates",
        );
      }
    } catch (err) {
      return skipVenue(prepared.name.en, "Google Places lookup failed", err.message);
    }
  }

  const imageCount = pickInt(rng, 3, 6);
  log(
    "venue",
    `[${index + 1}/${venueCount}] ${prepared.name.en} (${prepared.city}) — ${imageCount} images`,
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
    try {
      images = await uploadVenueImages(supabase, prepared, imageCount, {
        googleApiKey: useGoogle ? googleApiKey : null,
        googlePhotoMaxBytes: useGoogle ? cli.googlePhotoMaxBytes : null,
        requireGooglePhotos,
      });
    } catch (err) {
      if (err instanceof GoogleVenueImagesError) {
        return skipVenue(prepared.name.en, err.reason, err.details || err.message);
      }
      throw err;
    }
  }

  return { skipped: false, row: buildInsertRow(prepared, rng, images, usedNames) };
}

async function main() {
  const googleApiKey = cli.noGoogle ? null : loadGoogleMapsApiKey();
  const rng = createRng(RNG_SEED);
  const supabase = cli.dryRun ? null : createSupabaseAdmin();
  const venueCount = venueDefinitions.length;

  let cityAssignments;
  if (cli.city) {
    const resolved = await resolveCity(cli.city, googleApiKey);
    cityAssignments = Array.from({ length: venueCount }, () => resolved);
    log("city", `All venues → ${resolved.label}`);
  } else {
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

  if (!googleApiKey && !cli.skipImages && !cli.noGoogle) {
    log(
      "google",
      "No Google API key — images will use Unsplash/Picsum (not Google). Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY for Places-only photos.",
    );
  } else if (googleApiKey && !cli.skipImages && !cli.noGoogle) {
    log(
      "google",
      "Google mode: photos only from Places API (no Unsplash/Picsum fallback). Restaurants: upscale filter (no fast food / beer halls).",
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

  for (let i = 0; i < venueDefinitions.length; i += 1) {
    const outcome = await prepareVenue(venueDefinitions[i], i, venueCount, {
      cityResolved: cityAssignments[i],
      googleApiKey,
      rng,
      supabase,
      usedPlaceIds,
      usedNames,
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
    throw new Error("No venues ready to insert — fix Google Places/photo issues or use --no-google");
  }

  validateBatch(prepared, { label: "pre-insert payload", expectedCount: prepared.length });

  if (cli.dryRun) {
    log("seed", "Dry run complete — no database writes.");
    console.log(JSON.stringify(prepared.map((r) => ({ name: r.name, city: r.city, images: r.images.length })), null, 2));
    return;
  }

  log("insert", `Batch inserting ${prepared.length} rows…`);
  const { data, error } = await supabase
    .from("business_cards")
    .insert(prepared)
    .select("id, name, city, images, rating, booking_price");

  if (error) throw new Error(`insert failed: ${error.message}`);

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
