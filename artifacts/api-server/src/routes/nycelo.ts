import { Router, type IRouter } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  db,
  neighborhoodsTable,
  traitsTable,
  ratingsTable,
  votesTable,
  votersTable,
  experienceTable,
} from "@workspace/db";
import {
  ListTraitsResponse,
  GetMatchupQueryParams,
  GetMatchupResponse,
  SubmitVoteBody,
  SubmitVoteResponse,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
  GetShowcaseResponse,
  GetStatsResponse,
  GetNeighborhoodQueryParams,
  GetNeighborhoodResponse,
  ListNeighborhoodsResponse,
  GetExperienceQueryParams,
  GetExperienceResponse,
  SubmitExperienceBody,
  SubmitExperienceResponse,
  SubmitCheckinBody,
  SubmitCheckinResponse,
} from "@workspace/api-zod";
import { updateElo } from "../lib/elo";
import {
  weightedSample,
  opponentWeight,
  contenderWeight,
} from "../lib/matchup";
import {
  clampAggregates,
  confidenceFor,
  voteWeight,
  toEntryShape,
} from "../lib/experience";

const router: IRouter = Router();

type TraitRow = typeof traitsTable.$inferSelect;

async function traitWithVotes(trait: TraitRow) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votesTable)
    .where(
      and(eq(votesTable.traitId, trait.id), sql`${votesTable.outcome} != 'skip'`),
    );
  return { ...trait, totalVotes: row?.count ?? 0 };
}

async function getOrCreateRating(neighborhoodId: number, traitId: number) {
  const [existing] = await db
    .select()
    .from(ratingsTable)
    .where(
      and(
        eq(ratingsTable.neighborhoodId, neighborhoodId),
        eq(ratingsTable.traitId, traitId),
      ),
    );
  if (existing) return existing;
  const [created] = await db
    .insert(ratingsTable)
    .values({ neighborhoodId, traitId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(ratingsTable)
    .where(
      and(
        eq(ratingsTable.neighborhoodId, neighborhoodId),
        eq(ratingsTable.traitId, traitId),
      ),
    );
  return again!;
}

async function rankOf(traitId: number, rating: number): Promise<number | null> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ratingsTable)
    .where(
      and(eq(ratingsTable.traitId, traitId), sql`${ratingsTable.rating} > ${rating}`),
    );
  return (row?.count ?? 0) + 1;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Lightweight in-memory rate limiting for the self-attested evidence
 * endpoints. Experience aggregates are inherently self-attested (files are
 * parsed client-side by design — raw data never leaves the device), so the
 * server can't prove them; these limits blunt bulk forgery and replay,
 * and the 2.0x weight ceiling bounds the damage any one voter can do.
 */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

// Periodic sweep so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt < now) rateBuckets.delete(key);
  }
}, 60_000).unref();

/** Per voter+neighborhood check-in cooldown (30 min). */
const CHECKIN_COOLDOWN_MS = 30 * 60 * 1000;
const lastCheckin = new Map<string, number>();

async function getOrCreateVoter(token: string) {
  const [existing] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.token, token));
  if (existing) return existing;
  const [created] = await db
    .insert(votersTable)
    .values({ token })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.token, token));
  return again!;
}

async function experienceEntriesFor(voterId: number) {
  const rows = await db
    .select({ e: experienceTable, n: neighborhoodsTable })
    .from(experienceTable)
    .innerJoin(
      neighborhoodsTable,
      eq(experienceTable.neighborhoodId, neighborhoodsTable.id),
    )
    .where(eq(experienceTable.voterId, voterId));
  return rows
    .map((row) => toEntryShape(row.e, row.n))
    .sort((x, y) => y.confidence - x.confidence);
}

router.get("/traits", async (_req, res): Promise<void> => {
  const traits = await db.select().from(traitsTable).orderBy(traitsTable.id);
  const enriched = await Promise.all(traits.map(traitWithVotes));
  res.json(ListTraitsResponse.parse(enriched));
});

