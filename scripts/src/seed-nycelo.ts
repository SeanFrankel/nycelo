import { db, neighborhoodsTable, traitsTable } from "@workspace/db";
import HOOD_META from "./nycelo-hood-meta.json";

const metaByName = new Map(HOOD_META.map((m) => [m.name, m]));

type Vibe =
  | "brownstone"
  | "skyline"
  | "waterfront"
  | "industrial"
  | "parkside"
  | "village"
  | "bustling"
  | "residential"
  | "beach"
  | "suburban"
  | "cultural"
  | "luxury"
  | "artsy"
  | "historic";

const photo = (v: Vibe) => `images/vibes/${v}.jpg`;

// [name, borough, lat, lng, vibe]
const HOODS: Array<[string, string, number, number, Vibe]> = [
  // Manhattan
  ["Financial District", "Manhattan", 40.7075, -74.0113, "skyline"],
  ["Tribeca", "Manhattan", 40.7163, -74.0086, "luxury"],
  ["Battery Park City", "Manhattan", 40.7115, -74.0156, "waterfront"],
  ["Chinatown", "Manhattan", 40.7158, -73.997, "cultural"],
  ["Lower East Side", "Manhattan", 40.715, -73.9843, "artsy"],
  ["Two Bridges", "Manhattan", 40.7115, -73.9932, "cultural"],
  ["SoHo", "Manhattan", 40.7233, -74.003, "luxury"],
  ["Nolita", "Manhattan", 40.7229, -73.9957, "village"],
  ["Little Italy", "Manhattan", 40.7191, -73.9973, "historic"],
  ["Greenwich Village", "Manhattan", 40.7336, -74.0027, "village"],
  ["West Village", "Manhattan", 40.7358, -74.0036, "village"],
  ["East Village", "Manhattan", 40.7265, -73.9815, "artsy"],
  ["NoHo", "Manhattan", 40.7284, -73.9922, "artsy"],
  ["Chelsea", "Manhattan", 40.7465, -74.0014, "artsy"],
  ["Flatiron District", "Manhattan", 40.7411, -73.9897, "skyline"],
  ["Gramercy", "Manhattan", 40.7367, -73.9845, "historic"],
  ["Union Square", "Manhattan", 40.7359, -73.9911, "bustling"],
  ["Kips Bay", "Manhattan", 40.7423, -73.9776, "residential"],
  ["Murray Hill", "Manhattan", 40.7479, -73.9757, "residential"],
  ["Midtown", "Manhattan", 40.7549, -73.984, "skyline"],
  ["Hell's Kitchen", "Manhattan", 40.7638, -73.9918, "bustling"],
  ["Hudson Yards", "Manhattan", 40.7539, -74.0021, "skyline"],
  ["Times Square", "Manhattan", 40.758, -73.9855, "bustling"],
  ["Koreatown", "Manhattan", 40.7478, -73.9861, "cultural"],
  ["NoMad", "Manhattan", 40.7449, -73.9884, "skyline"],
  ["Upper East Side", "Manhattan", 40.7736, -73.9566, "luxury"],
  ["Yorkville", "Manhattan", 40.7762, -73.9494, "residential"],
  ["Lenox Hill", "Manhattan", 40.7662, -73.9601, "luxury"],
  ["Upper West Side", "Manhattan", 40.787, -73.9754, "parkside"],
  ["Lincoln Square", "Manhattan", 40.7741, -73.9847, "parkside"],
  ["Manhattan Valley", "Manhattan", 40.7994, -73.9663, "residential"],
  ["Morningside Heights", "Manhattan", 40.8089, -73.9612, "parkside"],
  ["Harlem", "Manhattan", 40.8116, -73.9465, "historic"],
  ["East Harlem", "Manhattan", 40.7947, -73.9425, "cultural"],
  ["Hamilton Heights", "Manhattan", 40.8252, -73.9496, "brownstone"],
  ["Washington Heights", "Manhattan", 40.8417, -73.9394, "cultural"],
  ["Inwood", "Manhattan", 40.8677, -73.9212, "parkside"],
  ["Roosevelt Island", "Manhattan", 40.7605, -73.9509, "waterfront"],
  ["Stuyvesant Town", "Manhattan", 40.7317, -73.9777, "residential"],

  // Brooklyn
  ["Williamsburg", "Brooklyn", 40.7143, -73.9535, "industrial"],
  ["Greenpoint", "Brooklyn", 40.7245, -73.9518, "industrial"],
  ["Bushwick", "Brooklyn", 40.6944, -73.9213, "artsy"],
  ["Bedford-Stuyvesant", "Brooklyn", 40.6872, -73.9418, "brownstone"],
  ["Brooklyn Heights", "Brooklyn", 40.696, -73.9954, "historic"],
  ["DUMBO", "Brooklyn", 40.7033, -73.9881, "industrial"],
  ["Downtown Brooklyn", "Brooklyn", 40.6934, -73.9852, "skyline"],
  ["Fort Greene", "Brooklyn", 40.6892, -73.9742, "brownstone"],
  ["Clinton Hill", "Brooklyn", 40.6897, -73.9654, "brownstone"],
  ["Boerum Hill", "Brooklyn", 40.6849, -73.9838, "brownstone"],
  ["Cobble Hill", "Brooklyn", 40.6864, -73.9962, "brownstone"],
  ["Carroll Gardens", "Brooklyn", 40.6795, -73.9993, "brownstone"],
  ["Red Hook", "Brooklyn", 40.6752, -74.0088, "waterfront"],
  ["Gowanus", "Brooklyn", 40.6733, -73.9899, "industrial"],
  ["Park Slope", "Brooklyn", 40.6721, -73.9779, "brownstone"],
  ["Prospect Heights", "Brooklyn", 40.6774, -73.9668, "brownstone"],
  ["Crown Heights", "Brooklyn", 40.6681, -73.9442, "brownstone"],
  ["Prospect Lefferts Gardens", "Brooklyn", 40.6592, -73.9533, "parkside"],
  ["Windsor Terrace", "Brooklyn", 40.6539, -73.9756, "parkside"],
  ["Greenwood Heights", "Brooklyn", 40.6602, -73.9932, "residential"],
  ["Sunset Park", "Brooklyn", 40.6455, -74.0125, "cultural"],
  ["Bay Ridge", "Brooklyn", 40.6262, -74.0301, "residential"],
  ["Dyker Heights", "Brooklyn", 40.6215, -74.0096, "suburban"],
  ["Bensonhurst", "Brooklyn", 40.6017, -73.9942, "cultural"],
  ["Bath Beach", "Brooklyn", 40.6039, -74.0062, "residential"],
  ["Borough Park", "Brooklyn", 40.6324, -73.9908, "residential"],
  ["Kensington", "Brooklyn", 40.6389, -73.9724, "residential"],
  ["Ditmas Park", "Brooklyn", 40.6412, -73.9618, "suburban"],
  ["Flatbush", "Brooklyn", 40.6415, -73.959, "cultural"],
  ["East Flatbush", "Brooklyn", 40.6494, -73.9309, "residential"],
  ["Midwood", "Brooklyn", 40.6187, -73.9642, "residential"],
  ["Sheepshead Bay", "Brooklyn", 40.5862, -73.9442, "waterfront"],
  ["Brighton Beach", "Brooklyn", 40.5776, -73.9614, "beach"],
  ["Coney Island", "Brooklyn", 40.5749, -73.9857, "beach"],
  ["Gravesend", "Brooklyn", 40.5934, -73.9755, "residential"],
  ["Marine Park", "Brooklyn", 40.6096, -73.9312, "suburban"],
  ["Mill Basin", "Brooklyn", 40.6097, -73.9070, "suburban"],
  ["Canarsie", "Brooklyn", 40.6402, -73.9012, "residential"],
  ["East New York", "Brooklyn", 40.6668, -73.8825, "residential"],
  ["Brownsville", "Brooklyn", 40.665, -73.9096, "residential"],
  ["Cypress Hills", "Brooklyn", 40.6816, -73.8785, "residential"],
  ["Bergen Beach", "Brooklyn", 40.6199, -73.9033, "suburban"],
  ["Vinegar Hill", "Brooklyn", 40.7034, -73.9822, "historic"],
  ["Columbia Street Waterfront", "Brooklyn", 40.6853, -74.0021, "waterfront"],
  ["Sea Gate", "Brooklyn", 40.5766, -74.0093, "beach"],

  // Queens
  ["Astoria", "Queens", 40.7644, -73.9235, "cultural"],
  ["Long Island City", "Queens", 40.7447, -73.9485, "skyline"],
  ["Sunnyside", "Queens", 40.7434, -73.9196, "residential"],
  ["Woodside", "Queens", 40.7454, -73.9046, "cultural"],
  ["Jackson Heights", "Queens", 40.7557, -73.8831, "cultural"],
  ["Elmhurst", "Queens", 40.7365, -73.8779, "cultural"],
  ["Corona", "Queens", 40.745, -73.8643, "cultural"],
  ["Flushing", "Queens", 40.7675, -73.8331, "bustling"],
  ["College Point", "Queens", 40.786, -73.8390, "suburban"],
  ["Whitestone", "Queens", 40.7920, -73.8095, "suburban"],
  ["Bayside", "Queens", 40.7686, -73.7772, "suburban"],
  ["Douglaston", "Queens", 40.7688, -73.7443, "suburban"],
  ["Little Neck", "Queens", 40.7629, -73.7327, "suburban"],
  ["Fresh Meadows", "Queens", 40.7335, -73.7801, "suburban"],
  ["Forest Hills", "Queens", 40.7196, -73.8448, "parkside"],
  ["Rego Park", "Queens", 40.7266, -73.8624, "residential"],
  ["Kew Gardens", "Queens", 40.7093, -73.8309, "parkside"],
  ["Middle Village", "Queens", 40.717, -73.8743, "suburban"],
  ["Maspeth", "Queens", 40.7294, -73.9066, "residential"],
  ["Ridgewood", "Queens", 40.7043, -73.9018, "artsy"],
  ["Glendale", "Queens", 40.7017, -73.8842, "residential"],
  ["Woodhaven", "Queens", 40.6901, -73.8566, "residential"],
  ["Richmond Hill", "Queens", 40.6958, -73.8272, "cultural"],
  ["Ozone Park", "Queens", 40.6794, -73.8432, "residential"],
  ["Howard Beach", "Queens", 40.6571, -73.8435, "waterfront"],
  ["South Jamaica", "Queens", 40.6809, -73.7929, "residential"],
  ["Jamaica", "Queens", 40.7027, -73.7889, "bustling"],
  ["Jamaica Estates", "Queens", 40.7176, -73.7858, "suburban"],
  ["Hollis", "Queens", 40.7107, -73.7626, "residential"],
  ["Queens Village", "Queens", 40.7268, -73.7419, "suburban"],
  ["St. Albans", "Queens", 40.6895, -73.7644, "residential"],
  ["Laurelton", "Queens", 40.6739, -73.7449, "suburban"],
  ["Rosedale", "Queens", 40.6626, -73.7354, "suburban"],
  ["Far Rockaway", "Queens", 40.6054, -73.7551, "beach"],
  ["Rockaway Beach", "Queens", 40.5861, -73.8116, "beach"],
  ["Breezy Point", "Queens", 40.5581, -73.9294, "beach"],
  ["East Elmhurst", "Queens", 40.7628, -73.8730, "residential"],
  ["Kew Gardens Hills", "Queens", 40.7326, -73.8206, "residential"],
  ["Briarwood", "Queens", 40.7095, -73.8155, "residential"],
  ["Bellerose", "Queens", 40.7362, -73.7154, "suburban"],
  ["Glen Oaks", "Queens", 40.7472, -73.7118, "suburban"],
  ["Auburndale", "Queens", 40.7614, -73.7893, "suburban"],
  ["Springfield Gardens", "Queens", 40.6663, -73.7605, "residential"],
  ["Arverne", "Queens", 40.5924, -73.7954, "beach"],

  // Bronx
  ["Mott Haven", "Bronx", 40.8091, -73.9229, "industrial"],
  ["Port Morris", "Bronx", 40.8015, -73.9096, "industrial"],
  ["Melrose", "Bronx", 40.8256, -73.9152, "residential"],
  ["Hunts Point", "Bronx", 40.8094, -73.8803, "industrial"],
  ["Longwood", "Bronx", 40.8248, -73.8916, "residential"],
  ["Concourse", "Bronx", 40.8317, -73.9236, "bustling"],
  ["Highbridge", "Bronx", 40.8388, -73.9271, "residential"],
  ["Morris Heights", "Bronx", 40.8536, -73.9198, "residential"],
  ["University Heights", "Bronx", 40.8601, -73.9127, "residential"],
  ["Fordham", "Bronx", 40.8592, -73.8987, "bustling"],
  ["Belmont", "Bronx", 40.8551, -73.8854, "cultural"],
  ["Tremont", "Bronx", 40.8481, -73.8969, "residential"],
  ["West Farms", "Bronx", 40.8434, -73.88, "residential"],
  ["Soundview", "Bronx", 40.8247, -73.8654, "residential"],
  ["Castle Hill", "Bronx", 40.8221, -73.8511, "residential"],
  ["Parkchester", "Bronx", 40.8382, -73.8602, "residential"],
  ["Throgs Neck", "Bronx", 40.8189, -73.8213, "waterfront"],
  ["Country Club", "Bronx", 40.8391, -73.8195, "suburban"],
  ["Pelham Bay", "Bronx", 40.8497, -73.8281, "parkside"],
  ["City Island", "Bronx", 40.8477, -73.7865, "waterfront"],
  ["Morris Park", "Bronx", 40.8494, -73.8567, "residential"],
  ["Pelham Parkway", "Bronx", 40.8558, -73.8618, "parkside"],
  ["Norwood", "Bronx", 40.8781, -73.8785, "residential"],
  ["Bedford Park", "Bronx", 40.87, -73.8857, "residential"],
  ["Kingsbridge", "Bronx", 40.8837, -73.9018, "residential"],
  ["Riverdale", "Bronx", 40.8996, -73.9089, "suburban"],
  ["Spuyten Duyvil", "Bronx", 40.8813, -73.9179, "waterfront"],
  ["Woodlawn", "Bronx", 40.8981, -73.8672, "residential"],
  ["Wakefield", "Bronx", 40.8985, -73.852, "residential"],
  ["Williamsbridge", "Bronx", 40.8788, -73.8531, "residential"],
  ["Co-op City", "Bronx", 40.8747, -73.8294, "residential"],
  ["Baychester", "Bronx", 40.8694, -73.8386, "residential"],

  // Staten Island
  ["St. George", "Staten Island", 40.6432, -74.0776, "waterfront"],
  ["Tompkinsville", "Staten Island", 40.6366, -74.0764, "residential"],
  ["Stapleton", "Staten Island", 40.6265, -74.0779, "historic"],
  ["West Brighton", "Staten Island", 40.6317, -74.1093, "residential"],
  ["Port Richmond", "Staten Island", 40.6339, -74.1366, "residential"],
  ["Mariners Harbor", "Staten Island", 40.6366, -74.1594, "residential"],
  ["New Brighton", "Staten Island", 40.6404, -74.0902, "historic"],
  ["Grymes Hill", "Staten Island", 40.6186, -74.0932, "suburban"],
  ["Todt Hill", "Staten Island", 40.6021, -74.1113, "suburban"],
  ["New Dorp", "Staten Island", 40.5735, -74.1166, "suburban"],
  ["Oakwood", "Staten Island", 40.5637, -74.1159, "suburban"],
  ["Great Kills", "Staten Island", 40.5543, -74.1494, "waterfront"],
  ["Eltingville", "Staten Island", 40.5455, -74.1646, "suburban"],
  ["Annadale", "Staten Island", 40.5402, -74.1782, "suburban"],
  ["Tottenville", "Staten Island", 40.5083, -74.2455, "suburban"],
  ["Rossville", "Staten Island", 40.5556, -74.2135, "suburban"],
  ["Westerleigh", "Staten Island", 40.6212, -74.1318, "suburban"],
  ["South Beach", "Staten Island", 40.5904, -74.0713, "beach"],
];

