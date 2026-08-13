import { useState, useEffect } from "react"
import { useGetMatchup, useSubmitVote, getGetMatchupQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { DualMap } from "@/components/Map"
import { Loader2, AlertCircle, ArrowRight, SkipForward } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Rank() {
  const queryClient = useQueryClient()
  
  // Need a state to show the result briefly before loading next
  const [result, setResult] = useState<{
    aWins: boolean,
    bWins: boolean,
    draw: boolean,
    aRatingChange: number,
    bRatingChange: number
  } | null>(null)
  
  const [isTransitioning, setIsTransitioning] = useState(false)

  const { data: matchup, isLoading, isError, refetch } = useGetMatchup(undefined, {
    query: {
      refetchOnWindowFocus: false,
      queryKey: getGetMatchupQueryKey()
    }
  })

  const submitVote = useSubmitVote()

  const handleVote = (outcome: "a_wins" | "b_wins" | "draw" | "skip") => {
    if (!matchup) return

    setIsTransitioning(true)

    submitVote.mutate(
      {
        data: {
          traitId: matchup.trait.id,
          neighborhoodAId: matchup.a.neighborhood.id,
          neighborhoodBId: matchup.b.neighborhood.id,
          outcome,
        }
      },
      {
        onSuccess: (voteResult) => {
          if (outcome === "skip") {
            // Skips go straight to next
            queryClient.invalidateQueries({ queryKey: getGetMatchupQueryKey() })
            setIsTransitioning(false)
          } else {
            // Show result briefly
            setResult({
              aWins: outcome === "a_wins",
              bWins: outcome === "b_wins",
              draw: outcome === "draw",
              aRatingChange: voteResult.a.newRating - voteResult.a.oldRating,
              bRatingChange: voteResult.b.newRating - voteResult.b.oldRating,
            })
            
            setTimeout(() => {
              setResult(null)
              queryClient.invalidateQueries({ queryKey: getGetMatchupQueryKey() })
              setIsTransitioning(false)
            }, 2000)
          }
        },
        onError: () => {
          // If error, just move on or show toast (ignoring for now, just reset)
          setIsTransitioning(false)
        }
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <span className="font-mono font-bold uppercase tracking-widest text-sm">Finding Contenders...</span>
        </div>
      </div>
    )
  }

  if (isError || !matchup) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <div className="brutal-card p-8 text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="font-display font-black text-2xl uppercase mb-2">No Matchups</h2>
          <p className="font-mono text-muted-foreground mb-6">We ran out of neighborhoods or something went wrong.</p>
          <Button onClick={() => refetch()} className="w-full">Try Again</Button>
        </div>
      </div>
    )
  }

  const { a, b, trait } = matchup

  return (
    <div className="flex-1 flex flex-col md:flex-row relative bg-background">
      
      {/* Header for mobile - floats over map */}
      <div className="absolute top-4 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="bg-background border-4 border-border shadow-brutal px-6 py-3 text-center pointer-events-auto max-w-md">
          <h1 className="font-display font-black uppercase text-xl sm:text-2xl md:text-3xl leading-none tracking-tight">
            Which is better for <span className="text-primary">{trait.name}?</span>
          </h1>
          {trait.description && (
            <p className="font-mono text-xs md:text-sm text-muted-foreground mt-2 font-bold">
              {trait.description}
            </p>
          )}
        </div>
      </div>

      {/* Contender A (Left) */}
      <div className="flex-1 flex flex-col relative min-h-[50vh] md:min-h-0 border-b-4 md:border-b-0 md:border-r-4 border-border">
        {/* Background Photo */}
        <div className="absolute inset-0 z-0 bg-secondary overflow-hidden">
          {a.neighborhood.photoUrl ? (
            <img 
              src={import.meta.env.BASE_URL + a.neighborhood.photoUrl} 
              alt={a.neighborhood.name}
              className="w-full h-full object-cover opacity-60 mix-blend-multiply" 
            />
          ) : (
            <div className="w-full h-full pattern-dots opacity-20"></div>
          )}
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-end p-6 md:p-12 bg-gradient-to-t from-background/90 to-transparent">
          <div className="mb-4">
            <span className="inline-block bg-primary text-primary-foreground font-mono font-bold px-2 py-1 text-xs uppercase border-2 border-border mb-2 shadow-brutal-sm">
              {a.neighborhood.borough}
            </span>
            <h2 className="font-display font-black text-5xl md:text-7xl uppercase tracking-tighter leading-none mb-2 text-foreground" style={{ textShadow: '2px 2px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white, 1px 1px 0px white' }}>
              {a.neighborhood.name}
            </h2>
            {a.neighborhood.blurb && (
              <p className="font-mono text-xs md:text-sm font-bold text-foreground bg-background/80 border-2 border-border px-2 py-1 inline-block max-w-md">
                {a.neighborhood.blurb}
              </p>
            )}
          </div>
          
          <Button 
            size="lg" 
            className="w-full text-xl h-20 shadow-brutal hover:shadow-brutal-lg border-4 text-white hover:bg-primary/90 disabled:opacity-100"
            disabled={isTransitioning}
            onClick={() => handleVote("a_wins")}
          >
            VOTE {a.neighborhood.name.toUpperCase()}
          </Button>
          
          {/* Result Overlay */}
          {result && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center backdrop-blur-sm z-30 transition-opacity duration-300",
              result.aWins ? "bg-primary/20" : result.bWins ? "bg-black/50" : "bg-black/20"
            )}>
              <div className={cn(
                "brutal-card p-6 text-center transform transition-transform duration-500 scale-100",
                result.aWins ? "border-primary bg-white text-primary" : "bg-background"
              )}>
                <span className="font-display font-black text-4xl block mb-2">
                  {result.aWins ? "WINNER" : result.draw ? "DRAW" : "LOSER"}
                </span>
                <span className="font-mono text-2xl font-bold flex items-center justify-center gap-2">
                  {a.rating} <ArrowRight className="w-5 h-5" /> {a.rating + result.aRatingChange}
                </span>
                <span className={cn(
                  "font-mono font-bold text-sm block mt-2",
                  result.aRatingChange > 0 ? "text-green-600" : "text-destructive"
                )}>
                  {result.aRatingChange > 0 ? "+" : ""}{Math.round(result.aRatingChange)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Divider (Middle) */}
      <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 w-64 h-64 brutal-card overflow-hidden">
        <DualMap a={a.neighborhood} b={b.neighborhood} />
        
        {/* VS Badge */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-background border-4 border-border shadow-brutal px-4 py-2 font-display font-black text-4xl uppercase -rotate-12 pointer-events-none">
          VS
        </div>
      </div>
      
      {/* Mobile Map */}
      <div className="md:hidden h-48 border-b-4 border-border relative z-10 bg-secondary">
        <DualMap a={a.neighborhood} b={b.neighborhood} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-background border-4 border-border shadow-brutal px-3 py-1 font-display font-black text-2xl uppercase -rotate-12 pointer-events-none">
          VS
        </div>
      </div>

      {/* Contender B (Right) */}
      <div className="flex-1 flex flex-col relative min-h-[50vh] md:min-h-0">
        {/* Background Photo */}
        <div className="absolute inset-0 z-0 bg-secondary overflow-hidden">
          {b.neighborhood.photoUrl ? (
            <img 
              src={import.meta.env.BASE_URL + b.neighborhood.photoUrl} 
              alt={b.neighborhood.name}
              className="w-full h-full object-cover opacity-60 mix-blend-multiply" 
            />
          ) : (
            <div className="w-full h-full pattern-dots opacity-20"></div>
          )}
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-end p-6 md:p-12 bg-gradient-to-t from-background/90 to-transparent">
          <div className="mb-4 md:text-right">
            <span className="inline-block bg-mta-blue text-white font-mono font-bold px-2 py-1 text-xs uppercase border-2 border-border mb-2 shadow-brutal-sm">
              {b.neighborhood.borough}
            </span>
            <h2 className="font-display font-black text-5xl md:text-7xl uppercase tracking-tighter leading-none mb-2 text-foreground" style={{ textShadow: '2px 2px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white, 1px 1px 0px white' }}>
              {b.neighborhood.name}
            </h2>
            {b.neighborhood.blurb && (
              <p className="font-mono text-xs md:text-sm font-bold text-foreground bg-background/80 border-2 border-border px-2 py-1 inline-block max-w-md">
                {b.neighborhood.blurb}
              </p>
            )}
          </div>
          
          <Button 
            size="lg" 
            className="w-full text-xl h-20 shadow-brutal hover:shadow-brutal-lg border-4 bg-mta-blue text-white hover:bg-mta-blue/90 disabled:opacity-100"
            disabled={isTransitioning}
            onClick={() => handleVote("b_wins")}
          >
            VOTE {b.neighborhood.name.toUpperCase()}
          </Button>

          {/* Result Overlay */}
          {result && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center backdrop-blur-sm z-30 transition-opacity duration-300",
              result.bWins ? "bg-mta-blue/20" : result.aWins ? "bg-black/50" : "bg-black/20"
            )}>
              <div className={cn(
                "brutal-card p-6 text-center transform transition-transform duration-500 scale-100",
                result.bWins ? "border-mta-blue bg-white text-mta-blue" : "bg-background"
              )}>
                <span className="font-display font-black text-4xl block mb-2">
                  {result.bWins ? "WINNER" : result.draw ? "DRAW" : "LOSER"}
                </span>
                <span className="font-mono text-2xl font-bold flex items-center justify-center gap-2 text-foreground">
                  {b.rating} <ArrowRight className="w-5 h-5" /> {b.rating + result.bRatingChange}
                </span>
                <span className={cn(
                  "font-mono font-bold text-sm block mt-2",
                  result.bRatingChange > 0 ? "text-green-600" : "text-destructive"
                )}>
                  {result.bRatingChange > 0 ? "+" : ""}{Math.round(result.bRatingChange)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar (Bottom Center) */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-2">
        <Button 
          variant="secondary" 
          onClick={() => handleVote("draw")}
          disabled={isTransitioning}
          className="rounded-full shadow-brutal-sm px-6 font-mono text-xs border-2 bg-white"
        >
          Too hard to tell
        </Button>
        <Button 
          variant="secondary" 
          onClick={() => handleVote("skip")}
          disabled={isTransitioning}
          className="rounded-full shadow-brutal-sm w-12 p-0 border-2 bg-white"
          title="Skip / I don't know one"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

    </div>
  )
}