router.get("/matchup", async (req, res): Promise<void> => {
  const query = GetMatchupQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let trait: TraitRow | undefined;
  if (query.data.traitSlug) {
    [trait] = await db
      .select()
      .from(traitsTable)
      .where(eq(traitsTable.slug, query.data.traitSlug));
  } else {
    [trait] = await db
      .select()
      .from(traitsTable)
      .orderBy(sql`random()`)
      .limit(1);
  }
  if (!trait) {
    res.status(404).json({ error: "No trait found" });
    return;
  }

  const allHoods = await db.select().from(neighborhoodsTable);
  if (allHoods.length < 2) {
    res.status(404).json({ error: "Not enough neighborhoods for a matchup" });
    return;
  }
  const byId = new Map(allHoods.map((h) => [h.id, h]));

  // Ratings for this trait (missing rows imply the 1500 default).
  const traitRatings = await db
    .select({
      neighborhoodId: ratingsTable.neighborhoodId,
      rating: ratingsTable.rating,
    })
    .from(ratingsTable)
    .where(eq(ratingsTable.traitId, trait.id));
  const ratingOf = new Map(
    traitRatings.map((r) => [r.neighborhoodId, r.rating]),
  );
  const rating = (id: number) => ratingOf.get(id) ?? 1500;

  // ---- Personalized onboarding: a new voter's first 3 matchups anchor
  // on where they are right now vs where they've been (experience
  // record), falling back to popular neighborhoods.
  let a: (typeof allHoods)[number] | null = null;
  let b: (typeof allHoods)[number] | null = null;

  const { voterToken, anchorNeighborhoodId } = query.data;
  if (voterToken && TOKEN_RE.test(voterToken)) {
    const [voter] = await db
      .select()
      .from(votersTable)
      .where(eq(votersTable.token, voterToken));
    const [voteCountRow] = voter
      ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(votesTable)
          .where(
            and(
              eq(votesTable.voterId, voter.id),
              sql`${votesTable.outcome} != 'skip'`,
            ),
          )
      : [{ count: 0 }];

    if ((voteCountRow?.count ?? 0) < 3) {
      const popular = allHoods.filter((h) => h.popularity >= 4);
      const anchor = anchorNeighborhoodId
        ? (byId.get(anchorNeighborhoodId) ?? null)
        : null;

      // Neighborhoods the voter has proven experience in (visited before).
      const visited: (typeof allHoods)[number][] = [];
      if (voter) {
        const evidence = await db
          .select({ neighborhoodId: experienceTable.neighborhoodId })
          .from(experienceTable)
          .where(eq(experienceTable.voterId, voter.id));
        for (const row of evidence) {
          const hood = byId.get(row.neighborhoodId);
          if (hood) visited.push(hood);
        }
      }

      // Anchor priority: current location, else a neighborhood they've
      // been to before; famous-vs-famous only when neither exists.
      const personalAnchor =
        anchor ?? weightedSample(visited, (h) => contenderWeight(h));

      if (personalAnchor) {
        a = personalAnchor;
        const beenBefore = visited.filter((h) => h.id !== personalAnchor.id);
        const pool = beenBefore.length
          ? beenBefore
          : popular.filter((h) => h.id !== personalAnchor.id);
        b = weightedSample(pool, (h) =>
          opponentWeight(personalAnchor, h, rating(personalAnchor.id), rating(h.id)),
        );
      } else if (popular.length >= 2) {
        // No location: famous-vs-famous duels everyone has an opinion on.
        a = weightedSample(popular, (h) => contenderWeight(h));
        if (a) {
          const aHood = a;
          b = weightedSample(
            popular.filter((h) => h.id !== aHood.id),
            (h) => opponentWeight(aHood, h, rating(aHood.id), rating(h.id)),
          );
        }
      }
    }
  }

  // ---- Regular fun algorithm: popularity-weighted contender, opponent
  // weighted by proximity x popularity x rating closeness (+ wildcard).
  if (!a || !b) {
    const picked = weightedSample(allHoods, (h) => contenderWeight(h));
    if (picked) {
      a = picked;
      b = weightedSample(
        allHoods.filter((h) => h.id !== picked.id),
        (h) => opponentWeight(picked, h, rating(picked.id), rating(h.id)),
      );
    }
  }
  if (!a || !b) {
    res.status(404).json({ error: "Not enough neighborhoods for a matchup" });
    return;
  }

  const ratingA = await getOrCreateRating(a.id, trait.id);
  const ratingB = await getOrCreateRating(b.id, trait.id);

  const enrichedTrait = await traitWithVotes(trait);
  res.json(
    GetMatchupResponse.parse({
      trait: enrichedTrait,
      a: {
        neighborhood: a,
        rating: ratingA.rating,
        rank: await rankOf(trait.id, ratingA.rating),
        gamesPlayed: ratingA.gamesPlayed,
      },
      b: {
        neighborhood: b,
        rating: ratingB.rating,
        rank: await rankOf(trait.id, ratingB.rating),
        gamesPlayed: ratingB.gamesPlayed,
      },
    }),
  );
});

