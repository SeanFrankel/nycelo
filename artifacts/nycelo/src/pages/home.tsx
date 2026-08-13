import { Link } from "wouter"
import { Button, buttonVariants } from "@/components/ui/button"
import { useGetShowcase, useGetStats } from "@workspace/api-client-react"
import { Flame, MapPin } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export default function Home() {
  const { data: stats } = useGetStats()
  const { data: showcase } = useGetShowcase()
  
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!showcase || showcase.length <= 1) return
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % showcase.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [showcase])

  return (
    <div className="flex-1 flex flex-col">
      {/* HERO SECTION */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex items-center justify-center border-b-4 border-border bg-mta-yellow overflow-hidden relative">
        <div className="absolute top-10 left-10 opacity-20 rotate-[-15deg] hidden lg:block">
          <div className="font-display font-black text-9xl tracking-tighter">BKLN</div>
        </div>
        <div className="absolute bottom-10 right-10 opacity-20 rotate-[10deg] hidden lg:block">
          <div className="font-display font-black text-9xl tracking-tighter">MNHTN</div>
        </div>
        
        <div className="container px-4 md:px-6 relative z-10 max-w-5xl mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-block bg-background px-4 py-1.5 border-2 border-border shadow-brutal-sm font-mono font-bold text-sm mb-4">
                THE ULTIMATE NYC NEIGHBORHOOD SHOWDOWN
              </div>
              <h1 className="text-5xl font-black tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl/none font-display uppercase leading-[0.9]">
                Settle the <br/>
                <span className="text-white relative inline-block">
                  <span className="absolute -inset-2 bg-primary border-4 border-border transform rotate-[-2deg] -z-10 shadow-brutal"></span>
                  Argument
                </span>
              </h1>
              <p className="mx-auto max-w-[700px] text-foreground font-mono text-base md:text-xl font-bold mt-6 leading-relaxed">
                West Village or Williamsburg? Astoria or LIC? 
                Stop yelling at your friends. Start voting.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/rank" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto text-lg h-16 px-10 shadow-brutal hover:shadow-brutal-lg border-4")}>
                START RANKING <Flame className="ml-2 w-5 h-5" />
              </Link>
              <Link href="/leaderboard" className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "w-full sm:w-auto text-lg h-16 px-10 border-4 bg-white hover:bg-secondary")}>
                SEE LEADERBOARDS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWCASE SECTION */}
      <section className="w-full py-12 md:py-24 bg-background border-b-4 border-border relative">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/3 space-y-4">
              <h2 className="text-3xl md:text-5xl font-black font-display uppercase tracking-tighter">Current Kings</h2>
              <p className="font-mono text-muted-foreground text-sm md:text-base">
                The undisputed champions right now, based on live head-to-head ELO ratings.
              </p>
            </div>
            <div className="md:w-2/3 w-full relative h-[280px]">
              {showcase && showcase.length > 0 ? (
                showcase.map((entry, index) => {
                  const isActive = index === activeIndex
                  const isPrev = index === (activeIndex - 1 + showcase.length) % showcase.length
                  const isNext = index === (activeIndex + 1) % showcase.length
                  
                  if (!isActive && !isPrev && !isNext && showcase.length > 3) return null

                  return (
                    <div 
                      key={entry.trait.id}
                      className={cn(
                        "absolute top-0 left-0 w-full transition-all duration-500 ease-in-out brutal-card bg-white p-6 md:p-8 flex flex-col md:flex-row items-center gap-6",
                        isActive ? "opacity-100 z-20 translate-x-0 scale-100" : 
                        isPrev ? "opacity-0 -translate-x-full scale-90 z-10" : 
                        isNext ? "opacity-0 translate-x-full scale-90 z-10" : "hidden"
                      )}
                    >
                      <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center justify-center px-3 py-1 bg-mta-blue text-white font-mono font-bold text-xs uppercase border-2 border-border mb-4">
                          Best for {entry.trait.name}
                        </div>
                        <h3 className="text-3xl md:text-4xl font-black font-display uppercase tracking-tighter mb-2">
                          {entry.topNeighborhood?.name || "TBD"}
                        </h3>
                        {entry.topNeighborhood && (
                          <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground font-mono text-sm font-bold">
                            <MapPin className="w-4 h-4" />
                            {entry.topNeighborhood.borough}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center bg-primary text-primary-foreground border-4 border-border w-24 h-24 rounded-full shadow-brutal-sm rotate-12">
                        <span className="font-mono text-xs font-bold uppercase mb-1">Rating</span>
                        <span className="font-display font-black text-2xl">{Math.round(entry.rating || 1200)}</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="w-full h-full brutal-card bg-secondary p-8 flex items-center justify-center">
                  <span className="font-mono font-bold animate-pulse">Fetching latest stats...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="w-full py-12 bg-mta-blue text-white border-b-4 border-border">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y-4 md:divide-y-0 md:divide-x-4 divide-border">
            <div className="flex flex-col items-center justify-center p-4">
              <span className="text-5xl md:text-6xl font-black font-display mb-2 drop-shadow-brutal-sm">
                {stats?.totalVotes ? stats.totalVotes.toLocaleString() : "---"}
              </span>
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-blue-200">Total Votes Cast</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4">
              <span className="text-5xl md:text-6xl font-black font-display mb-2 drop-shadow-brutal-sm">
                {stats?.totalNeighborhoods || "---"}
              </span>
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-blue-200">Neighborhoods</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4">
              <span className="text-5xl md:text-6xl font-black font-display mb-2 drop-shadow-brutal-sm">
                {stats?.totalTraits || "---"}
              </span>
              <span className="font-mono text-sm font-bold uppercase tracking-wider text-blue-200">Ranking Categories</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