const TRAITS: Array<[string, string, string, string]> = [
  ["dining", "Dining", "Restaurants, food scenes, and late-night eats", "utensils"],
  ["nightlife", "Nightlife", "Bars, clubs, and where the night goes long", "moon"],
  ["dating", "Dating (Young & Single)", "Best neighborhood to be young and dating", "heart"],
  ["walkability", "Walkability", "Errands, strolls, and life without a car", "footprints"],
  ["subway", "Subway Access", "Train lines, frequency, and commute sanity", "train-front"],
  ["rent-value", "Rent Value", "The most neighborhood for your rent dollar", "wallet"],
  ["safety", "Safety", "Feeling at ease day and night", "shield"],
  ["green-space", "Green Space", "Parks, trees, and places to touch grass", "trees"],
  ["family", "Raising a Family", "Schools, playgrounds, and stroller life", "baby"],
  ["coffee", "Coffee & Cafes", "Espresso bars, bakeries, and laptop spots", "coffee"],
  ["quiet", "Peace & Quiet", "Sleeping with the windows open", "bed"],
  ["culture", "Arts & Culture", "Museums, music, galleries, and street life", "palette"],
  ["car-friendly", "Car Friendliness", "Parking, driving, and getting out of town", "car"],
  ["character", "Neighborhood Character", "Charm, architecture, and a sense of place", "landmark"],
];

async function main() {
  const existing = await db.select().from(neighborhoodsTable).limit(1);
  if (existing.length > 0) {
    console.log("Already seeded, skipping.");
    process.exit(0);
  }

  await db.insert(traitsTable).values(
    TRAITS.map(([slug, name, description, emojiHint]) => ({
      slug,
      name,
      description,
      emojiHint,
    })),
  );

  await db.insert(neighborhoodsTable).values(
    HOODS.map(([name, borough, lat, lng, vibe]) => ({
      name,
      borough,
      lat,
      lng,
      photoUrl: photo(vibe),
      blurb: metaByName.get(name)?.blurb ?? null,
    })),
  );

  console.log(`Seeded ${TRAITS.length} traits and ${HOODS.length} neighborhoods.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