router.post("/votes", async (req, res): Promise<void> => {
  const parsed = SubmitVoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { traitId, neighborhoodAId, neighborhoodBId, outcome, voterToken } =
    parsed.data;
  if (neighborhoodAId === neighborhoodBId) {
    res.status(400).json({ error: "A matchup needs two different neighborhoods" });
    return;
  }

  const [trait] = await db
    .select()
    .from(traitsTable)
    .where(eq(traitsTable.id, traitId));
  const [na] = await db
    .select()
    .from(neighborhoodsTable)
    .where(eq(neighborhoodsTable.id, neighborhoodAId));
  const [nb] = await db
    .select()
    .from(neighborhoodsTable)
    .where(eq(neighborhoodsTable.id, neighborhoodBId));
  if (!trait || !na || !nb) {
    res.status(400).json({ error: "Unknown trait or neighborhood" });
    return;
  }

  // Resolve voter + experience-based weight (default 0.25 floor weight
  // comes from zero confidence; unidentified voters get the same floor).
  let voterId: number | null = null;
  let confA = 0;
  let confB = 0;
  if (voterToken && TOKEN_RE.test(voterToken)) {
    const voter = await getOrCreateVoter(voterToken);
    voterId = voter.id;
    const evidence = await db
      .select()
      .from(experienceTable)
      .where(
        and(
          eq(experienceTable.voterId, voter.id),
          sql`${experienceTable.neighborhoodId} in (${neighborhoodAId}, ${neighborhoodBId})`,
        ),
      );
    for (const row of evidence) {
      const conf = confidenceFor(row);
      if (row.neighborhoodId === neighborhoodAId) confA = conf;
      if (row.neighborhoodId === neighborhoodBId) confB = conf;
    }
  }
  const weight = voteWeight(confA, confB);

  // Ensure rating rows exist before entering the transaction.
  await getOrCreateRating(neighborhoodAId, traitId);
  await getOrCreateRating(neighborhoodBId, traitId);

  const result = await db.transaction(async (tx) => {
    // Lock both rating rows (in a stable order to avoid deadlocks) so
    // concurrent votes on the same pair serialize instead of clobbering
    // each other's rating/counter updates.
    const [firstId, secondId] = [neighborhoodAId, neighborhoodBId].sort(
      (x, y) => x - y,
    );
    const locked = await tx
      .select()
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.traitId, traitId),
          sql`${ratingsTable.neighborhoodId} in (${firstId}, ${secondId})`,
        ),
      )
      .for("update");
    const ratingA = locked.find((r) => r.neighborhoodId === neighborhoodAId)!;
    const ratingB = locked.find((r) => r.neighborhoodId === neighborhoodBId)!;

    await tx.insert(votesTable).values({
      traitId,
      neighborhoodAId,
      neighborhoodBId,
      outcome,
      voterId,
      weight,
    });

    let newA = ratingA.rating;
    let newB = ratingB.rating;

    if (outcome !== "skip") {
      const scoreA = outcome === "a_wins" ? 1 : outcome === "b_wins" ? 0 : 0.5;
      const updated = updateElo(ratingA.rating, ratingB.rating, scoreA, weight);
      newA = updated.newA;
      newB = updated.newB;

      await tx
        .update(ratingsTable)
        .set({
          rating: newA,
          gamesPlayed: ratingA.gamesPlayed + 1,
          wins: ratingA.wins + (outcome === "a_wins" ? 1 : 0),
          losses: ratingA.losses + (outcome === "b_wins" ? 1 : 0),
          draws: ratingA.draws + (outcome === "draw" ? 1 : 0),
        })
        .where(eq(ratingsTable.id, ratingA.id));
      await tx
        .update(ratingsTable)
        .set({
          rating: newB,
          gamesPlayed: ratingB.gamesPlayed + 1,
          wins: ratingB.wins + (outcome === "b_wins" ? 1 : 0),
          losses: ratingB.losses + (outcome === "a_wins" ? 1 : 0),
          draws: ratingB.draws + (outcome === "draw" ? 1 : 0),
        })
        .where(eq(ratingsTable.id, ratingB.id));
    }

    return { ratingA, ratingB, newA, newB };
  });

  const { ratingA, ratingB, newA, newB } = result;
  const oldRankA = await rankOf(traitId, ratingA.rating);
  const oldRankB = await rankOf(traitId, ratingB.rating);

  res.json(
    SubmitVoteResponse.parse({
      recorded: outcome !== "skip",
      appliedWeight: weight,
      a: {
        neighborhoodId: neighborhoodAId,
        name: na.name,
        oldRating: ratingA.rating,
        newRating: newA,
        oldRank: oldRankA,
        newRank: await rankOf(traitId, newA),
      },
      b: {
        neighborhoodId: neighborhoodBId,
        name: nb.name,
        oldRating: ratingB.rating,
        newRating: newB,
        oldRank: oldRankB,
        newRank: await rankOf(traitId, newB),
      },
    }),
  );
});

