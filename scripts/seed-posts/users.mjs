import { randomUUID } from "node:crypto";
import { log, sleep, withRetry } from "./lib.mjs";

const PAGE_SIZE = 1000;
const PROFILE_CHUNK_SIZE = 100;
const CREATE_DELAY_MS = 80;
const SEED_MARKER = "seed-posts";

const FIRST_NAMES = [
  "Alex",
  "Mia",
  "Noah",
  "Sofia",
  "Leo",
  "Maya",
  "Daniel",
  "Emma",
  "Lucas",
  "Nora",
];
const LAST_NAMES = [
  "Martin",
  "Costa",
  "Wilson",
  "Kim",
  "Silva",
  "Brown",
  "Garcia",
  "Miller",
  "Taylor",
  "Lopez",
];

export async function loadPublicProfileIds(supabase) {
  const ids = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load public_profiles: ${error.message}`);

    const page = data ?? [];
    ids.push(...page.map((row) => row.id).filter(Boolean));
    if (page.length < PAGE_SIZE) break;
  }

  return [...new Set(ids)];
}

async function loadAuthUsers(supabase) {
  const users = [];

  for (let page = 1; ; page += 1) {
    const data = await withRetry(
      `auth:list:${page}`,
      async () => {
        const { data: pageData, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: PAGE_SIZE,
        });
        if (error) throw error;
        return pageData;
      },
      { attempts: 5, baseDelayMs: 1000 },
    );

    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return users;
}

async function loadSeedAuthUsers(supabase) {
  return (await loadAuthUsers(supabase)).filter(
    (user) => user.user_metadata?.seeded_by === SEED_MARKER,
  );
}

export async function loadValidPublicProfileIds(supabase) {
  const [profileIds, authUsers] = await Promise.all([
    loadPublicProfileIds(supabase),
    loadAuthUsers(supabase),
  ]);
  const authIds = new Set(authUsers.map((user) => user.id));
  const validIds = profileIds.filter((id) => authIds.has(id));
  const orphanCount = profileIds.length - validIds.length;
  if (orphanCount > 0) {
    log(
      "users",
      `Ignoring ${orphanCount} public profile(s) without matching auth.users rows`,
    );
  }
  return validIds;
}

function profileFromAuthUser(user, index) {
  const token = user.user_metadata?.seed_token ?? user.id.replace(/-/g, "");
  return {
    id: user.id,
    email: user.email,
    first_name:
      user.user_metadata?.first_name ?? FIRST_NAMES[index % FIRST_NAMES.length],
    last_name:
      user.user_metadata?.last_name ??
      LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length],
    username: user.user_metadata?.username ?? `seed_${token.slice(0, 20)}`,
    is_verified: false,
  };
}

async function ensureProfiles(supabase, users, existingProfileIds) {
  const existing = new Set(existingProfileIds);
  const missing = users.filter((user) => !existing.has(user.id));
  if (!missing.length) return;

  log("users", `Creating ${missing.length} missing public profile(s)`);
  for (let offset = 0; offset < missing.length; offset += PROFILE_CHUNK_SIZE) {
    const chunk = missing
      .slice(offset, offset + PROFILE_CHUNK_SIZE)
      .map((user, index) => profileFromAuthUser(user, offset + index));
    const { error } = await supabase
      .from("profiles")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Could not create seed profiles: ${error.message}`);
  }
}

async function createSeedAuthUser(supabase, ordinal) {
  const seedToken = randomUUID().replace(/-/g, "");
  const firstName = FIRST_NAMES[ordinal % FIRST_NAMES.length];
  const lastName =
    LAST_NAMES[Math.floor(ordinal / FIRST_NAMES.length) % LAST_NAMES.length];
  const username = `seed_${seedToken.slice(0, 20)}`;
  const email = `seed-posts-${seedToken}@seed.pixap.app`;

  const data = await withRetry(
    `auth:create:${ordinal + 1}`,
    async () => {
      const { data: userData, error } = await supabase.auth.admin.createUser({
        email,
        password: `${randomUUID()}Aa1!`,
        email_confirm: true,
        user_metadata: {
          seeded_by: SEED_MARKER,
          seed_token: seedToken,
          first_name: firstName,
          last_name: lastName,
          username,
        },
      });
      if (error) throw error;
      return userData;
    },
    { attempts: 5, baseDelayMs: 1200 },
  );
  if (!data?.user) throw new Error("Supabase Auth returned no user");
  return data.user;
}

export async function ensureUsersForLikes(
  supabase,
  currentProfileIds,
  requiredCount,
  { dryRun },
) {
  if (currentProfileIds.length >= requiredCount) return currentProfileIds;

  if (dryRun) {
    const missing = requiredCount - currentProfileIds.length;
    log("users", `[dry-run] Would create ${missing} seed auth user(s) and profile(s)`);
    return [
      ...currentProfileIds,
      ...Array.from({ length: missing }, (_, index) => `dry-seed-user-${index + 1}`),
    ];
  }

  const existingSeedUsers = await loadSeedAuthUsers(supabase);
  await ensureProfiles(supabase, existingSeedUsers, currentProfileIds);

  let profileIds = await loadValidPublicProfileIds(supabase);
  const missingCount = Math.max(0, requiredCount - profileIds.length);
  if (!missingCount) return profileIds;

  log("users", `Creating ${missingCount} seed auth user(s)`);
  const createdUsers = [];
  for (let index = 0; index < missingCount; index += 1) {
    createdUsers.push(
      await createSeedAuthUser(supabase, existingSeedUsers.length + index),
    );
    if ((index + 1) % 25 === 0 || index + 1 === missingCount) {
      log("users", `Created ${index + 1}/${missingCount} auth user(s)`);
    }
    if (index + 1 < missingCount) await sleep(CREATE_DELAY_MS);
  }

  await ensureProfiles(supabase, createdUsers, profileIds);
  profileIds = await loadValidPublicProfileIds(supabase);
  if (profileIds.length < requiredCount) {
    throw new Error(
      `Created users, but only ${profileIds.length}/${requiredCount} public profiles are available`,
    );
  }

  return profileIds;
}
