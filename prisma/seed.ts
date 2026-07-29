import bcrypt from "bcryptjs";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";
import { Role, UserStatus } from "../generated/prisma/enums";

const SEED_PASSWORD = "Password123";

type ProviderKey = "summit" | "riverbend";

type SeedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status?: UserStatus;
  providerKey?: ProviderKey;
};

const USERS: SeedUser[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "GearUp Admin",
    email: "admin@gearup.com",
    phone: "+8801700000001",
    role: "ADMIN",
  },
  {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Summit Outdoor Rentals",
    email: "provider1@gearup.com",
    phone: "+8801700000011",
    role: "PROVIDER",
    providerKey: "summit",
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "Riverbend Water Sports",
    email: "provider2@gearup.com",
    phone: "+8801700000012",
    role: "PROVIDER",
    providerKey: "riverbend",
  },
  {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Abdullah Mamun",
    email: "customer1@gearup.com",
    phone: "+8801700000021",
    role: "CUSTOMER",
  },
  {
    id: "c0000000-0000-4000-8000-000000000002",
    name: "Nusrat Jahan",
    email: "customer2@gearup.com",
    phone: "+8801700000022",
    role: "CUSTOMER",
  },
  {
    id: "c0000000-0000-4000-8000-000000000003",
    name: "Rakib Hasan",
    email: "customer3@gearup.com",
    phone: "+8801700000023",
    role: "CUSTOMER",
    status: "SUSPENDED",
  },
];

