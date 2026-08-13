import { Router, type IRouter } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  db,
  neighborhoodsTable,
  traitsTable,
  ratingsTable,
  votesTable,
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
} from "@workspace/api-zod";
import { updateElo } from "../lib/elo";

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

  // Pick contender A at random, then prefer a similarly-rated opponent
  // (interesting duels), with a random fallback.
  const [a] = await db
    .select()
    .from(neighborhoodsTable)
    .orderBy(sql`random()`)
    .limit(1);
  if (!a) {
    res.status(404).json({ error: "No neighborhoods found" });
    return;
  }
  const ratingA = await getOrCreateRating(a.id, trait.id);

  const [b] = await db
    .select({ n: neighborhoodsTable })
    .from(neighborhoodsTable)
    .leftJoin(
      ratingsTable,
      and(
        eq(ratingsTable.neighborhoodId, neighborhoodsTable.id),
        eq(ratingsTable.traitId, trait.id),
      ),
    )
    .where(sql`${neighborhoodsTable.id} != ${a.id}`)
    .orderBy(
      sql`abs(coalesce(${ratingsTable.rating}, 1500) - ${ratingA.rating}) + random() * 120`,
    )
    .limit(1);
  if (!b) {
    res.status(404).json({ error: "Not enough neighborhoods for a matchup" });
    return;
  }
  const ratingB = await getOrCreateRating(b.n.id, trait.id);

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
        neighborhood: b.n,
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
  const { traitId, neighborhoodAId, neighborhoodBId, outcome } = parsed.data;
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
    });

    let newA = ratingA.rating;
    let newB = ratingB.rating;

    if (outcome !== "skip") {
      const scoreA = outcome === "a_wins" ? 1 : outcome === "b_wins" ? 0 : 0.5;
      const updated = updateElo(ratingA.rating, ratingB.rating, scoreA);
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
