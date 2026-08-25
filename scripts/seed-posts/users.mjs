import { randomInt, randomUUID } from "node:crypto";
import { log, sleep, withRetry } from "./lib.mjs";

const PAGE_SIZE = 1000;
const PROFILE_CHUNK_SIZE = 100;
const CREATE_DELAY_MS = 80;
const SEED_MARKER = "seed-posts";

/** Common given names across US/UK, LatAm, Europe, CIS, MENA, East/SE Asia, etc. */
const FIRST_NAMES = [
  // English / US / UK / AU
  "James", "Olivia", "Liam", "Emma", "Noah", "Ava", "Oliver", "Sophia", "Elijah", "Isabella",
  "William", "Mia", "Henry", "Charlotte", "Lucas", "Amelia", "Benjamin", "Harper", "Jack", "Evelyn",
  "Alexander", "Abigail", "Daniel", "Emily", "Michael", "Elizabeth", "David", "Sofia", "Joseph", "Ella",
  // Spanish / LatAm / Portuguese
  "Santiago", "Valentina", "Mateo", "Camila", "Sebastian", "Lucia", "Diego", "Martina", "Nicolas", "Catalina",
  "Joao", "Maria", "Pedro", "Ana", "Gabriel", "Beatriz", "Rafael", "Julia", "Thiago", "Larissa",
  "Carlos", "Fernanda", "Miguel", "Isabela", "Andres", "Paula", "Luis", "Gabriela", "Javier", "Carmen",
  // French / Italian / German / Dutch / Nordic
  "Hugo", "Chloe", "Louis", "Manon", "Arthur", "Lea", "Theo", "Ines", "Nathan", "Camille",
  "Marco", "Giulia", "Francesco", "Chiara", "Alessandro", "Sofia", "Leonardo", "Alice", "Matteo", "Emma",
  "Lukas", "Mia", "Leon", "Hannah", "Finn", "Emilia", "Paul", "Lina", "Jonas", "Marie",
  "Daan", "Noor", "Sem", "Saar", "Lars", "Eva", "Bram", "Fleur", "Sven", "Freja",
  "Erik", "Astrid", "Oskar", "Ingrid", "Nils", "Saga", "Bjorn", "Maja", "Anders", "Elsa",
  // Russian / Ukrainian / Kazakh / CIS
  "Ivan", "Anastasia", "Dmitry", "Ekaterina", "Alexey", "Olga", "Sergey", "Natalia", "Andrey", "Maria",
  "Nikita", "Daria", "Maxim", "Polina", "Kirill", "Alina", "Artem", "Yulia", "Roman", "Sofia",
  "Vladimir", "Irina", "Pavel", "Tatiana", "Igor", "Elena", "Denis", "Victoria", "Oleg", "Anna",
  "Nurzhan", "Aigerim", "Dias", "Aizhan", "Alikhan", "Madina", "Yerasyl", "Dana", "Arman", "Asel",
  "Oleksandr", "Oksana", "Andriy", "Yuliya", "Bohdan", "Kateryna", "Taras", "Iryna", "Maksym", "Sofiya",
  // Turkish / Arabic / Persian / Hebrew
  "Emre", "Elif", "Mehmet", "Zeynep", "Can", "Ayşe", "Burak", "Defne", "Yusuf", "Ece",
  "Omar", "Layla", "Youssef", "Sara", "Adam", "Nour", "Karim", "Maya", "Hassan", "Amira",
  "Reza", "Zahra", "Amir", "Fatemeh", "Ali", "Parisa", "Hossein", "Leila", "Sina", "Niloofar",
  "Noam", "Yael", "Avi", "Tamar", "Ido", "Shira", "Eitan", "Maya", "Yonatan", "Rivka",
  // East / SE Asia / South Asia / Japan / Korea
  "Wei", "Mei", "Jun", "Yuna", "Hao", "Ling", "Chen", "Xia", "Kai", "Hana",
  "Hiroshi", "Yui", "Kenji", "Sakura", "Ryo", "Aoi", "Haruto", "Hina", "Sota", "Mio",
  "Minjun", "Seo-yeon", "Joon", "Ji-woo", "Hyun", "Soo-jin", "Donghyun", "Yuna", "Seung", "Hyejin",
  "Arjun", "Priya", "Rahul", "Ananya", "Vikram", "Isha", "Aarav", "Diya", "Rohan", "Sneha",
  "Nguyen", "Linh", "Minh", "Anh", "Duc", "Trang", "Hung", "Mai", "Quan", "Thao",
  // African / Caribbean common diaspora names
  "Kwame", "Amina", "Chinedu", "Fatou", "Kofi", "Nia", "Ade", "Zainab", "Tunde", "Aisha",
  "Jamal", "Keisha", "Andre", "Simone", "Malik", "Imani", "Darius", "Amara", "Marcus", "Zuri",
];

