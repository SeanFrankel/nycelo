import { and, eq } from "drizzle-orm";
import { db, neighborhoodsTable } from "@workspace/db";
import HOOD_META from "./nycelo-hood-meta.json";

// Idempotent backfill: sets the vibe-based placeholder photo URL and blurb
// for every neighborhood by name + borough. Never deletes rows, ratings, or votes.
//
// Photo URLs point to the 14 category images already in
// artifacts/nycelo/public/images/vibes/*.jpg

const HOODS: Array<[string, string, string]> = [
  // [name, borough, vibe]
  ["Financial District", "Manhattan", "skyline"],
  ["Tribeca", "Manhattan", "luxury"],
  ["Battery Park City", "Manhattan", "waterfront"],
  ["Chinatown", "Manhattan", "cultural"],
  ["Lower East Side", "Manhattan", "artsy"],
  ["Two Bridges", "Manhattan", "cultural"],
  ["SoHo", "Manhattan", "luxury"],
  ["Nolita", "Manhattan", "village"],
  ["Little Italy", "Manhattan", "historic"],
  ["Greenwich Village", "Manhattan", "village"],
  ["West Village", "Manhattan", "village"],
  ["East Village", "Manhattan", "artsy"],
  ["NoHo", "Manhattan", "artsy"],
  ["Chelsea", "Manhattan", "artsy"],
  ["Flatiron District", "Manhattan", "skyline"],
  ["Gramercy", "Manhattan", "historic"],
  ["Union Square", "Manhattan", "bustling"],
  ["Kips Bay", "Manhattan", "residential"],
  ["Murray Hill", "Manhattan", "residential"],
  ["Midtown", "Manhattan", "skyline"],
  ["Hell's Kitchen", "Manhattan", "bustling"],
  ["Hudson Yards", "Manhattan", "skyline"],
  ["Times Square", "Manhattan", "bustling"],
  ["Koreatown", "Manhattan", "cultural"],
  ["NoMad", "Manhattan", "skyline"],
  ["Upper East Side", "Manhattan", "luxury"],
  ["Yorkville", "Manhattan", "residential"],
  ["Lenox Hill", "Manhattan", "luxury"],
  ["Upper West Side", "Manhattan", "parkside"],
  ["Lincoln Square", "Manhattan", "parkside"],
  ["Manhattan Valley", "Manhattan", "residential"],
  ["Morningside Heights", "Manhattan", "parkside"],
  ["Harlem", "Manhattan", "historic"],
  ["East Harlem", "Manhattan", "cultural"],
  ["Hamilton Heights", "Manhattan", "brownstone"],
  ["Washington Heights", "Manhattan", "cultural"],
  ["Inwood", "Manhattan", "parkside"],
  ["Roosevelt Island", "Manhattan", "waterfront"],
  ["Stuyvesant Town", "Manhattan", "residential"],
  ["Williamsburg", "Brooklyn", "industrial"],
  ["Greenpoint", "Brooklyn", "industrial"],
  ["Bushwick", "Brooklyn", "artsy"],
  ["Bedford-Stuyvesant", "Brooklyn", "brownstone"],
  ["Brooklyn Heights", "Brooklyn", "historic"],
  ["DUMBO", "Brooklyn", "industrial"],
  ["Downtown Brooklyn", "Brooklyn", "skyline"],
  ["Fort Greene", "Brooklyn", "brownstone"],
  ["Clinton Hill", "Brooklyn", "brownstone"],
  ["Boerum Hill", "Brooklyn", "brownstone"],
  ["Cobble Hill", "Brooklyn", "brownstone"],
  ["Carroll Gardens", "Brooklyn", "brownstone"],
  ["Red Hook", "Brooklyn", "waterfront"],
  ["Gowanus", "Brooklyn", "industrial"],
  ["Park Slope", "Brooklyn", "brownstone"],
  ["Prospect Heights", "Brooklyn", "brownstone"],
  ["Crown Heights", "Brooklyn", "brownstone"],
  ["Prospect Lefferts Gardens", "Brooklyn", "parkside"],
  ["Windsor Terrace", "Brooklyn", "parkside"],
  ["Greenwood Heights", "Brooklyn", "residential"],
  ["Sunset Park", "Brooklyn", "cultural"],
  ["Bay Ridge", "Brooklyn", "residential"],
  ["Dyker Heights", "Brooklyn", "suburban"],
  ["Bensonhurst", "Brooklyn", "cultural"],
  ["Bath Beach", "Brooklyn", "residential"],
  ["Borough Park", "Brooklyn", "residential"],
  ["Kensington", "Brooklyn", "residential"],
  ["Ditmas Park", "Brooklyn", "suburban"],
  ["Flatbush", "Brooklyn", "cultural"],
  ["East Flatbush", "Brooklyn", "residential"],
  ["Midwood", "Brooklyn", "residential"],
  ["Sheepshead Bay", "Brooklyn", "waterfront"],
  ["Brighton Beach", "Brooklyn", "beach"],
  ["Coney Island", "Brooklyn", "beach"],
  ["Gravesend", "Brooklyn", "residential"],
  ["Marine Park", "Brooklyn", "suburban"],
  ["Mill Basin", "Brooklyn", "suburban"],
  ["Canarsie", "Brooklyn", "residential"],
  ["East New York", "Brooklyn", "residential"],
  ["Brownsville", "Brooklyn", "residential"],
  ["Cypress Hills", "Brooklyn", "residential"],
  ["Bergen Beach", "Brooklyn", "suburban"],
  ["Vinegar Hill", "Brooklyn", "historic"],
  ["Columbia Street Waterfront", "Brooklyn", "waterfront"],
  ["Sea Gate", "Brooklyn", "beach"],
  ["Astoria", "Queens", "cultural"],
  ["Long Island City", "Queens", "skyline"],
  ["Sunnyside", "Queens", "residential"],
  ["Woodside", "Queens", "cultural"],
  ["Jackson Heights", "Queens", "cultural"],
  ["Elmhurst", "Queens", "cultural"],
  ["Corona", "Queens", "cultural"],
  ["Flushing", "Queens", "bustling"],
  ["College Point", "Queens", "suburban"],
  ["Whitestone", "Queens", "suburban"],
  ["Bayside", "Queens", "suburban"],
  ["Douglaston", "Queens", "suburban"],
  ["Little Neck", "Queens", "suburban"],
  ["Fresh Meadows", "Queens", "suburban"],
  ["Forest Hills", "Queens", "parkside"],
  ["Rego Park", "Queens", "residential"],
  ["Kew Gardens", "Queens", "parkside"],
  ["Middle Village", "Queens", "suburban"],
  ["Maspeth", "Queens", "residential"],
  ["Ridgewood", "Queens", "artsy"],
  ["Glendale", "Queens", "residential"],
  ["Woodhaven", "Queens", "residential"],
  ["Richmond Hill", "Queens", "cultural"],
  ["Ozone Park", "Queens", "residential"],
  ["Howard Beach", "Queens", "waterfront"],
  ["South Jamaica", "Queens", "residential"],
  ["Jamaica", "Queens", "bustling"],
  ["Jamaica Estates", "Queens", "suburban"],
  ["Hollis", "Queens", "residential"],
  ["Queens Village", "Queens", "suburban"],
  ["St. Albans", "Queens", "residential"],
  ["Laurelton", "Queens", "suburban"],
  ["Rosedale", "Queens", "suburban"],
  ["Far Rockaway", "Queens", "beach"],
  ["Rockaway Beach", "Queens", "beach"],
  ["Breezy Point", "Queens", "beach"],
  ["East Elmhurst", "Queens", "residential"],
  ["Kew Gardens Hills", "Queens", "residential"],
  ["Briarwood", "Queens", "residential"],
  ["Bellerose", "Queens", "suburban"],
  ["Glen Oaks", "Queens", "suburban"],
  ["Auburndale", "Queens", "suburban"],
  ["Springfield Gardens", "Queens", "residential"],
  ["Arverne", "Queens", "beach"],
  ["Mott Haven", "Bronx", "industrial"],
  ["Port Morris", "Bronx", "industrial"],
  ["Melrose", "Bronx", "residential"],
  ["Hunts Point", "Bronx", "industrial"],
  ["Longwood", "Bronx", "residential"],
  ["Concourse", "Bronx", "bustling"],
  ["Highbridge", "Bronx", "residential"],
  ["Morris Heights", "Bronx", "residential"],
  ["University Heights", "Bronx", "residential"],
  ["Fordham", "Bronx", "bustling"],
  ["Belmont", "Bronx", "cultural"],
  ["Tremont", "Bronx", "residential"],
  ["West Farms", "Bronx", "residential"],
  ["Soundview", "Bronx", "residential"],
  ["Castle Hill", "Bronx", "residential"],
  ["Parkchester", "Bronx", "residential"],
  ["Throgs Neck", "Bronx", "waterfront"],
  ["Country Club", "Bronx", "suburban"],
  ["Pelham Bay", "Bronx", "parkside"],
  ["City Island", "Bronx", "waterfront"],
  ["Morris Park", "Bronx", "residential"],
  ["Pelham Parkway", "Bronx", "parkside"],
  ["Norwood", "Bronx", "residential"],
  ["Bedford Park", "Bronx", "residential"],
  ["Kingsbridge", "Bronx", "residential"],
  ["Riverdale", "Bronx", "suburban"],
  ["Spuyten Duyvil", "Bronx", "waterfront"],
  ["Woodlawn", "Bronx", "residential"],
  ["Wakefield", "Bronx", "residential"],
  ["Williamsbridge", "Bronx", "residential"],
  ["Co-op City", "Bronx", "residential"],
  ["Baychester", "Bronx", "residential"],
  ["St. George", "Staten Island", "waterfront"],
  ["Tompkinsville", "Staten Island", "residential"],
  ["Stapleton", "Staten Island", "historic"],
  ["West Brighton", "Staten Island", "residential"],
  ["Port Richmond", "Staten Island", "residential"],
  ["Mariners Harbor", "Staten Island", "residential"],
  ["New Brighton", "Staten Island", "historic"],
  ["Grymes Hill", "Staten Island", "suburban"],
  ["Todt Hill", "Staten Island", "suburban"],
  ["New Dorp", "Staten Island", "suburban"],
  ["Oakwood", "Staten Island", "suburban"],
  ["Great Kills", "Staten Island", "waterfront"],
  ["Eltingville", "Staten Island", "suburban"],
  ["Annadale", "Staten Island", "suburban"],
  ["Tottenville", "Staten Island", "suburban"],
  ["Rossville", "Staten Island", "suburban"],
  ["Westerleigh", "Staten Island", "suburban"],
  ["South Beach", "Staten Island", "beach"],
];

const blurbByName = new Map(HOOD_META.map((m) => [m.name, m.blurb]));

async function main() {
  let updated = 0;
  const missed: string[] = [];

  for (const [name, borough, vibe] of HOODS) {
    const blurb = blurbByName.get(name) ?? null;
    const result = await db
      .update(neighborhoodsTable)
      .set({
        photoUrl: `images/vibes/${vibe}.jpg`,
        blurb,
      })
      .where(
        and(
          eq(neighborhoodsTable.name, name),
          eq(neighborhoodsTable.borough, borough),
        ),
      )
      .returning({ id: neighborhoodsTable.id });

    if (result.length === 0) {
      missed.push(`${name} (${borough})`);
    } else {
      updated++;
    }
  }

  console.log(
    `Backfilled vibe photo + blurb for ${updated} neighborhoods.`,
  );
  if (missed.length > 0) {
    console.warn(`No matching row for: ${missed.join(", ")}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
