/**
 * Demo data for local development: `npm run db:seed`.
 *
 * Safe to re-run. Every record has a stable id (or a unique key) and is
 * upserted with an empty `update`, so existing rows — including real accounts
 * that share a demo email — are never modified. Nothing is deleted. The only
 * writes to existing rows fill fields that are still empty (a profile's city,
 * featured gear when nothing is featured yet).
 *
 * `stock` is the number of units a provider owns. Availability for any dates
 * is computed from overlapping bookings, so seeded orders don't touch it; the
 * generated history is checked so no day ever has more units out than owned.
 *
 * With GEMINI_API_KEY set, the last step asks the AI for review summaries of
 * items with 3+ reviews. Without it they appear later (daily cron, or after
 * the next review).
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";
import { aiService } from "../src/modules/ai/ai.service";
import {
  CancelReason,
  ContactStatus,
  DepositStatus,
  Locale,
  PaymentStatus,
  RentalStatus,
  Role,
} from "../generated/prisma/enums";

const PASSWORD = "Password123";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Deterministic RFC 4122 v4-shaped uuid, so `z.uuid()` accepts seeded ids. */
const seedId = (key: string) => {
  const hex = createHash("sha256").update(`gearup-seed:${key}`).digest("hex");
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
};

/** Deterministic 64-char token (subscriber links). */
const seedToken = (key: string) =>
  createHash("sha256").update(`gearup-seed-token:${key}`).digest("hex");

/** Small seeded PRNG, so the generated history is the same on every run. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const midnightUtc = (offsetDays: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return new Date(date.getTime() + offsetDays * DAY);
};

const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// ---------------------------------------------------------------- users

/** Public profile + pickup point for the demo providers (approximate). */
const PROVIDER_PROFILES: Record<
  string,
  { city: string; area: string; latitude: number; longitude: number; bio: string }
> = {
  provider1: {
    city: "Sylhet",
    area: "Zindabazar",
    latitude: 24.8949,
    longitude: 91.8687,
    bio: "Camping and climbing kit for tea-garden treks and Ratargul trips. Everything is cleaned and checked after each rental.",
  },
  provider2: {
    city: "Cox's Bazar",
    area: "Kolatoli",
    latitude: 21.4272,
    longitude: 92.0058,
    bio: "Beach and water gear a few minutes from the sea: kayaks, boards, snorkels and beach games.",
  },
  provider3: {
    city: "Bandarban",
    area: "Bandarban Sadar",
    latitude: 22.1953,
    longitude: 92.2184,
    bio: "Hill-track trekking specialists. Tents, packs and stoves for Nilgiri, Keokradong and beyond.",
  },
  provider4: {
    city: "Dhaka",
    area: "Gulshan",
    latitude: 23.7925,
    longitude: 90.4078,
    bio: "Team sports and cycling gear for weekend matches and city rides. Pickup near Gulshan 1.",
  },
};

type SeedUser = {
  key: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  /** Account age, so sign-up charts and order history line up. */
  joinedDaysAgo: number;
  city?: string;
  locale?: Locale;
};