const LAST_NAMES = [
  // English / US / UK
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Anderson", "Taylor",
  "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis",
  "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Adams",
  // Spanish / Portuguese / LatAm
  "Garcia", "Rodriguez", "Martinez", "Lopez", "Hernandez", "Gonzalez", "Perez", "Sanchez", "Ramirez", "Torres",
  "Flores", "Rivera", "Gomez", "Diaz", "Reyes", "Morales", "Cruz", "Ortiz", "Silva", "Santos",
  "Oliveira", "Souza", "Costa", "Pereira", "Almeida", "Ferreira", "Carvalho", "Ribeiro", "Lima", "Araujo",
  // French / Italian / German / Dutch / Nordic
  "Bernard", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre", "Garcia", "David", "Bertrand",
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco",
  "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch",
  "De Vries", "Jansen", "Bakker", "Visser", "Smit", "Meijer", "De Boer", "Mulder", "De Groot", "Bos",
  "Johansson", "Andersson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson",
  "Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Pedersen", "Nilsen", "Kristiansen", "Jensen", "Berg",
  // Slavic / CIS / Kazakh
  "Ivanov", "Smirnov", "Kuznetsov", "Popov", "Vasiliev", "Petrov", "Sokolov", "Mikhailov", "Novikov", "Fedorov",
  "Morozov", "Volkov", "Alekseev", "Lebedev", "Semenov", "Egorov", "Pavlov", "Kozlov", "Stepanov", "Nikolaev",
  "Shevchenko", "Kovalenko", "Bondarenko", "Tkachenko", "Kravchenko", "Melnyk", "Boyko", "Savchenko", "Rudenko", "Lysenko",
  "Nazarov", "Suleimenov", "Omarov", "Abdrakhmanov", "Kim", "Lee", "Park", "Choi", "Nurpeisov", "Akhmetov",
  // Turkish / Arabic / Persian / Hebrew
  "Yilmaz", "Kaya", "Demir", "Celik", "Sahin", "Yildiz", "Yildirim", "Ozturk", "Aydin", "Ozdemir",
  "Hassan", "Ahmed", "Ali", "Khan", "Hussein", "Ibrahim", "Rahman", "Abbas", "Farouk", "Nasser",
  "Mohammadi", "Hosseini", "Ahmadi", "Karimi", "Mousavi", "Rezaei", "Jafari", "Moradi", "Hashemi", "Sadeghi",
  "Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Friedman", "Katz", "Ben-David", "Azoulay", "Gabay",
  // East / SE / South Asia
  "Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou",
  "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato",
  "Kim", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han",
  "Patel", "Sharma", "Singh", "Kumar", "Gupta", "Shah", "Mehta", "Reddy", "Nair", "Iyer",
  "Nguyen", "Tran", "Le", "Pham", "Hoang", "Huynh", "Vu", "Vo", "Dang", "Bui",
  // African / Caribbean diaspora
  "Okonkwo", "Okafor", "Adeyemi", "Mensah", "Boateng", "Diallo", "Traore", "Camara", "Nkosi", "Dlamini",
  "Williams", "Brown", "Campbell", "Stewart", "Reid", "Grant", "Baptiste", "Jean", "Pierre", "Joseph",
];

function pickName(list) {
  return list[randomInt(list.length)];
}

function randomPersonName() {
  return {
    firstName: pickName(FIRST_NAMES),
    lastName: pickName(LAST_NAMES),
  };
}

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

function profileFromAuthUser(user) {
  const token = user.user_metadata?.seed_token ?? user.id.replace(/-/g, "");
  const fallback = randomPersonName();
  return {
    id: user.id,
    email: user.email,
    first_name: user.user_metadata?.first_name ?? fallback.firstName,
    last_name: user.user_metadata?.last_name ?? fallback.lastName,
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
      .map((user) => profileFromAuthUser(user));
    const { error } = await supabase
      .from("profiles")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Could not create seed profiles: ${error.message}`);
  }
}

async function createSeedAuthUser(supabase, ordinal) {
  const seedToken = randomUUID().replace(/-/g, "");
  const { firstName, lastName } = randomPersonName();
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