const CATEGORIES = [
  {
    key: "camping",
    name: "Camping",
    description:
      "Tents, sleeping bags, camp stoves and everything for a night under the stars.",
  },
  {
    key: "water",
    name: "Water Sports",
    description:
      "Kayaks, paddleboards, life jackets and gear for lakes, rivers and coast.",
  },
  {
    key: "cycling",
    name: "Cycling",
    description:
      "Mountain, road and city bikes plus helmets, racks and repair kits.",
  },
  {
    key: "hiking",
    name: "Hiking & Trekking",
    description:
      "Backpacks, trekking poles, navigation and footwear for long days out.",
  },
  {
    key: "climbing",
    name: "Climbing",
    description: "Harnesses, ropes, helmets and protection for crag and gym.",
  },
  {
    key: "team",
    name: "Team Sports",
    description:
      "Cricket, football and badminton kit for matches and practice.",
  },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

type SeedGear = {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: CategoryKey;
  provider: ProviderKey;
  pricePerDay: number;
  stock: number;
  isAvailable?: boolean;
  imageUrl: string;
};

const GEAR: SeedGear[] = [
  {
    id: "11111111-0000-4000-8000-000000000001",
    name: "4-Person Dome Tent",
    description:
      "Waterproof dome tent with a full rainfly and taped seams. Pitches in under ten minutes, sleeps four comfortably.",
    brand: "Coleman",
    category: "camping",
    provider: "summit",
    pricePerDay: 450,
    stock: 6,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Dome_tent_in_the_BWCA_%28CDM11452CT%29.jpg/960px-Dome_tent_in_the_BWCA_%28CDM11452CT%29.jpg",
  },
  {
    id: "11111111-0000-4000-8000-000000000002",
    name: "2-Person Backpacking Tent",
    description:
      "Lightweight 2.1kg tent for trekking. Freestanding, double-wall, with two vestibules for packs.",
    brand: "MSR",
    category: "camping",
    provider: "summit",
    pricePerDay: 520,
    stock: 4,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/J32_553_Supetar%2C_Zeltplatz_%C2%BBWaterman_Beach_Village%C2%AB.jpg/960px-J32_553_Supetar%2C_Zeltplatz_%C2%BBWaterman_Beach_Village%C2%AB.jpg",
  },
  {
    id: "11111111-0000-4000-8000-000000000003",
    name: "Sleeping Bag (-5°C)",
    description:
      "Mummy-cut synthetic bag rated to -5°C. Packs to 20L, includes a compression sack.",
    brand: "Deuter",
    category: "camping",
    provider: "summit",
    pricePerDay: 180,
    stock: 12,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Nomad%2C_OutDoor_2018%2C_Friedrichshafen_%281X7A0320%29.jpg/960px-Nomad%2C_OutDoor_2018%2C_Friedrichshafen_%281X7A0320%29.jpg",
  },
  {
    id: "11111111-0000-4000-8000-000000000004",
    name: "Portable Camp Stove",
    description:
      "Twin-burner propane stove with wind guards. Boils a litre in about four minutes. Gas not included.",
    brand: "Jetboil",
    category: "camping",
    provider: "summit",
    pricePerDay: 220,
    stock: 8,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Hobo_stove_convection_2.jpg/960px-Hobo_stove_convection_2.jpg",
  },
  {
    id: "11111111-0000-4000-8000-000000000005",
    name: "Camping Lantern Set",
    description:
      "Pair of rechargeable LED lanterns, 1000 lumens each, with a 20-hour runtime on low.",
    brand: "Black Diamond",
    category: "camping",
    provider: "summit",
    pricePerDay: 120,
    stock: 15,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Petromax_in_the_dark.jpg/960px-Petromax_in_the_dark.jpg",
  },

  {
    id: "22222222-0000-4000-8000-000000000001",
    name: "Single Sit-on-Top Kayak",
    description:
      "Stable 3m recreational kayak for flat water. Comes with paddle, seat pad and dry bag.",
    brand: "Perception",
    category: "water",
    provider: "riverbend",
    pricePerDay: 1200,
    stock: 5,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/2015-08_playboating_Durance_09.jpg/960px-2015-08_playboating_Durance_09.jpg",
  },
  {
    id: "22222222-0000-4000-8000-000000000002",
    name: "Inflatable Paddleboard",
    description:
      "10'6\" all-round iSUP with pump, adjustable paddle, leash and backpack. Holds up to 130kg.",
    brand: "Red Paddle Co",
    category: "water",
    provider: "riverbend",
    pricePerDay: 950,
    stock: 6,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Stand_Up_Paddle_in_Rameswaram.jpg/960px-Stand_Up_Paddle_in_Rameswaram.jpg",
  },
  {
    id: "22222222-0000-4000-8000-000000000003",
    name: "Life Jacket (Adult)",
    description:
      "CE-approved buoyancy aid, 50N, with adjustable side straps. Available in M, L and XL.",
    brand: "Palm",
    category: "water",
    provider: "riverbend",
    pricePerDay: 90,
    stock: 20,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Yellow_orange_life_jackets_american_river.jpg/960px-Yellow_orange_life_jackets_american_river.jpg",
  },
  {
    id: "22222222-0000-4000-8000-000000000004",
    name: "Snorkelling Set",
    description:
      "Tempered-glass mask, dry-top snorkel and adjustable fins. Rinsed and sanitised between rentals.",
    brand: "Cressi",
    category: "water",
    provider: "riverbend",
    pricePerDay: 150,
    stock: 10,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/0/02/Atac_military_USAF_spec_ops_scuba_diving_rocket_fins_diving_mask_boots_and_snorkel_480x.png",
  },

  {
    id: "33333333-0000-4000-8000-000000000001",
    name: "Hardtail Mountain Bike",
    description:
      "29er hardtail with 120mm air fork and hydraulic discs. Sizes M and L, helmet included.",
    brand: "Trek",
    category: "cycling",
    provider: "riverbend",
    pricePerDay: 800,
    stock: 7,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Cube%2C_Cyclingworld_Europe_2024%2C_Meerbusch_%28P1180003%29.jpg/960px-Cube%2C_Cyclingworld_Europe_2024%2C_Meerbusch_%28P1180003%29.jpg",
  },
  {
    id: "33333333-0000-4000-8000-000000000002",
    name: "Road Bike (Carbon)",
    description:
      "Carbon endurance frame, 22-speed groupset, 8.2kg. Pedals and computer mount included.",
    brand: "Giant",
    category: "cycling",
    provider: "riverbend",
    pricePerDay: 1100,
    stock: 3,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/2011_GT_GTR_SERIES_4.0_Tx-re.JPG/960px-2011_GT_GTR_SERIES_4.0_Tx-re.JPG",
  },
  {
    id: "33333333-0000-4000-8000-000000000003",
    name: "City Commuter Bike",
    description:
      "Step-through 7-speed with mudguards, rack and integrated lights. Ideal for town riding.",
    brand: "Btwin",
    category: "cycling",
    provider: "riverbend",
    pricePerDay: 400,
    stock: 10,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Azor_Oma_Oklahoma_R3D_Violet_Matt.jpg/960px-Azor_Oma_Oklahoma_R3D_Violet_Matt.jpg",
  },
  {
    id: "33333333-0000-4000-8000-000000000004",
    name: "Bike Roof Rack (2 bikes)",
    description:
      "Lockable roof-mounted carrier for two bikes, with fitting kit for most crossbars.",
    brand: "Thule",
    category: "cycling",
    provider: "riverbend",
    pricePerDay: 350,
    stock: 4,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Bike_roof_carrier.jpg/960px-Bike_roof_carrier.jpg",
  },

  {
    id: "44444444-0000-4000-8000-000000000001",
    name: "65L Trekking Backpack",
    description:
      "Adjustable-back 65L pack with rain cover and hip-belt pockets. Carries 20kg comfortably.",
    brand: "Osprey",
    category: "hiking",
    provider: "summit",
    pricePerDay: 250,
    stock: 9,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Quechua_backpack_-_A.jpg/960px-Quechua_backpack_-_A.jpg",
  },
  {
    id: "44444444-0000-4000-8000-000000000002",
    name: "Carbon Trekking Poles",
    description:
      "Pair of folding carbon poles, 110-130cm, with cork grips and spare tips.",
    brand: "Leki",
    category: "hiking",
    provider: "summit",
    pricePerDay: 130,
    stock: 14,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Aconcagua_Argentina_2015.jpg/960px-Aconcagua_Argentina_2015.jpg",
  },
  {
    id: "44444444-0000-4000-8000-000000000003",
    name: "GPS Handheld Navigator",
    description:
      "Rugged handheld GPS with topo maps preloaded, 16-hour battery and IPX7 waterproofing.",
    brand: "Garmin",
    category: "hiking",
    provider: "summit",
    pricePerDay: 300,
    stock: 5,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Magellan_Triton_2000_handheld_GPS_receiver_02.jpg/960px-Magellan_Triton_2000_handheld_GPS_receiver_02.jpg",
  },
  {
    id: "44444444-0000-4000-8000-000000000004",
    name: "Insulated Day Pack (30L)",
    description:
      "30L pack with a hydration sleeve and insulated compartment. Good for long day walks.",
    brand: "Deuter",
    category: "hiking",
    provider: "summit",
    pricePerDay: 160,
    stock: 11,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Quechua_backpack_-_B.jpg/960px-Quechua_backpack_-_B.jpg",
  },

  {
    id: "55555555-0000-4000-8000-000000000001",
    name: "Climbing Harness",
    description:
      "Adjustable-leg sport harness with four gear loops. Inspected before every rental.",
    brand: "Petzl",
    category: "climbing",
    provider: "summit",
    pricePerDay: 140,
    stock: 12,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/OutDoor_2018%2C_Friedrichshafen_%281X7A9940%29.jpg/960px-OutDoor_2018%2C_Friedrichshafen_%281X7A9940%29.jpg",
  },
  {
    id: "55555555-0000-4000-8000-000000000002",
    name: "Dynamic Rope 60m",
    description:
      "9.8mm single dynamic rope, 60m, dry-treated. Logged usage history available on request.",
    brand: "Mammut",
    category: "climbing",
    provider: "summit",
    pricePerDay: 380,
    stock: 4,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Knoten_002_2024_02_20.jpg/960px-Knoten_002_2024_02_20.jpg",
  },
  {
    id: "55555555-0000-4000-8000-000000000003",
    name: "Climbing Helmet",
    description:
      "Lightweight hybrid-shell helmet with headlamp clips. One size, adjustable 53-61cm.",
    brand: "Black Diamond",
    category: "climbing",
    provider: "summit",
    pricePerDay: 100,
    stock: 16,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Climber_with_the_rock_climbing_equipment_on_mountain.jpg/960px-Climber_with_the_rock_climbing_equipment_on_mountain.jpg",
  },

  {
    id: "66666666-0000-4000-8000-000000000001",
    name: "Full Cricket Kit",
    description:
      "Bat, pads, gloves, helmet and kit bag. Senior size, suitable for club-level play.",
    brand: "SG",
    category: "team",
    provider: "riverbend",
    pricePerDay: 500,
    stock: 6,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Cricket_equipment_at_Sandwich_Town_CC_in_Sandwich%2C_Kent%2C_England.jpg/960px-Cricket_equipment_at_Sandwich_Town_CC_in_Sandwich%2C_Kent%2C_England.jpg",
  },
  {
    id: "66666666-0000-4000-8000-000000000002",
    name: "Football Training Set",
    description:
      "Five match balls, twenty cones, four agility poles and a portable pump.",
    brand: "Adidas",
    category: "team",
    provider: "riverbend",
    pricePerDay: 300,
    stock: 8,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Foot_n%27ball.jpg/960px-Foot_n%27ball.jpg",
  },
  {
    id: "66666666-0000-4000-8000-000000000003",
    name: "Badminton Set (4 player)",
    description:
      "Four graphite rackets, net with poles and a tube of feather shuttles.",
    brand: "Yonex",
    category: "team",
    provider: "riverbend",
    pricePerDay: 260,
    stock: 7,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Recordage_badminton.JPG/960px-Recordage_badminton.JPG",
  },
  {
    id: "66666666-0000-4000-8000-000000000004",
    name: "Portable Basketball Hoop",
    description:
      "Height-adjustable 2.3-3.05m hoop with a weighted base. Assembly included on delivery.",
    brand: "Spalding",
    category: "team",
    provider: "riverbend",
    pricePerDay: 420,
    stock: 3,
    isAvailable: false,
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/-Nowa_Huta_Public_Backboard-_%2831775258568%29.jpg/960px--Nowa_Huta_Public_Backboard-_%2831775258568%29.jpg",
  },
];

/**
 * Drops accounts that aren't part of the seed, so re-running gives the same
 * six users every time. Refuses to touch anyone with real activity attached —
 * rental orders, reviews and payments are not seeded, so their presence means
 * someone was genuinely using the account.
 */
async function removeUnseededUsers(seedEmails: string[]) {
  const strangers = await prisma.user.findMany({
    where: { email: { notIn: seedEmails } },
    select: {
      id: true,
      email: true,
      role: true,
      _count: {
        select: {
          gearItems: true,
          rentalOrders: true,
          reviews: true,
          payments: true,
        },
      },
    },
  });

  if (strangers.length === 0) {
    console.log("No unseeded users to remove.");
    return;
  }

  const active = strangers.filter(
    (user) =>
      user._count.rentalOrders > 0 ||
      user._count.reviews > 0 ||
      user._count.payments > 0,
  );

  if (active.length > 0) {
    throw new Error(
      `Refusing to delete users with rental history: ${active
        .map((user) => user.email)
        .join(", ")}. Remove their orders first if you really want them gone.`,
    );
  }

  const cascadedGear = strangers.reduce(
    (total, user) => total + user._count.gearItems,
    0,
  );

  await prisma.user.deleteMany({
    where: { id: { in: strangers.map((user) => user.id) } },
  });

  console.log(
    `Removed ${strangers.length} unseeded user(s): ${strangers
      .map((user) => `${user.email} (${user.role})`)
      .join(", ")}` +
      (cascadedGear > 0
        ? ` — ${cascadedGear} of their gear item(s) cascaded away.`
        : ""),
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(
    SEED_PASSWORD,
    Number(config.bcrypt_salt_rounds) || 10,
  );

  const providerIds = new Map<ProviderKey, string>();

  for (const user of USERS) {
    const fields = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status ?? "ACTIVE",
      passwordHash,
    };

    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: fields,
      create: { id: user.id, ...fields },
      select: { id: true },
    });

    if (user.providerKey) {
      providerIds.set(user.providerKey, row.id);
    }
  }
  console.log(`Seeded ${USERS.length} users (password: ${SEED_PASSWORD}).`);

  await removeUnseededUsers(USERS.map((user) => user.email));

  const categoryIds = new Map<CategoryKey, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: { name: category.name, description: category.description },
      select: { id: true },
    });
    categoryIds.set(category.key, row.id);
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);

  for (const gear of GEAR) {
    const categoryId = categoryIds.get(gear.category);
    if (!categoryId) {
      throw new Error(`Unknown category key "${gear.category}"`);
    }

    const providerId = providerIds.get(gear.provider);
    if (!providerId) {
      throw new Error(`Unknown provider key "${gear.provider}"`);
    }

    const fields = {
      name: gear.name,
      description: gear.description,
      brand: gear.brand,
      imageUrl: gear.imageUrl,
      pricePerDay: gear.pricePerDay,
      stock: gear.stock,
      isAvailable: gear.isAvailable ?? true,
      categoryId,
      providerId,
    };

    await prisma.gearItem.upsert({
      where: { id: gear.id },
      update: fields,
      create: { id: gear.id, ...fields },
    });
  }
  console.log(`Seeded ${GEAR.length} gear items across 2 providers.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