router.get("/leaderboard", async (req, res): Promise<void> => {
  const query = GetLeaderboardQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const [trait] = await db
    .select()
    .from(traitsTable)
    .where(eq(traitsTable.slug, query.data.traitSlug));
  if (!trait) {
    res.status(404).json({ error: "Trait not found" });
    return;
  }

  const conditions = [eq(ratingsTable.traitId, trait.id)];
  if (query.data.borough) {
    conditions.push(eq(neighborhoodsTable.borough, query.data.borough));
  }

  const rows = await db
    .select({ r: ratingsTable, n: neighborhoodsTable })
    .from(ratingsTable)
    .innerJoin(
      neighborhoodsTable,
      eq(ratingsTable.neighborhoodId, neighborhoodsTable.id),
    )
    .where(and(...conditions))
    .orderBy(desc(ratingsTable.rating))
    .limit(query.data.limit ?? 250);

  res.json(
    GetLeaderboardResponse.parse({
      trait: await traitWithVotes(trait),
      entries: rows.map((row, i) => ({
        rank: i + 1,
        neighborhood: row.n,
        rating: row.r.rating,
        gamesPlayed: row.r.gamesPlayed,
        wins: row.r.wins,
        losses: row.r.losses,
        draws: row.r.draws,
      })),
    }),
  );
});

