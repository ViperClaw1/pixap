import { LOCALES, SEED_COUNT, log } from "./lib.mjs";

const REQUIRED_SCALAR = [
  "name",
  "description",
  "address",
  "location",
  "city",
  "phone",
  "contact_whatsapp",
  "category_id",
  "latitude",
  "longitude",
  "rating",
  "booking_price",
  "type",
  "tags",
  "images",
];

export function validateRow(row) {
  const errors = [];

  for (const key of REQUIRED_SCALAR) {
    const v = row[key];
    if (v === null || v === undefined || v === "") errors.push(`${key} is empty`);
  }

  if (!Array.isArray(row.images) || row.images.length < 3 || row.images.length > 6) {
    errors.push(`images must have 3–6 entries (got ${row.images?.length ?? 0})`);
  }

  if (!Array.isArray(row.tags) || row.tags.length < 3) {
    errors.push("tags must have at least 3 entries");
  }

  const rating = Number(row.rating);
  if (Number.isNaN(rating) || rating < 3.5 || rating > 5) {
    errors.push(`rating out of range: ${row.rating}`);
  }

  const price = Number(row.booking_price);
  if (Number.isNaN(price) || price <= 0) errors.push(`booking_price invalid: ${row.booking_price}`);

  for (const loc of LOCALES) {
    if (!row[`name_${loc}`]?.trim()) errors.push(`name_${loc} missing`);
    if (!row[`description_${loc}`]?.trim()) errors.push(`description_${loc} missing`);
    if (!Array.isArray(row[`tags_${loc}`]) || row[`tags_${loc}`].length < 3) {
      errors.push(`tags_${loc} must have >= 3 entries`);
    }
  }

  const uniqueImages = new Set(row.images ?? []);
  if (uniqueImages.size !== (row.images ?? []).length) errors.push("duplicate image URLs");

  return errors;
}

export function validateBatch(rows, { label = "payload", expectedCount = SEED_COUNT } = {}) {
  if (rows.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} rows, got ${rows.length}`);
  }

  const allErrors = [];
  const listingKeys = new Set();

  for (const row of rows) {
    const rowErrors = validateRow(row);
    const listingKey = `${row.name}\0${row.address}`;
    if (listingKeys.has(listingKey)) rowErrors.push("duplicate name+address");
    listingKeys.add(listingKey);
    if (rowErrors.length) {
      allErrors.push({ name: row.name, errors: rowErrors });
    }
  }

  if (allErrors.length) {
    console.error(JSON.stringify(allErrors, null, 2));
    throw new Error(`Validation failed for ${allErrors.length} row(s) (${label})`);
  }

  log("validate", `OK — ${rows.length} rows (${label}), all locales and images present`);
}

/** Post-insert: compare DB rows to what we intended to write (by id). */
export function validatePersistedRows(fetched, prepared, expectedCount = SEED_COUNT) {
  if (fetched.length !== expectedCount || prepared.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} persisted rows, got ${fetched.length}`);
  }

  const byId = new Map(fetched.map((r) => [r.id, r]));
  const allErrors = [];

  for (const expected of prepared) {
    const name = expected.name;
    const row = [...byId.values()].find((r) => r.name === name);
    if (!row) {
      allErrors.push({ name, errors: ["row not found after insert"] });
      continue;
    }

    const errors = [];
    if (row.city !== expected.city) errors.push("city mismatch");
    if (row.address !== expected.address) errors.push("address mismatch");
    if (row.location !== expected.location) errors.push("location mismatch");
    if (row.category_id !== expected.category_id) errors.push("category_id mismatch");
    if (row.phone !== expected.phone) errors.push("phone mismatch");
    if (!row.description?.trim()) errors.push("description empty in DB");
    if (!row.name_ru?.trim()) errors.push("name_ru empty in DB");
    if (!row.name_es?.trim()) errors.push("name_es empty in DB");
    if (!Array.isArray(row.images) || row.images.length < 3) {
      errors.push(`images incomplete in DB (${row.images?.length ?? 0})`);
    }

    if (errors.length) allErrors.push({ name, id: row.id, errors });
  }

  if (allErrors.length) {
    console.error(JSON.stringify(allErrors, null, 2));
    throw new Error(`Post-insert verification failed for ${allErrors.length} row(s)`);
  }

  log("validate", `OK — ${fetched.length} rows persisted in business_cards`);
}
