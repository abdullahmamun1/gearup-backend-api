/**
 * Demo data for local development: `npm run db:seed`.
 *
 * Safe to re-run. Every record has a stable id (or a unique key) and is
 * upserted with an empty `update`, so existing rows — including real accounts
 * that share a demo email — are never modified. Nothing is deleted.
 *
 * `stock` is the number of units a provider owns. Availability for any dates
 * is computed from overlapping bookings, so seeded orders don't touch it.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import config from "../src/config";
import { prisma } from "../src/lib/prisma";
import {
  CancelReason,
  DepositStatus,
  PaymentStatus,
  RentalStatus,
  Role,
} from "../generated/prisma/enums";

const PASSWORD = "Password123";
const HOUR = 60 * 60 * 1000;
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

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const midnightUtc = (offsetDays: number) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return new Date(date.getTime() + offsetDays * DAY);
};

// ---------------------------------------------------------------- users

const USERS: { key: string; name: string; email: string; role: Role; phone?: string }[] = [
  { key: "admin", name: "GearUp Admin", email: "admin@gearup.com", role: Role.ADMIN },
  { key: "provider1", name: "Trail Base Sylhet", email: "provider1@gearup.com", role: Role.PROVIDER, phone: "+8801700000001" },
  { key: "provider2", name: "Bay Adventures", email: "provider2@gearup.com", role: Role.PROVIDER, phone: "+8801700000002" },
  { key: "provider3", name: "Hill Track Outfitters", email: "provider3@gearup.com", role: Role.PROVIDER, phone: "+8801700000003" },
  { key: "provider4", name: "Dhaka Sports Hub", email: "provider4@gearup.com", role: Role.PROVIDER, phone: "+8801700000004" },
  { key: "customer1", name: "Ayesha Rahman", email: "customer1@gearup.com", role: Role.CUSTOMER },
  { key: "customer2", name: "Tanvir Hasan", email: "customer2@gearup.com", role: Role.CUSTOMER },
  { key: "customer3", name: "Nusrat Jahan", email: "customer3@gearup.com", role: Role.CUSTOMER },
  { key: "customer4", name: "Rafiq Islam", email: "customer4@gearup.com", role: Role.CUSTOMER },
  { key: "customer5", name: "Sadia Akter", email: "customer5@gearup.com", role: Role.CUSTOMER },
];

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

// --------------------------------------------------------------- orders
// `start` is days from today. One provider per order (the item's provider).

type SeedOrder = {
  key: string;
  customer: string;
  gear: string;
  quantity: number;
  start: number;
  days: number;
  status: RentalStatus;
  cancelReason?: CancelReason;
  review?: { rating: number; comment: string };
};

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
];

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

const depositStatusFor = (status: RentalStatus, deposit: number) => {
  if (deposit <= 0) return DepositStatus.NONE;
  if (status === RentalStatus.RETURNED) return DepositStatus.REFUNDED;
  if (status === RentalStatus.PAID || status === RentalStatus.PICKED_UP) {
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
        ...(user.phone && { phone: user.phone }),
      },
    });
    userIds.set(user.key, row.id);
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
  for (const gear of GEAR) {
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
        providerId: userIds.get(gear.provider)!,
        categoryId: categoryIds.get(gear.category)!,
      },
    });
  }

  const now = new Date();
  for (const order of ORDERS) {
    const gear = gearByKey.get(order.gear)!;
    const orderId = seedId(`order:${order.key}`);
    const customerId = userIds.get(order.customer)!;
    const startDate = midnightUtc(order.start);
    const endDate = midnightUtc(order.start + order.days);
    const totalAmount = gear.pricePerDay * order.quantity * order.days;
    const depositAmount = (DEPOSITS[gear.key] ?? 0) * order.quantity;
    const createdAt = new Date(Math.min(startDate.getTime() - 3 * DAY, now.getTime() - HOUR));
    const reached = (status: RentalStatus) =>
      ORDER_FLOW.indexOf(order.status) >= ORDER_FLOW.indexOf(status);

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
        depositStatus: depositStatusFor(order.status, depositAmount),
        customerId,
        providerId: userIds.get(gear.provider)!,
        createdAt,
        ...(order.status === RentalStatus.PLACED && {
          respondBy: new Date(now.getTime() + 48 * HOUR),
        }),
        ...(reached(RentalStatus.CONFIRMED) && {
          confirmedAt: new Date(createdAt.getTime() + 2 * HOUR),
        }),
        ...(order.status === RentalStatus.CONFIRMED && {
          paymentDueAt: new Date(now.getTime() + 24 * HOUR),
        }),
        ...(reached(RentalStatus.PICKED_UP) && { pickedUpAt: startDate }),
        ...(reached(RentalStatus.RETURNED) && { returnedAt: endDate }),
        ...(order.cancelReason && {
          cancelReason: order.cancelReason,
          cancelledAt: new Date(createdAt.getTime() + 5 * HOUR),
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
      const paidAt = new Date(startDate.getTime() - 2 * DAY);
      await prisma.payment.upsert({
        where: { transactionId: `seed_cs_${order.key}` },
        update: {},
        create: {
          id: seedId(`payment:${order.key}`),
          transactionId: `seed_cs_${order.key}`,
          amount: totalAmount + depositAmount,
          status: PaymentStatus.COMPLETED,
          paidAt,
          ...(order.status === RentalStatus.RETURNED &&
            depositAmount > 0 && {
              refundedAmount: depositAmount,
              refundedAt: endDate,
            }),
          rentalOrderId: orderId,
          customerId,
          createdAt: paidAt,
        },
      });
    }

    if (order.review) {
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
          createdAt: new Date(endDate.getTime() + DAY),
        },
      });
    }
  }

  console.log(
    `Seeded ${USERS.length} users, ${CATEGORIES.length} categories, ${GEAR.length} gear items and ${ORDERS.length} orders.`,
  );
  console.log(`Demo password for every seeded account: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