router.get("/neighborhood", async (req, res): Promise<void> => {
  const query = GetNeighborhoodQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const [neighborhood] = await db
    .select()
    .from(neighborhoodsTable)
    .where(eq(neighborhoodsTable.id, query.data.id));
  if (!neighborhood) {
    res.status(404).json({ error: "Neighborhood not found" });
    return;
  }

  const traits = await db.select().from(traitsTable).orderBy(traitsTable.id);
  // Read-only: never insert rating rows from a GET — that would make
  // unvoted neighborhoods appear on leaderboards just by being viewed.
  const existingRatings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.neighborhoodId, neighborhood.id));
  const ratingByTrait = new Map(existingRatings.map((r) => [r.traitId, r]));

  const traitRankings = await Promise.all(
    traits.map(async (trait) => {
      const rating = ratingByTrait.get(trait.id);
      const [total] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ratingsTable)
        .where(eq(ratingsTable.traitId, trait.id));
      return {
        trait: await traitWithVotes(trait),
        rating: rating?.rating ?? 1500,
        // Rank matches leaderboard semantics: a neighborhood is ranked
        // iff it has a rating row for the trait (same rows the
        // leaderboard lists, ordered by rating desc).
        rank: rating ? await rankOf(trait.id, rating.rating) : null,
        totalRanked: total?.count ?? 0,
        gamesPlayed: rating?.gamesPlayed ?? 0,
        wins: rating?.wins ?? 0,
        losses: rating?.losses ?? 0,
        draws: rating?.draws ?? 0,
      };
    }),
  );

  res.json(GetNeighborhoodResponse.parse({ neighborhood, traitRankings }));
});

router.get("/neighborhoods", async (_req, res): Promise<void> => {
  const hoods = await db
    .select()
    .from(neighborhoodsTable)
    .orderBy(neighborhoodsTable.name);
  res.json(ListNeighborhoodsResponse.parse(hoods));
});

router.get("/experience", async (req, res): Promise<void> => {
  const query = GetExperienceQueryParams.safeParse(req.query);
  if (!query.success || !TOKEN_RE.test(query.data.voterToken)) {
    res.status(400).json({ error: "Invalid voter token" });
    return;
  }
  const [voter] = await db
    .select()
    .from(votersTable)
    .where(eq(votersTable.token, query.data.voterToken));
  if (!voter) {
    res.json(GetExperienceResponse.parse({ entries: [] }));
    return;
  }
  res.json(
    GetExperienceResponse.parse({
      entries: await experienceEntriesFor(voter.id),
    }),
  );
});

router.post("/experience", async (req, res): Promise<void> => {
  const parsed = SubmitExperienceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { voterToken, entries } = parsed.data;
  if (!TOKEN_RE.test(voterToken)) {
    res.status(400).json({ error: "Invalid voter token" });
    return;
  }
  if (entries.length > 500) {
    res.status(400).json({ error: "Too many entries in one submission" });
    return;
  }
  if (
    rateLimited(`exp:${voterToken}`, 10, 60 * 60 * 1000) ||
    rateLimited(`exp-ip:${req.ip}`, 30, 60 * 60 * 1000)
  ) {
    res.status(429).json({ error: "Too many imports — try again later" });
    return;
  }

  const voter = await getOrCreateVoter(voterToken);

  for (const entry of entries) {
    const clamped = clampAggregates(entry);
    const [hood] = await db
      .select({ id: neighborhoodsTable.id })
      .from(neighborhoodsTable)
      .where(eq(neighborhoodsTable.id, entry.neighborhoodId));
    if (!hood) continue;
    // Merge with greatest() so re-importing the same file is idempotent
    // rather than double-counting.
    await db
      .insert(experienceTable)
      .values({ voterId: voter.id, neighborhoodId: hood.id, ...clamped })
      .onConflictDoUpdate({
        target: [experienceTable.voterId, experienceTable.neighborhoodId],
        set: {
          visits: sql`greatest(${experienceTable.visits}, ${clamped.visits})`,
          hours: sql`greatest(${experienceTable.hours}, ${clamped.hours})`,
          photos: sql`greatest(${experienceTable.photos}, ${clamped.photos})`,
          activities: sql`greatest(${experienceTable.activities}, ${clamped.activities})`,
          updatedAt: sql`now()`,
        },
      });
  }

  res.json(
    SubmitExperienceResponse.parse({
      entries: await experienceEntriesFor(voter.id),
    }),
  );
});