const USERS: SeedUser[] = [
  { key: "admin", name: "GearUp Admin", email: "admin@gearup.com", role: Role.ADMIN, joinedDaysAgo: 380 },
  { key: "provider1", name: "Trail Base Sylhet", email: "provider1@gearup.com", role: Role.PROVIDER, phone: "+8801700000001", joinedDaysAgo: 370 },
  { key: "provider2", name: "Bay Adventures", email: "provider2@gearup.com", role: Role.PROVIDER, phone: "+8801700000002", joinedDaysAgo: 365 },
  { key: "provider3", name: "Hill Track Outfitters", email: "provider3@gearup.com", role: Role.PROVIDER, phone: "+8801700000003", joinedDaysAgo: 362 },
  { key: "provider4", name: "Dhaka Sports Hub", email: "provider4@gearup.com", role: Role.PROVIDER, phone: "+8801700000004", joinedDaysAgo: 360 },
  { key: "customer1", name: "Ayesha Rahman", email: "customer1@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 330, city: "Dhaka" },
  { key: "customer2", name: "Tanvir Hasan", email: "customer2@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 320, city: "Chattogram" },
  { key: "customer3", name: "Nusrat Jahan", email: "customer3@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 300, city: "Sylhet" },
  { key: "customer4", name: "Rafiq Islam", email: "customer4@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 280, city: "Dhaka" },
  { key: "customer5", name: "Sadia Akter", email: "customer5@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 250, city: "Khulna" },
  { key: "customer6", name: "Imran Hossain", email: "customer6@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 220, city: "Dhaka" },
  { key: "customer7", name: "Farhana Kabir", email: "customer7@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 190, city: "Chattogram", locale: Locale.bn },
  { key: "customer8", name: "Shakib Ahmed", email: "customer8@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 160, city: "Sylhet" },
  { key: "customer9", name: "Mitu Das", email: "customer9@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 130, city: "Rajshahi" },
  { key: "customer10", name: "Arif Chowdhury", email: "customer10@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 100, city: "Dhaka", locale: Locale.bn },
  { key: "customer11", name: "Lamia Sultana", email: "customer11@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 70, city: "Cumilla" },
  { key: "customer12", name: "Mahmudul Karim", email: "customer12@gearup.com", role: Role.CUSTOMER, joinedDaysAgo: 40, city: "Cox's Bazar" },
];

const joinedDaysAgo = new Map(USERS.map((user) => [user.key, user.joinedDaysAgo]));

// ----------------------------------------------------------- categories
// Names match `categoryIcon()` in the frontend (lib/categoryIcons.ts).

const CATEGORIES = [
  { name: "Camping", description: "Tents, sleeping bags, stoves and everything for a night under the stars." },
  { name: "Water Sports", description: "Kayaks, paddle boards, life jackets and snorkel kits." },
  { name: "Cycling", description: "Mountain bikes, road bikes, helmets and bike racks." },
  { name: "Hiking & Trekking", description: "Backpacks, trekking poles, boots and navigation gear." },
  { name: "Climbing", description: "Harnesses, ropes, helmets and bouldering pads." },
  { name: "Team Sports", description: "Football, cricket, badminton and volleyball kits for the whole squad." },
];

// ----------------------------------------------------------------- gear

type SeedGear = {
  key: string;
  name: string;
  brand: string;
  category: string;
  provider: string;
  pricePerDay: number;
  owned: number;
  images: string[];
  description: string;
};

/** Refundable deposit per unit for the pricier items; the rest have none. */
const DEPOSITS: Record<string, number> = {
  "tent-4p": 1000,
  "kayak-single": 2000,
  "kayak-tandem": 3000,
  sup: 2000,
  surfboard: 1500,
  mtb: 2000,
  "road-bike": 2500,
  ebike: 3000,
  gps: 1500,
  rope: 1000,
  "bike-rack": 1000,
};

const GEAR: SeedGear[] = [
  // Camping
  { key: "tent-2p", name: "2-Person Dome Tent", brand: "Naturehike", category: "Camping", provider: "provider1", pricePerDay: 450, owned: 4, images: ["1504280390367-361c6d9f38f4", "1478131143081-80f7f84ca84d"], description: "Lightweight double-wall dome tent with rain fly. Pitches in under 10 minutes and packs to 2.1 kg." },
  { key: "tent-4p", name: "4-Person Family Tent", brand: "Coleman", category: "Camping", provider: "provider3", pricePerDay: 750, owned: 3, images: ["1487730116645-74489c95b41b", "1523987355523-c7b5b0dd90a7"], description: "Roomy family tent with a front porch, two doors and a fully taped floor for monsoon nights." },
  { key: "sleeping-bag", name: "3-Season Sleeping Bag", brand: "Decathlon Forclaz", category: "Camping", provider: "provider1", pricePerDay: 200, owned: 6, images: ["1510312305653-8ed496efae75"], description: "Comfort-rated to 5 °C. Washed and aired after every rental." },
  { key: "camp-stove", name: "Portable Gas Stove Kit", brand: "Fire-Maple", category: "Camping", provider: "provider3", pricePerDay: 180, owned: 5, images: ["1523987355523-c7b5b0dd90a7"], description: "Compact canister stove with a 1 L pot, windshield and lighter. Gas canister not included." },
  { key: "hammock", name: "Camping Hammock with Bug Net", brand: "Naturehike", category: "Camping", provider: "provider2", pricePerDay: 150, owned: 4, images: ["1478131143081-80f7f84ca84d"], description: "Parachute-nylon hammock with integrated mosquito net and tree straps." },
  { key: "camp-chairs", name: "Folding Camp Chair (pair)", brand: "Helinox", category: "Camping", provider: "provider4", pricePerDay: 220, owned: 3, images: ["1510312305653-8ed496efae75"], description: "Two ultralight folding chairs that pack smaller than a water bottle." },
  { key: "lantern", name: "Rechargeable LED Lantern", brand: "Black Diamond", category: "Camping", provider: "provider1", pricePerDay: 120, owned: 6, images: ["1504280390367-361c6d9f38f4"], description: "USB-rechargeable lantern, 300 lumens, 20 hours on low." },
  { key: "cooler", name: "45 L Hard Cooler Box", brand: "Igloo", category: "Camping", provider: "provider2", pricePerDay: 250, owned: 2, images: ["1487730116645-74489c95b41b"], description: "Keeps ice for two days. Ideal for beach camps and long drives." },

  // Water sports
  { key: "kayak-single", name: "Sit-on-Top Kayak (single)", brand: "Pelican", category: "Water Sports", provider: "provider2", pricePerDay: 1200, owned: 3, images: ["1530866495561-507c9faab2ed", "1544551763-46a013bb70d5"], description: "Stable sit-on-top kayak with paddle and life jacket included. Great for Cox's Bazar lagoons." },
  { key: "kayak-tandem", name: "Tandem Kayak", brand: "Lifetime", category: "Water Sports", provider: "provider2", pricePerDay: 1800, owned: 2, images: ["1544551763-46a013bb70d5"], description: "Two-seat kayak with two paddles and two life jackets." },
  { key: "sup", name: "Inflatable Stand-Up Paddle Board", brand: "iRocker", category: "Water Sports", provider: "provider2", pricePerDay: 1000, owned: 3, images: ["1502680390469-be75c86b636f"], description: "10'6\" inflatable board with pump, paddle, leash and backpack." },
  { key: "surfboard", name: "Soft-Top Surfboard 8ft", brand: "Wavestorm", category: "Water Sports", provider: "provider2", pricePerDay: 900, owned: 2, images: ["1502680390469-be75c86b636f"], description: "Forgiving foam board for beginners, with leash and fins." },
  { key: "snorkel", name: "Snorkel & Mask Set", brand: "Cressi", category: "Water Sports", provider: "provider1", pricePerDay: 200, owned: 6, images: ["1544551763-46a013bb70d5"], description: "Tempered-glass mask, dry-top snorkel and adjustable fins. Sanitised after each use." },
  { key: "life-jacket", name: "Adult Life Jacket", brand: "Stohlquist", category: "Water Sports", provider: "provider3", pricePerDay: 150, owned: 8, images: ["1530866495561-507c9faab2ed"], description: "Coast-guard approved buoyancy aid, sizes S–XL." },
  { key: "dry-bag", name: "20 L Dry Bag", brand: "Sea to Summit", category: "Water Sports", provider: "provider3", pricePerDay: 80, owned: 8, images: ["1544551763-46a013bb70d5"], description: "Roll-top waterproof bag for phones, wallets and spare clothes." },
  { key: "wetsuit", name: "3 mm Shorty Wetsuit", brand: "O'Neill", category: "Water Sports", provider: "provider2", pricePerDay: 350, owned: 4, images: ["1502680390469-be75c86b636f"], description: "Short-sleeve wetsuit for warm-water surfing and snorkelling." },

  // Cycling
  { key: "mtb", name: "Hardtail Mountain Bike", brand: "Trek Marlin 5", category: "Cycling", provider: "provider3", pricePerDay: 1100, owned: 3, images: ["1485965120184-e220f721d03e", "1532298229144-0ec0c57515c7"], description: "29\" hardtail with front suspension and hydraulic disc brakes. Helmet included." },
  { key: "road-bike", name: "Aluminium Road Bike", brand: "Giant Contend", category: "Cycling", provider: "provider4", pricePerDay: 1300, owned: 2, images: ["1507035895480-2b3156c31fc8"], description: "Endurance road bike, 16-speed Shimano Claris. Sized M and L." },
  { key: "city-bike", name: "City Commuter Bike", brand: "Duranta", category: "Cycling", provider: "provider4", pricePerDay: 400, owned: 5, images: ["1485965120184-e220f721d03e"], description: "Upright commuter with basket and lights. Perfect for exploring Dhaka early mornings." },
  { key: "ebike", name: "Electric Folding Bike", brand: "Fiido", category: "Cycling", provider: "provider4", pricePerDay: 1600, owned: 2, images: ["1532298229144-0ec0c57515c7"], description: "Folding e-bike with 50 km range. Charger included." },
  { key: "bike-helmet", name: "Cycling Helmet", brand: "Giro", category: "Cycling", provider: "provider3", pricePerDay: 100, owned: 8, images: ["1507035895480-2b3156c31fc8"], description: "MIPS helmet with adjustable fit dial. Sizes M and L." },
  { key: "bike-rack", name: "Car Roof Bike Rack", brand: "Thule", category: "Cycling", provider: "provider4", pricePerDay: 500, owned: 2, images: ["1485965120184-e220f721d03e"], description: "Carries two bikes on standard roof bars. Locks included." },
  { key: "kids-bike", name: "Kids' Bike 20\"", brand: "Btwin", category: "Cycling", provider: "provider3", pricePerDay: 300, owned: 3, images: ["1532298229144-0ec0c57515c7"], description: "Lightweight 20\" bike for ages 6–9, with training-wheel option." },
  { key: "bike-repair", name: "Trail Repair Kit", brand: "Topeak", category: "Cycling", provider: "provider1", pricePerDay: 90, owned: 5, images: ["1507035895480-2b3156c31fc8"], description: "Multi-tool, mini pump, tyre levers and patches in a saddle bag." },

  // Hiking & trekking
  { key: "backpack-50", name: "50 L Trekking Backpack", brand: "Osprey", category: "Hiking & Trekking", provider: "provider1", pricePerDay: 350, owned: 5, images: ["1551632811-561732d1e306", "1501555088652-021faa106b9b"], description: "Adjustable torso, hip-belt pockets and rain cover. Built for multi-day treks to Bandarban." },
  { key: "backpack-30", name: "30 L Day Pack", brand: "Deuter", category: "Hiking & Trekking", provider: "provider3", pricePerDay: 200, owned: 6, images: ["1501555088652-021faa106b9b"], description: "Ventilated back panel and hydration sleeve for day hikes." },
  { key: "poles", name: "Carbon Trekking Poles (pair)", brand: "Black Diamond", category: "Hiking & Trekking", provider: "provider1", pricePerDay: 150, owned: 6, images: ["1472745942893-4b9f730c7668"], description: "Collapsible carbon poles with cork grips and flick-locks." },
  { key: "boots", name: "Waterproof Hiking Boots", brand: "Salomon", category: "Hiking & Trekking", provider: "provider3", pricePerDay: 300, owned: 6, images: ["1472745942893-4b9f730c7668"], description: "Gore-Tex mid boots, EU sizes 40–45. Cleaned and deodorised after each rental." },
  { key: "gps", name: "Handheld GPS Navigator", brand: "Garmin eTrex", category: "Hiking & Trekking", provider: "provider1", pricePerDay: 500, owned: 2, images: ["1551632811-561732d1e306"], description: "Preloaded topo maps of the Chittagong Hill Tracts." },
  { key: "rain-jacket", name: "Packable Rain Jacket", brand: "The North Face", category: "Hiking & Trekking", provider: "provider3", pricePerDay: 180, owned: 6, images: ["1501555088652-021faa106b9b"], description: "Waterproof, breathable shell that packs into its own pocket." },
  { key: "headlamp", name: "Headlamp 400 lm", brand: "Petzl", category: "Hiking & Trekking", provider: "provider1", pricePerDay: 80, owned: 8, images: ["1519681393784-d120267933ba"], description: "Rechargeable headlamp with red-light mode for night treks." },
  { key: "water-filter", name: "Water Filter Bottle", brand: "LifeStraw", category: "Hiking & Trekking", provider: "provider3", pricePerDay: 120, owned: 5, images: ["1551632811-561732d1e306"], description: "Filters streams and springs on the go. New filter cartridge every 10 rentals." },

  // Climbing
  { key: "harness", name: "Climbing Harness", brand: "Petzl", category: "Climbing", provider: "provider1", pricePerDay: 250, owned: 5, images: ["1522163182402-834f871fd851"], description: "All-round harness with four gear loops, sizes S–L. Inspected after every use." },
  { key: "rope", name: "Dynamic Rope 60 m", brand: "Mammut", category: "Climbing", provider: "provider1", pricePerDay: 600, owned: 2, images: ["1464822759023-fed622ff2c3b"], description: "9.8 mm dynamic single rope with usage log available on request." },
  { key: "climb-helmet", name: "Climbing Helmet", brand: "Black Diamond", category: "Climbing", provider: "provider3", pricePerDay: 150, owned: 5, images: ["1522163182402-834f871fd851"], description: "Lightweight hard-shell helmet with headlamp clips." },
  { key: "crash-pad", name: "Bouldering Crash Pad", brand: "Metolius", category: "Climbing", provider: "provider4", pricePerDay: 450, owned: 2, images: ["1522163182402-834f871fd851"], description: "Tri-fold pad with shoulder straps for bouldering sessions." },
  { key: "climb-shoes", name: "Climbing Shoes", brand: "La Sportiva", category: "Climbing", provider: "provider4", pricePerDay: 200, owned: 6, images: ["1464822759023-fed622ff2c3b"], description: "Velcro all-rounders, EU sizes 38–44." },
  { key: "belay-kit", name: "Belay Device & Carabiner Kit", brand: "Petzl", category: "Climbing", provider: "provider1", pricePerDay: 150, owned: 4, images: ["1464822759023-fed622ff2c3b"], description: "Assisted-braking belay device with locking carabiner." },
  { key: "quickdraws", name: "Quickdraw Set (12)", brand: "DMM", category: "Climbing", provider: "provider1", pricePerDay: 400, owned: 2, images: ["1522163182402-834f871fd851"], description: "Twelve sport-climbing quickdraws on a gear sling." },
  { key: "chalk", name: "Chalk Bag with Chalk", brand: "Black Diamond", category: "Climbing", provider: "provider4", pricePerDay: 60, owned: 8, images: ["1464822759023-fed622ff2c3b"], description: "Chalk bag with brush loop and a fresh block of chalk." },

  // Team sports
  { key: "football-kit", name: "Football Match Kit", brand: "Adidas", category: "Team Sports", provider: "provider4", pricePerDay: 500, owned: 3, images: ["1517649763962-0c623066013b"], description: "Size-5 match ball, 14 bibs, cones and a pump." },
  { key: "cricket-kit", name: "Cricket Kit Bag", brand: "SG", category: "Team Sports", provider: "provider4", pricePerDay: 800, owned: 2, images: ["1526232761682-d26e03ac148e"], description: "Two bats, pads, gloves, helmet, stumps and a set of tennis balls." },
  { key: "badminton", name: "Badminton Set (4 rackets)", brand: "Yonex", category: "Team Sports", provider: "provider4", pricePerDay: 300, owned: 4, images: ["1606107557195-0e29a4b5b4aa"], description: "Four rackets, a tube of shuttles and a portable net." },
  { key: "volleyball", name: "Beach Volleyball Set", brand: "Mikasa", category: "Team Sports", provider: "provider2", pricePerDay: 400, owned: 2, images: ["1517649763962-0c623066013b"], description: "Official-size ball, net, poles and boundary lines." },
  { key: "basketball", name: "Portable Basketball Hoop", brand: "Spalding", category: "Team Sports", provider: "provider4", pricePerDay: 700, owned: 1, images: ["1526232761682-d26e03ac148e"], description: "Height-adjustable hoop with a water-fill base and ball." },
  { key: "tabletennis", name: "Table Tennis Set", brand: "Butterfly", category: "Team Sports", provider: "provider4", pricePerDay: 200, owned: 3, images: ["1534438327276-14e5300c3a48"], description: "Clip-on net, four bats and six balls." },
  { key: "frisbee", name: "Ultimate Frisbee Pack", brand: "Discraft", category: "Team Sports", provider: "provider2", pricePerDay: 120, owned: 4, images: ["1517649763962-0c623066013b"], description: "Two 175 g discs and 12 cones for a pickup game." },
  { key: "goalposts", name: "Pop-Up Goal Posts (pair)", brand: "Kickmaster", category: "Team Sports", provider: "provider4", pricePerDay: 350, owned: 2, images: ["1526232761682-d26e03ac148e"], description: "Two foldable 6 ft goals with pegs and carry bag." },
];

/** Shown on the home page. Applied only while no item is featured yet. */
const FEATURED = ["tent-2p", "kayak-single", "mtb", "sup", "backpack-50", "ebike", "harness", "tent-4p"];

// --------------------------------------------------------------- orders
// `start` is days from today. One provider per order (the item's provider).

type SeedClaim = {
  amount: number;
  note: string;
  /** Settled by an admin. Without it the claim is still open. */
  resolved?: { kept: number; note: string };
};

type SeedOrder = {
  key: string;
  customer: string;
  gear: string;
  quantity: number;
  start: number;
  days: number;
  status: RentalStatus;
  cancelReason?: CancelReason;
  review?: { rating: number; comment: string; hidden?: boolean };
  claim?: SeedClaim;
};

/** Hand-written orders: every status, the demo conversations and claims. */
const ORDERS: SeedOrder[] = [
  { key: "o1", customer: "customer1", gear: "tent-2p", quantity: 1, start: -40, days: 3, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Tent was spotless and survived a rainy night at Ratargul. Will rent again." } },
  { key: "o2", customer: "customer1", gear: "kayak-single", quantity: 1, start: -25, days: 2, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Kayak, paddle and life jacket all in great shape. Pickup was quick." } },
  { key: "o3", customer: "customer2", gear: "mtb", quantity: 1, start: -30, days: 2, status: RentalStatus.RETURNED, review: { rating: 4, comment: "Solid bike, brakes were perfect. Seat was a bit hard on day two." } },
  { key: "o4", customer: "customer2", gear: "backpack-50", quantity: 1, start: -20, days: 5, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Carried everything for a five-day Bandarban trek without a single sore shoulder." } },
  { key: "o5", customer: "customer3", gear: "sup", quantity: 1, start: -18, days: 1, status: RentalStatus.RETURNED, review: { rating: 4, comment: "Easy to inflate and very stable. Pump was slow but worked fine." } },
  { key: "o6", customer: "customer3", gear: "harness", quantity: 2, start: -15, days: 1, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Both harnesses looked brand new. Provider explained the fit carefully." } },
  { key: "o7", customer: "customer4", gear: "football-kit", quantity: 1, start: -12, days: 1, status: RentalStatus.RETURNED, review: { rating: 4, comment: "Had everything we needed for a Friday match." } },
  { key: "o8", customer: "customer4", gear: "tent-4p", quantity: 1, start: -10, days: 2, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Huge tent, the kids loved it. Setup instructions were included." } },
  { key: "o9", customer: "customer5", gear: "snorkel", quantity: 2, start: -9, days: 2, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Clean, clear masks — saw so many fish at Saint Martin's." } },
  { key: "o10", customer: "customer5", gear: "city-bike", quantity: 1, start: -8, days: 3, status: RentalStatus.RETURNED, review: { rating: 4, comment: "Great for getting around. Lights were really handy at night." } },
  { key: "o11", customer: "customer1", gear: "boots", quantity: 1, start: -6, days: 3, status: RentalStatus.RETURNED },
  { key: "o12", customer: "customer2", gear: "cricket-kit", quantity: 1, start: -5, days: 1, status: RentalStatus.RETURNED },
  { key: "o13", customer: "customer3", gear: "ebike", quantity: 1, start: -1, days: 3, status: RentalStatus.PICKED_UP },
  { key: "o14", customer: "customer4", gear: "kayak-tandem", quantity: 1, start: 0, days: 2, status: RentalStatus.PICKED_UP },
  { key: "o15", customer: "customer1", gear: "sleeping-bag", quantity: 2, start: 3, days: 2, status: RentalStatus.PAID },
  { key: "o16", customer: "customer5", gear: "road-bike", quantity: 1, start: 5, days: 2, status: RentalStatus.PAID },
  { key: "o17", customer: "customer2", gear: "rope", quantity: 1, start: 7, days: 1, status: RentalStatus.CONFIRMED },
  { key: "o18", customer: "customer3", gear: "camp-stove", quantity: 1, start: 9, days: 2, status: RentalStatus.CONFIRMED },
  { key: "o19", customer: "customer1", gear: "surfboard", quantity: 1, start: 12, days: 2, status: RentalStatus.PLACED },
  { key: "o20", customer: "customer4", gear: "badminton", quantity: 1, start: 4, days: 1, status: RentalStatus.PLACED },
  { key: "o21", customer: "customer5", gear: "gps", quantity: 1, start: 14, days: 4, status: RentalStatus.PLACED },
  { key: "o22", customer: "customer2", gear: "lantern", quantity: 1, start: 2, days: 2, status: RentalStatus.CANCELLED, cancelReason: CancelReason.CUSTOMER },
  { key: "o23", customer: "customer3", gear: "volleyball", quantity: 1, start: 6, days: 1, status: RentalStatus.CANCELLED, cancelReason: CancelReason.PROVIDER_DECLINED },

  // Damage claims: one open, three settled (part kept, all kept, all refunded).
  { key: "o24", customer: "customer2", gear: "kayak-single", quantity: 1, start: -6, days: 2, status: RentalStatus.RETURNED, claim: { amount: 1200, note: "Paddle blade cracked near the shaft and the seat strap was torn. Photos taken at return." } },
  { key: "o25", customer: "customer6", gear: "mtb", quantity: 1, start: -50, days: 2, status: RentalStatus.RETURNED, claim: { amount: 2000, note: "Rear derailleur bent after a fall on the trail.", resolved: { kept: 1200, note: "Repair invoice for ৳1,200 checked. The rest of the deposit was refunded." } } },
  { key: "o26", customer: "customer7", gear: "sup", quantity: 1, start: -70, days: 1, status: RentalStatus.RETURNED, claim: { amount: 2000, note: "Board punctured along the rail. The repair shop says it can't be fixed.", resolved: { kept: 2000, note: "Photos and the repair shop's note confirm the damage. Full deposit kept." } } },
  { key: "o27", customer: "customer9", gear: "road-bike", quantity: 1, start: -80, days: 1, status: RentalStatus.RETURNED, claim: { amount: 800, note: "Scratches on the top tube.", resolved: { kept: 0, note: "Cosmetic scratches only, normal wear. Deposit refunded in full." } } },

  // A review an admin has hidden (spam), so moderation has something to show.
  { key: "o28", customer: "customer8", gear: "lantern", quantity: 1, start: -35, days: 1, status: RentalStatus.RETURNED, review: { rating: 1, comment: "Cheaper lanterns on my page, message me on WhatsApp 01XXXXXXXXX", hidden: true } },

  // More live orders so every provider has something to act on.
  { key: "o29", customer: "customer6", gear: "tent-2p", quantity: 1, start: 1, days: 2, status: RentalStatus.PAID },
  { key: "o30", customer: "customer7", gear: "backpack-30", quantity: 2, start: 2, days: 3, status: RentalStatus.CONFIRMED },
  { key: "o31", customer: "customer8", gear: "cooler", quantity: 1, start: 8, days: 2, status: RentalStatus.PLACED },
  { key: "o32", customer: "customer9", gear: "climb-shoes", quantity: 2, start: -2, days: 4, status: RentalStatus.PICKED_UP },
  { key: "o33", customer: "customer10", gear: "hammock", quantity: 1, start: 10, days: 2, status: RentalStatus.PLACED },
  { key: "o34", customer: "customer11", gear: "kids-bike", quantity: 1, start: 6, days: 1, status: RentalStatus.PAID },
  { key: "o35", customer: "customer12", gear: "snorkel", quantity: 3, start: -3, days: 2, status: RentalStatus.RETURNED, review: { rating: 5, comment: "Three sets for the whole family and every mask sealed well. Great day at Himchari." } },
  { key: "o36", customer: "customer10", gear: "mtb", quantity: 1, start: 3, days: 1, status: RentalStatus.CANCELLED, cancelReason: CancelReason.PAYMENT_EXPIRED },
];

// -------------------------------------------------------------- history
// About 10 months of finished rentals, generated with a fixed seed, so the
// charts, ratings and AI review summaries have something to work with.

const HISTORY_SIZE = 130;

/** Rented more often, so these build up enough reviews for a summary. */
const POPULAR = new Set([
  "tent-2p", "tent-4p", "sleeping-bag", "kayak-single", "sup", "snorkel",
  "mtb", "city-bike", "backpack-50", "boots", "harness", "football-kit",
]);

/** Review text by category and mood. Ratings pick the mood. */
const REVIEW_TEXT: Record<string, { good: string[]; mixed: string[]; bad: string[] }> = {
  Camping: {
    good: [
      "Clean, complete and packed neatly. Setting up took ten minutes.",
      "Kept us dry through a night of heavy rain. Exactly as described.",
      "Everything was there, even spare pegs. Pickup was on time.",
      "Great quality for the price. Our first camping trip was a success.",
      "The provider showed us how to set it up before we left. Very helpful.",
    ],
    mixed: [
      "Did the job, but one zip was stiff. The provider said they'd fix it.",
      "Good overall, a bit heavier to carry than I expected.",
    ],
    bad: ["Smelled musty when we opened it. Usable, but it needed airing out."],
  },
  "Water Sports": {
    good: [
      "Stable and easy to handle, even for beginners. Life jacket fitted well.",
      "Everything was rinsed and ready. We spent the whole afternoon on the water.",
      "Perfect for the lagoon. The provider pointed out the calmest spots.",
      "In great condition and pickup near the beach was quick.",
    ],
    mixed: [
      "Fun day out, though the pump was slow to inflate it.",
      "Good gear, but pickup ran 20 minutes late.",
    ],
    bad: ["The leash was worn and snapped on the second day. Got a partial refund."],
  },
  Cycling: {
    good: [
      "Smooth gears and strong brakes. Rode the whole trail without a problem.",
      "Well maintained, tyres pumped and a helmet included.",
      "Comfortable for a full day of riding. Would rent again.",
      "Fitted the seat height for me at pickup. Great service.",
    ],
    mixed: [
      "Rode well, but the saddle was hard on the second day.",
      "Chain needed oil after the first ride. Fine after that.",
    ],
    bad: ["Gears kept slipping on hills. The provider apologised and swapped it."],
  },
  "Hiking & Trekking": {
    good: [
      "Comfortable for long days on the trail. Lots of useful pockets.",
      "Clean and in great shape. Made the Keokradong trek much easier.",
      "Fitted perfectly after a quick adjustment. Highly recommend.",
      "Light, sturdy and exactly as pictured.",
    ],
    mixed: [
      "Did the job, though it was a size bigger than I asked for.",
      "Good quality, a bit worn but nothing that mattered.",
    ],
    bad: ["Rain cover was missing, so my things got wet on day one."],
  },
  Climbing: {
    good: [
      "Inspected and logged before handover. Felt safe the whole day.",
      "Looked almost new. The provider explained the fit carefully.",
      "Everything we needed for a full day at the crag.",
    ],
    mixed: ["Good gear, sizing ran a little small."],
    bad: ["One buckle was sticky. It worked, but I'd check it next time."],
  },
  "Team Sports": {
    good: [
      "Had everything for our Friday match. The ball held air all evening.",
      "Complete kit and easy pickup. The team loved it.",
      "Great value split between eight of us.",
      "Clean and ready to play. Will book again for the next tournament.",
    ],
    mixed: ["Most of it was great, one bib was missing."],
    bad: ["The net was torn in one corner. We made it work."],
  },
};

const PAID_STATUSES: RentalStatus[] = [
  RentalStatus.PAID,
  RentalStatus.PICKED_UP,
  RentalStatus.RETURNED,
];

/** The happy path, in order — used to backdate each step's timestamp. */
const ORDER_FLOW: RentalStatus[] = [
  RentalStatus.PLACED,
  RentalStatus.CONFIRMED,
  RentalStatus.PAID,
  RentalStatus.PICKED_UP,
  RentalStatus.RETURNED,
];

/** Units out per gear and day offset, so generated orders never overbook. */
const usage = new Map<string, number>();
const fits = (gear: SeedGear, start: number, days: number, quantity: number) => {
  for (let day = start; day < start + days; day++) {
    if ((usage.get(`${gear.key}:${day}`) ?? 0) + quantity > gear.owned) return false;
  }
  return true;
};
const hold = (gear: SeedGear, start: number, days: number, quantity: number) => {
  for (let day = start; day < start + days; day++) {
    const key = `${gear.key}:${day}`;
    usage.set(key, (usage.get(key) ?? 0) + quantity);
  }
};

const buildHistory = (): SeedOrder[] => {
  const rand = mulberry32(20261018);
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]!;
  const weighted = GEAR.flatMap((gear) => (POPULAR.has(gear.key) ? [gear, gear, gear, gear] : [gear]));
  const customers = USERS.filter((user) => user.role === Role.CUSTOMER);

  const history: SeedOrder[] = [];
  for (let attempt = 0; history.length < HISTORY_SIZE && attempt < HISTORY_SIZE * 4; attempt++) {
    const gear = pick(weighted);
    // Skewed towards recent months, so the charts show growth.
    const start = -Math.round(16 + Math.pow(rand(), 1.5) * 284);
    const days = 1 + Math.floor(rand() * 4);
    const quantity = gear.owned >= 4 && rand() < 0.2 ? 2 : 1;
    const eligible = customers.filter((user) => user.joinedDaysAgo >= -start + 3);
    if (eligible.length === 0) continue;
    const customer = pick(eligible).key;

    const roll = rand();
    if (roll < 0.09) {
      const reasons = [CancelReason.CUSTOMER, CancelReason.PROVIDER_DECLINED, CancelReason.NO_PROVIDER_RESPONSE, CancelReason.PAYMENT_EXPIRED];
      history.push({ key: `h${history.length + 1}`, customer, gear: gear.key, quantity, start, days, status: RentalStatus.CANCELLED, cancelReason: pick(reasons) });
      continue;
    }
    if (!fits(gear, start, days, quantity)) continue;
    hold(gear, start, days, quantity);

    const order: SeedOrder = { key: `h${history.length + 1}`, customer, gear: gear.key, quantity, start, days, status: RentalStatus.RETURNED };
    if (rand() < 0.75) {
      const mood = rand();
      const rating = mood < 0.55 ? 5 : mood < 0.85 ? 4 : mood < 0.95 ? 3 : 2;
      const text = REVIEW_TEXT[gear.category]!;
      const pool = rating >= 4 ? text.good : rating === 3 ? text.mixed : text.bad;
      order.review = { rating, comment: pick(pool) };
    }
    history.push(order);
  }
  return history;
};

// ------------------------------------------------------- conversations
// Order chats. `at` is hours after the order was placed; the last message of
// the threads marked `unread` stays unread, so the badges show.

type SeedMessage = { from: "customer" | "provider"; at: number; body: string };

const CONVERSATIONS: Record<string, { unread?: boolean; messages: SeedMessage[] }> = {
  o15: {
    messages: [
      { from: "customer", at: 1, body: "Hi! Are both sleeping bags the same size? One of us is quite tall." },
      { from: "provider", at: 3, body: "Hi Ayesha, both are regular length (up to 185 cm). I can swap one for our long version at no extra cost." },
      { from: "customer", at: 4, body: "That would be perfect, thank you!" },
      { from: "provider", at: 5, body: "Done. See you at Zindabazar. Pickup any time after 9 am." },
    ],
  },
  o19: {
    unread: true,
    messages: [
      { from: "customer", at: 1, body: "Is the surfboard OK for a complete beginner?" },
      { from: "provider", at: 2, body: "Yes, the soft-top is the best board to learn on. I'll confirm your booking tonight and can recommend a calm spot at Kolatoli." },
    ],
  },
  o13: {
    messages: [
      { from: "provider", at: 2, body: "Your e-bike is fully charged. Bring an ID to pickup, please." },
      { from: "customer", at: 3, body: "Will do. Can I keep the charger for the three days?" },
      { from: "provider", at: 4, body: "Of course, it's in the bag with the lock." },
    ],
  },
  o17: {
    messages: [
      { from: "customer", at: 2, body: "Could you include a rope bag with the rope?" },
      { from: "provider", at: 3, body: "Sure, I'll pack one. Please pay before the deadline so I can hold the rope for you." },
    ],
  },
  o24: {
    unread: true,
    messages: [
      { from: "provider", at: 200, body: "Hi Tanvir, the paddle came back cracked and the seat strap was torn, so I've reported it with photos." },
      { from: "customer", at: 202, body: "Sorry about that. The paddle hit a rock near the shore. The strap was already loose when I picked it up, though." },
    ],
  },
  o29: {
    messages: [
      { from: "customer", at: 1, body: "We'll come at 8 am tomorrow, is that OK?" },
      { from: "provider", at: 2, body: "8 am is fine. The tent will be packed with the footprint and spare pegs." },
    ],
  },
};

/** Saved gear per customer. */
const FAVORITES: Record<string, string[]> = {
  customer1: ["kayak-single", "sup", "gps", "tent-4p", "rain-jacket"],
  customer2: ["mtb", "rope", "quickdraws"],
  customer3: ["ebike", "camp-stove", "headlamp", "dry-bag"],
  customer4: ["football-kit", "cricket-kit", "goalposts"],
  customer5: ["snorkel", "wetsuit", "surfboard"],
  customer6: ["tent-2p", "backpack-50", "poles"],
  customer7: ["backpack-30", "water-filter"],
  customer10: ["hammock", "cooler", "camp-chairs"],
};

// ------------------------------------------------- newsletter & contact
// example.com addresses only, so nothing can reach a real inbox.

const SUBSCRIBERS: { email: string; status: "confirmed" | "pending" | "unsubscribed"; daysAgo: number; locale?: Locale }[] = [
  { email: "rahim.uddin@example.com", status: "confirmed", daysAgo: 210 },
  { email: "jannat.ara@example.com", status: "confirmed", daysAgo: 180, locale: Locale.bn },
  { email: "sabbir.hossain@example.com", status: "confirmed", daysAgo: 150 },
  { email: "tania.akter@example.com", status: "confirmed", daysAgo: 120 },
  { email: "kamrul.hasan@example.com", status: "confirmed", daysAgo: 95, locale: Locale.bn },
  { email: "nadia.islam@example.com", status: "confirmed", daysAgo: 60 },
  { email: "fahim.reza@example.com", status: "confirmed", daysAgo: 30 },
  { email: "sumaiya.khan@example.com", status: "confirmed", daysAgo: 12, locale: Locale.bn },
  { email: "rafsan.ali@example.com", status: "pending", daysAgo: 3 },
  { email: "priya.saha@example.com", status: "pending", daysAgo: 1 },
  { email: "omar.faruk@example.com", status: "unsubscribed", daysAgo: 140 },
  { email: "lina.begum@example.com", status: "unsubscribed", daysAgo: 75, locale: Locale.bn },
];

const CONTACT_MESSAGES: {
  key: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  daysAgo: number;
  read?: boolean;
  reply?: string;
  locale?: Locale;
}[] = [
  {
    key: "c1",
    name: "Rashed Karim",
    email: "rashed.karim@example.com",
    subject: "Group booking for a company trip",
    message: "We're planning a team trip to Bandarban for 12 people next month. Can we book tents and backpacks for everyone in one go, and is there a discount for groups?",
    status: ContactStatus.NEW,
    daysAgo: 0.2,
  },
  {
    key: "c2",
    name: "সুমি আক্তার",
    email: "sumi.akter@example.com",
    subject: "ডিপোজিট কবে ফেরত পাব?",
    message: "আমি গত সপ্তাহে কায়াক ফেরত দিয়েছি। ডিপোজিটের টাকা কতদিনের মধ্যে ফেরত আসবে?",
    status: ContactStatus.NEW,
    daysAgo: 1,
    locale: Locale.bn,
  },
  {
    key: "c3",
    name: "Daniel Roy",
    email: "daniel.roy@example.com",
    subject: "Listing gear from Chattogram",
    message: "I have two kayaks and some camping gear in Chattogram. How do I start listing, and what does GearUp charge?",
    status: ContactStatus.NEW,
    daysAgo: 2,
    read: true,
  },
  {
    key: "c4",
    name: "Nabila Haque",
    email: "nabila.haque@example.com",
    subject: "Changing my rental dates",
    message: "Can I move my booking two days later? It's already paid.",
    status: ContactStatus.REPLIED,
    daysAgo: 9,
    read: true,
    reply: "Hi Nabila, paid bookings can't be moved, but you can cancel for a full refund until 24 hours before the start day and book the new dates straight away. Let us know if the gear isn't free on those dates and we'll help you find another.",
  },
  {
    key: "c5",
    name: "Tareq Mahmud",
    email: "tareq.mahmud@example.com",
    subject: "Payment failed",
    message: "My card was declined at checkout but I think the money was taken.",
    status: ContactStatus.REPLIED,
    daysAgo: 21,
    read: true,
    reply: "Hi Tareq, we checked and the payment didn't go through, so nothing was charged. The pending amount your bank shows will drop off within a few days. You can try again from your order page.",
  },
  {
    key: "c6",
    name: "Promo Bot",
    email: "seo-offers@example.com",
    subject: "Rank #1 on Google in 7 days",
    message: "We offer guaranteed SEO results for your website. Reply for our price list.",
    status: ContactStatus.ARCHIVED,
    daysAgo: 30,
    read: true,
  },
];

const depositStatusFor = (order: SeedOrder, deposit: number) => {
  if (deposit <= 0) return DepositStatus.NONE;
  if (order.claim) {
    const kept = order.claim.resolved?.kept;
    if (kept === undefined) return DepositStatus.CLAIMED;
    if (kept <= 0) return DepositStatus.REFUNDED;
    if (kept >= deposit) return DepositStatus.KEPT;
    return DepositStatus.PARTIALLY_REFUNDED;
  }
  if (order.status === RentalStatus.RETURNED) return DepositStatus.REFUNDED;
  if (order.status === RentalStatus.PAID || order.status === RentalStatus.PICKED_UP) {
    return DepositStatus.HELD;
  }
  return DepositStatus.NONE;
};

// ---------------------------------------------------------------- run

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, Number(config.bcrypt_salt_rounds) || 10);

  const userIds = new Map<string, string>();
  for (const user of USERS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        id: seedId(`user:${user.key}`),
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
        emailVerifiedAt: daysAgo(user.joinedDaysAgo),
        createdAt: daysAgo(user.joinedDaysAgo),
        ...(user.phone && { phone: user.phone }),
        ...(user.locale && { locale: user.locale }),
      },
    });
    userIds.set(user.key, row.id);

    // Fill the demo profile once; never overwrite what a user has set.
    const profile = PROVIDER_PROFILES[user.key] ?? (user.city ? { city: user.city } : null);
    if (profile) {
      await prisma.user.updateMany({
        where: { id: row.id, city: null },
        data: profile,
      });
    }
  }

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: { id: seedId(`category:${category.name}`), ...category },
    });
    categoryIds.set(category.name, row.id);
  }

  const gearByKey = new Map(GEAR.map((gear) => [gear.key, gear]));
  for (const [index, gear] of GEAR.entries()) {
    const [cover, ...gallery] = gear.images.map(img);
    await prisma.gearItem.upsert({
      where: { id: seedId(`gear:${gear.key}`) },
      update: {},
      create: {
        id: seedId(`gear:${gear.key}`),
        name: gear.name,
        brand: gear.brand,
        description: gear.description,
        imageUrl: cover ?? null,
        images: gallery,
        pricePerDay: gear.pricePerDay,
        depositAmount: DEPOSITS[gear.key] ?? 0,
        stock: gear.owned,
        isAvailable: true,
        isFeatured: FEATURED.includes(gear.key),
        providerId: userIds.get(gear.provider)!,
        categoryId: categoryIds.get(gear.category)!,
        // Listed before any rental history; later items count as newer.
        createdAt: daysAgo(360 - index),
      },
    });
  }

  // An older database may have no featured items; never undo an admin's pick.
  if ((await prisma.gearItem.count({ where: { isFeatured: true } })) === 0) {
    await prisma.gearItem.updateMany({
      where: { id: { in: FEATURED.map((key) => seedId(`gear:${key}`)) } },
      data: { isFeatured: true },
    });
  }

  // Hand-written orders hold their units first; history fits around them.
  for (const order of ORDERS) {
    if (order.status !== RentalStatus.CANCELLED) {
      hold(gearByKey.get(order.gear)!, order.start, order.days, order.quantity);
    }
  }
  const history = buildHistory();
  const allOrders = [...ORDERS, ...history];

  const now = new Date();
  /** Timestamps for recent orders must not land in the future. */
  const past = (time: number) => new Date(Math.min(time, now.getTime() - 5 * MINUTE));
  const createdAtOf = new Map<string, Date>();
  let reviewCount = 0;
  for (const order of allOrders) {
    const gear = gearByKey.get(order.gear)!;
    const orderId = seedId(`order:${order.key}`);
    const customerId = userIds.get(order.customer)!;
    const startDate = midnightUtc(order.start);
    const endDate = midnightUtc(order.start + order.days);
    const totalAmount = gear.pricePerDay * order.quantity * order.days;
    const depositAmount = (DEPOSITS[gear.key] ?? 0) * order.quantity;
    const createdAt = new Date(Math.min(startDate.getTime() - 3 * DAY, now.getTime() - 6 * HOUR));
    createdAtOf.set(order.key, createdAt);
    const reached = (status: RentalStatus) =>
      ORDER_FLOW.indexOf(order.status) >= ORDER_FLOW.indexOf(status);
    const claimResolvedAt = new Date(endDate.getTime() + 3 * DAY);
    const kept = order.claim?.resolved?.kept;

    await prisma.rentalOrder.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        status: order.status,
        startDate,
        endDate,
        totalAmount,
        depositAmount,
        depositStatus: depositStatusFor(order, depositAmount),
        customerId,
        providerId: userIds.get(gear.provider)!,
        createdAt,
        ...(order.status === RentalStatus.PLACED && {
          respondBy: new Date(now.getTime() + 48 * HOUR),
        }),
        ...((reached(RentalStatus.CONFIRMED) ||
          order.cancelReason === CancelReason.PAYMENT_EXPIRED) && {
          confirmedAt: past(createdAt.getTime() + 2 * HOUR),
        }),
        ...(order.status === RentalStatus.CONFIRMED && {
          paymentDueAt: new Date(now.getTime() + 24 * HOUR),
        }),
        ...(reached(RentalStatus.PICKED_UP) && { pickedUpAt: startDate }),
        ...(reached(RentalStatus.RETURNED) && { returnedAt: endDate }),
        ...(order.cancelReason && {
          cancelReason: order.cancelReason,
          cancelledAt: past(
            createdAt.getTime() +
              (order.cancelReason === CancelReason.PAYMENT_EXPIRED ? 26 : 5) * HOUR,
          ),
        }),
        ...(order.claim && {
          damageClaimAmount: Math.min(order.claim.amount, depositAmount),
          damageNote: order.claim.note,
        }),
        ...(kept !== undefined && {
          claimResolvedAt,
          claimKeptAmount: kept,
          claimResolutionNote: order.claim!.resolved!.note,
        }),
        items: {
          create: {
            id: seedId(`order-item:${order.key}`),
            gearItemId: seedId(`gear:${gear.key}`),
            quantity: order.quantity,
            pricePerDay: gear.pricePerDay,
          },
        },
      },
    });

    if (PAID_STATUSES.includes(order.status)) {
      const paidAt = new Date(Math.min(startDate.getTime() - 2 * DAY, now.getTime() - 30 * MINUTE));
      // What went back to the customer: the deposit on a clean return, or
      // whatever an admin didn't keep. An open claim hasn't refunded yet.
      const refunded =
        order.status !== RentalStatus.RETURNED || depositAmount === 0
          ? 0
          : order.claim
            ? kept === undefined
              ? 0
              : depositAmount - kept
            : depositAmount;
      await prisma.payment.upsert({
        where: { transactionId: `seed_cs_${order.key}` },
        update: {},
        create: {
          id: seedId(`payment:${order.key}`),
          transactionId: `seed_cs_${order.key}`,
          amount: totalAmount + depositAmount,
          status: PaymentStatus.COMPLETED,
          paidAt,
          ...(refunded > 0 && {
            refundedAmount: refunded,
            refundedAt: order.claim ? claimResolvedAt : endDate,
          }),
          rentalOrderId: orderId,
          customerId,
          createdAt: paidAt,
        },
      });
    }

    if (order.review) {
      const reviewedAt = new Date(Math.min(endDate.getTime() + DAY, now.getTime() - 2 * HOUR));
      await prisma.review.upsert({
        where: { rentalOrderId: orderId },
        update: {},
        create: {
          id: seedId(`review:${order.key}`),
          rating: order.review.rating,
          comment: order.review.comment,
          customerId,
          gearItemId: seedId(`gear:${gear.key}`),
          rentalOrderId: orderId,
          createdAt: reviewedAt,
          ...(order.review.hidden && {
            isHidden: true,
            hiddenAt: new Date(reviewedAt.getTime() + 6 * HOUR),
          }),
        },
      });
      reviewCount++;
    }
  }

  // Order chats.
  let messageCount = 0;
  for (const [orderKey, thread] of Object.entries(CONVERSATIONS)) {
    const order = ORDERS.find((item) => item.key === orderKey)!;
    const gear = gearByKey.get(order.gear)!;
    const placedAt = createdAtOf.get(orderKey)!;
    for (const [index, message] of thread.messages.entries()) {
      const isLast = index === thread.messages.length - 1;
      // Never in the future, even for orders placed an hour ago.
      const sentAt = new Date(
        Math.min(
          placedAt.getTime() + message.at * HOUR,
          now.getTime() - (thread.messages.length - index) * 7 * MINUTE,
        ),
      );
      await prisma.message.upsert({
        where: { id: seedId(`message:${orderKey}:${index}`) },
        update: {},
        create: {
          id: seedId(`message:${orderKey}:${index}`),
          rentalOrderId: seedId(`order:${orderKey}`),
          senderId: userIds.get(message.from === "customer" ? order.customer : gear.provider)!,
          body: message.body,
          createdAt: sentAt,
          ...(!(thread.unread && isLast) && {
            readAt: new Date(sentAt.getTime() + 2 * MINUTE),
          }),
        },
      });
      messageCount++;
    }
  }

  // Saved gear.
  for (const [customer, keys] of Object.entries(FAVORITES)) {
    for (const [index, key] of keys.entries()) {
      const userId = userIds.get(customer)!;
      const gearItemId = seedId(`gear:${key}`);
      await prisma.favorite.upsert({
        where: { userId_gearItemId: { userId, gearItemId } },
        update: {},
        create: { userId, gearItemId, createdAt: daysAgo(20 - index) },
      });
    }
  }

  // Newsletter.
  for (const subscriber of SUBSCRIBERS) {
    const createdAt = daysAgo(subscriber.daysAgo);
    await prisma.subscriber.upsert({
      where: { email: subscriber.email },
      update: {},
      create: {
        id: seedId(`subscriber:${subscriber.email}`),
        email: subscriber.email,
        token: seedToken(subscriber.email),
        createdAt,
        ...(subscriber.locale && { locale: subscriber.locale }),
        ...(subscriber.status !== "pending" && {
          confirmedAt: new Date(createdAt.getTime() + 20 * MINUTE),
        }),
        ...(subscriber.status === "unsubscribed" && {
          unsubscribedAt: new Date(createdAt.getTime() + 30 * DAY),
        }),
      },
    });
  }

  // Contact inbox.
  for (const contact of CONTACT_MESSAGES) {
    const createdAt = daysAgo(contact.daysAgo);
    await prisma.contactMessage.upsert({
      where: { id: seedId(`contact:${contact.key}`) },
      update: {},
      create: {
        id: seedId(`contact:${contact.key}`),
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
        status: contact.status,
        createdAt,
        ...(contact.locale && { locale: contact.locale }),
        ...(contact.read && { readAt: new Date(createdAt.getTime() + 3 * HOUR) }),
        ...(contact.reply && {
          replyBody: contact.reply,
          repliedAt: new Date(createdAt.getTime() + 5 * HOUR),
        }),
      },
    });
  }

  console.log(
    `Seeded ${USERS.length} users, ${CATEGORIES.length} categories, ${GEAR.length} gear items, ` +
      `${allOrders.length} orders (${history.length} generated history), ${reviewCount} reviews, ` +
      `${messageCount} messages, ${SUBSCRIBERS.length} subscribers and ${CONTACT_MESSAGES.length} contact messages.`,
  );

  // Real AI summaries for items with 3+ reviews (skipped when already fresh).
  if (config.gemini.api_key) {
    console.log("Writing AI review summaries (this can take a minute)…");
    const done = await aiService.refreshStaleSummaries(40);
    console.log(`AI review summaries written: ${done}.`);
  } else {
    console.log("Skipped AI review summaries: GEMINI_API_KEY is not set. The daily cron writes them later.");
  }

  console.log(`Demo password for every seeded account: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
