import { useGetNeighborhood, getGetNeighborhoodQueryKey } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { SingleMap } from "@/components/Map"
import { ArrowLeft, MapPin, Loader2, Trophy, Medal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocation, useParams } from "wouter"

export default function NeighborhoodDetail() {
  const params = useParams<{ id: string }>()
  const [, setLocation] = useLocation()
  const id = Number(params.id)

  const { data, isLoading, isError } = useGetNeighborhood(
    { id },
    {
      query: {
        enabled: Number.isFinite(id),
        queryKey: getGetNeighborhoodQueryKey({ id }),
      },
    }
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
        <span className="font-mono font-bold uppercase">Loading neighborhood...</span>
      </div>
    )
  }

  if (isError || !data || !Number.isFinite(id)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 text-center px-4">
        <h2 className="font-display font-black text-3xl uppercase mb-2">Neighborhood not found</h2>
        <p className="font-mono text-muted-foreground mb-6">We couldn't find that neighborhood.</p>
        <Button onClick={() => setLocation("/leaderboard")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to standings
        </Button>
      </div>
    )
  }

  const { neighborhood, traitRankings } = data

  // Best ranks first for the highlights strip
  const ranked = traitRankings.filter(t => t.rank != null)
  const bestTraits = [...ranked].sort((a, b) => (a.rank! - b.rank!)).slice(0, 3)

  return (
    <div className="flex-1 flex flex-col w-full bg-background relative z-10">
      {/* Hero */}
      <section className="border-b-4 border-border bg-mta-blue text-white pt-10 pb-12 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto">
          <button
            onClick={() => setLocation("/leaderboard")}
            className="inline-flex items-center gap-2 font-mono font-bold text-sm uppercase bg-white text-foreground border-2 border-border px-3 py-1.5 shadow-brutal-sm hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none transition-all mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Standings
          </button>
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {neighborhood.photoUrl && (
              <div className="w-full md:w-64 h-44 border-4 border-border shadow-brutal overflow-hidden bg-white shrink-0">
                <img
                  src={import.meta.env.BASE_URL + neighborhood.photoUrl}
                  alt={neighborhood.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-4xl md:text-6xl font-black font-display uppercase tracking-tighter" style={{ textShadow: '4px 4px 0px #1A1A1A' }}>
                {neighborhood.name}
              </h1>
              <div className="font-mono font-bold text-blue-100 flex items-center gap-1 mt-2 uppercase">
                <MapPin className="w-4 h-4" /> {neighborhood.borough}
              </div>
              {neighborhood.blurb && (
                <p className="font-mono text-sm text-blue-100 mt-3 max-w-2xl">{neighborhood.blurb}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="flex-1 py-8 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {/* Trait rankings table */}
          <div className="md:col-span-2">
            <h2 className="font-display font-black text-2xl uppercase tracking-tight mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" /> Rankings by category
            </h2>

            {bestTraits.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {bestTraits.map(t => (
                  <div key={t.trait.id} className="inline-flex items-center gap-1 bg-mta-yellow border-2 border-border px-3 py-1 font-mono font-bold text-xs uppercase shadow-brutal-sm">
                    <Medal className="w-3 h-3" /> #{t.rank} in {t.trait.name}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs font-mono font-bold uppercase text-muted-foreground border-b-4 border-border pb-3 mb-3 px-2">
              <div className="flex-1">Category</div>
              <div className="w-20 text-center">Rank</div>
              <div className="hidden md:block w-28 text-center">W-L-D</div>
              <div className="w-20 text-right">Rating</div>
            </div>

            <div className="space-y-2">
              {traitRankings.map((t, idx) => (
                <div
                  key={t.trait.id}
                  className={cn(
                    "animate-slide-up flex items-center gap-4 p-3 border-2 border-border bg-white",
                    t.rank != null && t.rank <= 3 ? "border-4 border-primary bg-primary/5" : ""
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex-1">
                    <div className="font-display font-black uppercase tracking-tight">
                      {t.trait.name}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {t.trait.description}
                    </div>
                  </div>
                  <div className="w-20 text-center font-display font-black text-xl">
                    {t.rank != null ? (
                      <>
                        #{t.rank}
                        <span className="text-xs text-muted-foreground font-mono font-bold"> /{t.totalRanked}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm font-mono">—</span>
                    )}
                  </div>
                  <div className="hidden md:flex w-28 items-center justify-center gap-1 font-mono text-xs font-bold border-l-2 border-border pl-4">
                    <span className="text-green-600">{t.wins}</span>-
                    <span className="text-destructive">{t.losses}</span>-
                    <span className="text-muted-foreground">{t.draws}</span>
                  </div>
                  <div className="w-20 text-right font-display font-black text-xl border-l-2 border-border pl-4">
                    {Math.round(t.rating)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div>
            <h2 className="font-display font-black text-2xl uppercase tracking-tight mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-mta-blue" /> On the map
            </h2>
            <div className="border-4 border-border shadow-brutal h-80 bg-white">
              <SingleMap point={{ lat: neighborhood.lat, lng: neighborhood.lng, name: neighborhood.name }} />
            </div>
            <Button onClick={() => setLocation("/rank")} className="w-full mt-6">
              Vote on {neighborhood.name}'s fate
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