router.post("/checkin", async (req, res): Promise<void> => {
  const parsed = SubmitCheckinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { voterToken, lat, lng } = parsed.data;
  if (!TOKEN_RE.test(voterToken)) {
    res.status(400).json({ error: "Invalid voter token" });
    return;
  }

  // Nearest neighborhood within ~2km (matches client-side matching cap).
  const [nearest] = await db
    .select({
      n: neighborhoodsTable,
      dist: sql<number>`
        6371 * 2 * asin(sqrt(
          pow(sin(radians((${neighborhoodsTable.lat} - ${lat}) / 2)), 2) +
          cos(radians(${lat})) * cos(radians(${neighborhoodsTable.lat})) *
          pow(sin(radians((${neighborhoodsTable.lng} - ${lng}) / 2)), 2)
        ))`.as("dist"),
    })
    .from(neighborhoodsTable)
    .orderBy(sql`dist`)
    .limit(1);
  if (!nearest || nearest.dist > 2) {
    res
      .status(400)
      .json({ error: "You don't seem to be in any NYC neighborhood we know" });
    return;
  }

  if (rateLimited(`chk-ip:${req.ip}`, 20, 60 * 60 * 1000)) {
    res.status(429).json({ error: "Too many check-ins — try again later" });
    return;
  }
  const cooldownKey = `${voterToken}:${nearest.n.id}`;
  const last = lastCheckin.get(cooldownKey);
  if (last && Date.now() - last < CHECKIN_COOLDOWN_MS) {
    res.status(429).json({
      error: "Already checked in here recently — come back in a bit",
    });
    return;
  }
  lastCheckin.set(cooldownKey, Date.now());

  const voter = await getOrCreateVoter(voterToken);
  await db
    .insert(experienceTable)
    .values({ voterId: voter.id, neighborhoodId: nearest.n.id, checkins: 1 })
    .onConflictDoUpdate({
      target: [experienceTable.voterId, experienceTable.neighborhoodId],
      set: {
        checkins: sql`least(${experienceTable.checkins} + 1, 1000)`,
        updatedAt: sql`now()`,
      },
    });

  const [row] = await db
    .select()
    .from(experienceTable)
    .where(
      and(
        eq(experienceTable.voterId, voter.id),
        eq(experienceTable.neighborhoodId, nearest.n.id),
      ),
    );
  res.json(
    SubmitCheckinResponse.parse({
      neighborhood: nearest.n,
      entry: toEntryShape(row!, nearest.n),
    }),
  );
});

router.get("/showcase", async (_req, res): Promise<void> => {
  const traits = await db.select().from(traitsTable).orderBy(traitsTable.id);
  const entries = [];
  for (const trait of traits) {
    const [top] = await db
      .select({ r: ratingsTable, n: neighborhoodsTable })
      .from(ratingsTable)
      .innerJoin(
        neighborhoodsTable,
        eq(ratingsTable.neighborhoodId, neighborhoodsTable.id),
      )
      .where(
        and(eq(ratingsTable.traitId, trait.id), sql`${ratingsTable.gamesPlayed} > 0`),
      )
      .orderBy(desc(ratingsTable.rating))
      .limit(1);
    entries.push({
      trait: await traitWithVotes(trait),
      topNeighborhood: top ? top.n : null,
      rating: top ? top.r.rating : null,
      gamesPlayed: top ? top.r.gamesPlayed : null,
    });
  }
  res.json(GetShowcaseResponse.parse(entries));
});

router.get("/stats", async (_req, res): Promise<void> => {
  const [votes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(votesTable)
    .where(sql`${votesTable.outcome} != 'skip'`);
  const [hoods] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(neighborhoodsTable);
  const [traits] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(traitsTable);
  res.json(
    GetStatsResponse.parse({
      totalVotes: votes?.count ?? 0,
      totalNeighborhoods: hoods?.count ?? 0,
      totalTraits: traits?.count ?? 0,
    }),
  );
});

export default router;
