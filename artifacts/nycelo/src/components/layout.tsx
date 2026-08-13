import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Trophy, ArrowRightLeft, MapPin } from "lucide-react"
import { ReactNode } from "react"
import { useAutoCheckin } from "@/hooks/useAutoCheckin"

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  // Passive check-ins accrue silently on any page while enabled.
  useAutoCheckin()
  
  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background selection:bg-primary selection:text-primary-foreground relative overflow-hidden">
      {/* Background grain noise for texture */}
      <div 
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
      ></div>

      <header className="sticky top-0 z-40 w-full border-b-4 border-border bg-background">
        <div className="flex h-16 items-center px-4 md:px-6 w-full max-w-7xl mx-auto">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-display font-black text-2xl tracking-tighter uppercase bg-primary text-primary-foreground px-2 py-0.5 border-2 border-border shadow-brutal-sm -rotate-2">
              NYCELO
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-bold font-display uppercase tracking-wide flex-1">
            <Link 
              href="/rank" 
              className={cn(
                "transition-colors hover:text-primary flex items-center gap-2",
                location === "/rank" ? "text-primary border-b-4 border-primary py-4" : "text-foreground"
              )}
            >
              <ArrowRightLeft className="w-4 h-4 hidden sm:block" />
              Rank
            </Link>
            <Link 
              href="/leaderboard"
              className={cn(
                "transition-colors hover:text-primary flex items-center gap-2",
                location === "/leaderboard" ? "text-primary border-b-4 border-primary py-4" : "text-foreground"
              )}
            >
              <Trophy className="w-4 h-4 hidden sm:block" />
              Leaderboard
            </Link>
            <Link 
              href="/experience"
              className={cn(
                "transition-colors hover:text-primary flex items-center gap-2",
                location === "/experience" ? "text-primary border-b-4 border-primary py-4" : "text-foreground"
              )}
            >
              <MapPin className="w-4 h-4 hidden sm:block" />
              Prove It
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col w-full relative">
        {children}
      </main>
      
      <footer className="border-t-4 border-border bg-background py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row max-w-7xl mx-auto px-4 md:px-6 font-mono text-sm">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built for New Yorkers who will argue about anything.
          </p>
          <div className="flex items-center gap-4">
            <span className="font-bold text-foreground">Settle it.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
