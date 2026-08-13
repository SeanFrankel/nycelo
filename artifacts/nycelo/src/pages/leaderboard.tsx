import { useState, useEffect } from "react"
import { useListTraits, useGetLeaderboard, getGetLeaderboardQueryKey } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Trophy, ArrowDown, MapPin, Loader2, SearchX, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocation } from "wouter"

const BOROUGHS = ["All", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]

export default function Leaderboard() {
  const [location, setLocation] = useLocation()
  
  // Parse URL params for initial state if possible, though wouter doesn't have useSearchParams
  // We'll just manage state locally and sync to URL if requested.
  const [selectedTrait, setSelectedTrait] = useState<string>("dining")
  const [selectedBorough, setSelectedBorough] = useState<string>("All")

  const { data: traits, isLoading: traitsLoading } = useListTraits()

  // Use useEffect to set selectedTrait to the first trait once loaded if "dining" doesn't exist
  useEffect(() => {
    if (traits && traits.length > 0) {
      if (!traits.find(t => t.slug === selectedTrait)) {
        setSelectedTrait(traits[0].slug)
      }
    }
  }, [traits, selectedTrait])

  const { data: leaderboard, isLoading: leaderboardLoading } = useGetLeaderboard(
    { 
      traitSlug: selectedTrait,
      borough: selectedBorough === "All" ? undefined : selectedBorough
    },
    {
      query: {
        enabled: !!selectedTrait,
        queryKey: getGetLeaderboardQueryKey({ 
          traitSlug: selectedTrait,
          borough: selectedBorough === "All" ? undefined : selectedBorough
        })
      }
    }
  )

  const activeTrait = traits?.find(t => t.slug === selectedTrait)

  return (
    <div className="flex-1 flex flex-col w-full bg-background relative z-10">
      {/* Header section */}
      <section className="border-b-4 border-border bg-mta-blue text-white pt-12 pb-16 px-4 md:px-6">
        <div className="container max-w-5xl mx-auto flex flex-col items-center text-center">
          <Trophy className="w-12 h-12 mb-4" />
          <h1 className="text-5xl md:text-7xl font-black font-display uppercase tracking-tighter mb-4" style={{ textShadow: '4px 4px 0px #1A1A1A' }}>
            The Standings
          </h1>
          <p className="font-mono text-lg font-bold text-blue-100 max-w-2xl">
            See who rules the roost. Global ELO ratings based on millions of head-to-head match-ups.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-30 border-b-4 border-border bg-background shadow-brutal-sm">
        <div className="container max-w-5xl mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          <div className="flex-1 w-full overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-2 min-w-max pb-1">
              {traitsLoading ? (
                <div className="h-10 w-full animate-pulse bg-secondary border-2 border-border" />
              ) : (
                traits?.map(trait => (
                  <button
                    key={trait.id}
                    onClick={() => setSelectedTrait(trait.slug)}
                    className={cn(
                      "px-4 py-2 font-mono font-bold text-sm border-2 border-border transition-all uppercase whitespace-nowrap",
                      selectedTrait === trait.slug 
                        ? "bg-primary text-primary-foreground shadow-brutal-sm translate-y-[-2px] translate-x-[-2px]" 
                        : "bg-white hover:bg-secondary text-foreground hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-brutal-sm"
                    )}
                  >
                    {trait.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="hidden md:block w-1 h-8 bg-border" />

          <div className="w-full md:w-auto overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-2 min-w-max pb-1">
              {BOROUGHS.map(borough => (
                <button
                  key={borough}
                  onClick={() => setSelectedBorough(borough)}
                  className={cn(
                    "px-3 py-1 font-mono font-bold text-xs border-2 border-border transition-all uppercase whitespace-nowrap rounded-full",
                    selectedBorough === borough 
                      ? "bg-foreground text-background shadow-brutal-sm translate-y-[-1px] translate-x-[-1px]" 
                      : "bg-white hover:bg-secondary text-foreground"
                  )}
                >
                  {borough}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard List */}
      <section className="flex-1 py-8 px-4 md:px-6 bg-background">
        <div className="container max-w-5xl mx-auto">
          {/* List Header */}
          <div className="flex items-center gap-4 text-xs font-mono font-bold uppercase text-muted-foreground border-b-4 border-border pb-4 mb-4 px-2">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Neighborhood</div>
            <div className="hidden md:flex items-center justify-center w-24">Games</div>
            <div className="hidden md:flex items-center justify-center w-32">W-L-D</div>
            <div className="w-20 text-right flex items-center justify-end gap-1 text-foreground">
              Rating <ArrowDown className="w-3 h-3" />
            </div>
          </div>

          {leaderboardLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <span className="font-mono font-bold uppercase">Crunching numbers...</span>
            </div>
          ) : !leaderboard || leaderboard.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <SearchX className="w-12 h-12 mb-4 text-muted-foreground" />
              <h3 className="font-display font-black text-2xl uppercase mb-2">No rankings yet</h3>
              <p className="font-mono text-muted-foreground max-w-md">
                There aren't enough votes for this category and borough combination. 
              </p>
              <Button onClick={() => setLocation("/rank")} className="mt-6">
                Start Voting
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.entries.map((entry, idx) => (
                <div 
                  key={entry.neighborhood.id}
                  onClick={() => setLocation(`/neighborhood/${entry.neighborhood.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setLocation(`/neighborhood/${entry.neighborhood.id}`)
                    }
                  }}
                  className={cn(
                    "animate-slide-up flex items-center gap-4 p-3 md:p-4 border-2 border-border bg-white transition-transform hover:-translate-y-1 hover:translate-x-1 hover:shadow-brutal-sm cursor-pointer",
                    idx === 0 ? "border-4 border-primary bg-primary/5 scale-[1.02] origin-left shadow-brutal" : "",
                    idx === 1 ? "border-4 border-mta-blue bg-mta-blue/5 shadow-brutal" : "",
                    idx === 2 ? "border-4 border-mta-yellow bg-mta-yellow/5 shadow-brutal" : ""
                  )}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="w-8 text-center font-display font-black text-xl md:text-2xl text-muted-foreground">
                    {entry.rank}
                  </div>
                  
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    {/* Small photo thumbnail for top 3 */}
                    {idx < 3 && entry.neighborhood.photoUrl && (
                      <div className="hidden md:block w-12 h-12 border-2 border-border overflow-hidden shrink-0">
                        <img 
                          src={import.meta.env.BASE_URL + entry.neighborhood.photoUrl} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <div className="font-display font-black text-lg md:text-xl uppercase tracking-tight flex items-center gap-2">
                        {entry.neighborhood.name}
                        {idx === 0 && <Flame className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {entry.neighborhood.borough}
                      </div>
                      {entry.neighborhood.blurb && (
                        <div className="font-mono text-[11px] md:text-xs text-muted-foreground mt-1 max-w-lg line-clamp-2 md:line-clamp-none">
                          {entry.neighborhood.blurb}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden md:flex w-24 flex-col items-center justify-center font-mono text-sm border-l-2 border-border pl-4">
                    <span className="font-bold">{entry.gamesPlayed}</span>
                  </div>

                  <div className="hidden md:flex w-32 items-center justify-center gap-1 font-mono text-xs font-bold border-l-2 border-border pl-4">
                    <span className="text-green-600">{entry.wins}</span>-
                    <span className="text-destructive">{entry.losses}</span>-
                    <span className="text-muted-foreground">{entry.draws}</span>
                  </div>

                  <div className="w-24 flex items-center justify-end font-display font-black text-xl md:text-2xl border-l-2 border-border pl-4 text-right">
                    {Math.round(entry.rating)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
