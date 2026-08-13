import { useState, useCallback, useRef } from "react";
import { 
  useGetExperience, 
  useSubmitExperience, 
  useSubmitCheckin, 
  useListNeighborhoods,
  getGetExperienceQueryKey
} from "@workspace/api-client-react";
import { getVoterToken } from "@/lib/voter";
import { parseEvidenceFiles, EvidenceAggregate, ParseOutcome } from "@/lib/evidence";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, MapPin, CheckCircle2, AlertCircle, Info, FileJson, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Experience() {
  const token = getVoterToken();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: experienceData, isLoading: isLoadingExp } = useGetExperience(
    { voterToken: token },
    { query: { queryKey: getGetExperienceQueryKey({ voterToken: token }) } }
  );

  const { data: hoods } = useListNeighborhoods();

  const submitExperience = useSubmitExperience();
  const submitCheckin = useSubmitCheckin();

  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [locating, setLocating] = useState(false);
  
  const [parsedAggregates, setParsedAggregates] = useState<EvidenceAggregate[] | null>(null);
  const [parseOutcomes, setParseOutcomes] = useState<ParseOutcome[]>([]);
  const [checkinSuccess, setCheckinSuccess] = useState<{hood: string, message: string} | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = async (files: File[]) => {
    if (!hoods) return;
    setIsParsing(true);
    setParsedAggregates(null);
    setParseOutcomes([]);
    
    try {
      const result = await parseEvidenceFiles(files, hoods);
      setParsedAggregates(result.aggregates);
      setParseOutcomes(result.outcomes);
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }, [hoods]);

  const handleConfirmSubmit = () => {
    if (!parsedAggregates || parsedAggregates.length === 0) return;
    
    submitExperience.mutate({
      data: {
        voterToken: token,
        source: "web_upload",
        entries: parsedAggregates.map(a => ({
          neighborhoodId: a.neighborhoodId,
          visits: a.visits,
          hours: a.hours,
          photos: a.photos,
          activities: a.activities
        }))
      }
    }, {
      onSuccess: () => {
        setParsedAggregates(null);
        setParseOutcomes([]);
        queryClient.invalidateQueries({ queryKey: getGetExperienceQueryKey({ voterToken: token }) });
      }
    });
  };

  const handleCheckin = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setLocating(true);
    setCheckinSuccess(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitCheckin.mutate({
          data: {
            voterToken: token,
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        }, {
          onSuccess: (res) => {
            setLocating(false);
            setCheckinSuccess({
              hood: res.neighborhood.name,
              message: `Checked in successfully! Confidence increased.`
            });
            queryClient.invalidateQueries({ queryKey: getGetExperienceQueryKey({ voterToken: token }) });
            setTimeout(() => setCheckinSuccess(null), 5000);
          },
          onError: () => {
            setLocating(false);
            alert("Check-in failed. We couldn't verify you're in a NYC neighborhood.");
          }
        });
      },
      (error) => {
        setLocating(false);
        alert("Unable to retrieve your location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const entries = experienceData?.entries.filter(e => e.tier !== "none") || [];

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-5xl animate-slide-up">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-6">
        <div>
          <h1 className="font-display font-black text-5xl md:text-7xl uppercase tracking-tighter leading-none mb-2">
            Prove It
          </h1>
          <p className="font-mono text-muted-foreground font-bold max-w-xl text-sm md:text-base">
            NYC Experience Score weights your vote based on real-world proof.
            Raw files are parsed locally in your browser. Nothing leaves your device except neighborhood aggregates.
          </p>
        </div>
        <div className="bg-primary text-primary-foreground border-4 border-border shadow-brutal p-4 max-w-xs shrink-0 w-full md:w-auto">
          <h3 className="font-display font-black uppercase text-xl mb-1">How it works</h3>
          <p className="font-mono text-xs font-bold leading-tight">
            Multiplies your vote impact (0.25x – 2.0x) based on evidence. Unverified votes still count (floor multiplier), but proof hits harder.
          </p>
        </div>
      </div>

      <div 
        className={cn(
          "border-4 border-dashed transition-all duration-200 relative cursor-pointer",
          isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border bg-card hover:bg-secondary/50",
          "p-8 md:p-16 flex flex-col items-center justify-center text-center shadow-brutal mb-8 min-h-[300px]"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))}
        />
        
        {isParsing ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <span className="font-display font-black text-2xl uppercase">Crunching Data...</span>
            <span className="font-mono text-sm font-bold text-muted-foreground">Extracting NYC coordinates locally</span>
          </div>
        ) : (
          <>
            <div className="bg-primary text-primary-foreground p-4 rounded-none border-2 border-border shadow-brutal-sm mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="font-display font-black text-2xl md:text-3xl uppercase mb-2">Drop Evidence Here</h3>
            <p className="font-mono text-sm font-bold text-muted-foreground mb-6 max-w-md">
              Accepts Google Timeline JSON (Takeout), GPX tracks, KML/KMZ, or Geotagged Photos.
            </p>
            <Button variant="secondary" className="brutal-button-secondary pointer-events-none" tabIndex={-1}>
              Browse Files
            </Button>
          </>
        )}
      </div>

      {parsedAggregates && (
        <div className="mb-8 border-4 border-border bg-card p-6 md:p-8 shadow-brutal animate-slide-up">
          <div className="flex justify-between items-center mb-6 border-b-4 border-border pb-4">
            <h2 className="font-display font-black text-3xl uppercase">Review & Confirm</h2>
            <Button 
              variant="secondary" 
              size="icon"
              className="border-2 shadow-brutal-sm h-10 w-10"
              onClick={() => { setParsedAggregates(null); setParseOutcomes([]); }}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-mono font-bold uppercase text-sm mb-4 bg-secondary p-2 border-2 border-border">
                File Results
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {parseOutcomes.map((out, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm font-mono border-2 border-border p-3 bg-background">
                    {out.ok ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
                    <div className="overflow-hidden">
                      <div className="font-bold truncate">{out.fileName}</div>
                      <div className="text-xs text-muted-foreground truncate">{out.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-mono font-bold uppercase text-sm mb-4 bg-primary text-primary-foreground p-2 border-2 border-border">
                Neighborhoods Found ({parsedAggregates.length})
              </h3>
              {parsedAggregates.length === 0 ? (
                <div className="border-2 border-border p-6 text-center font-mono text-sm bg-background">
                  No NYC coordinates matched our zones in these files.
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 mb-6 custom-scrollbar">
                  {parsedAggregates.map(agg => (
                    <div key={agg.neighborhoodId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-2 border-border p-3 font-mono text-sm font-bold bg-background">
                      <span>{agg.neighborhoodName}</span>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {agg.visits > 0 && <span className="bg-secondary px-2 py-0.5 border border-border">{agg.visits} visits</span>}
                        {agg.photos > 0 && <span className="bg-secondary px-2 py-0.5 border border-border">{agg.photos} photos</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {parsedAggregates.length > 0 && (
                <Button 
                  className="w-full text-lg h-14 brutal-button"
                  disabled={submitExperience.isPending}
                  onClick={handleConfirmSubmit}
                >
                  {submitExperience.isPending ? <Loader2 className="animate-spin w-6 h-6 mr-2" /> : null}
                  CLAIM EXPERIENCE
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b-4 border-border pb-4">
            <h2 className="font-display font-black text-3xl uppercase">Your Record</h2>
            {isLoadingExp && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
          </div>
          
          {!isLoadingExp && entries.length === 0 ? (
            <div className="border-4 border-border bg-secondary p-8 text-center shadow-brutal-sm">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display font-black text-xl uppercase mb-2">Blank Slate</h3>
              <p className="font-mono text-sm font-bold text-muted-foreground">
                You haven't proven any experience yet. Drop a file or check-in below.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {entries.map(entry => (
                <div key={entry.neighborhoodId} className="border-4 border-border bg-card p-4 shadow-brutal-sm hover:shadow-brutal transition-all">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h4 className="font-display font-black text-lg uppercase leading-tight truncate" title={entry.neighborhoodName}>{entry.neighborhoodName}</h4>
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-2 py-1 border-2 border-border uppercase shrink-0",
                      entry.tier === "experienced" ? "bg-primary text-primary-foreground" : 
                      entry.tier === "probable" ? "bg-mta-blue text-white" : "bg-secondary text-secondary-foreground"
                    )}>
                      {entry.tier}
                    </span>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    <div className="font-mono text-xs text-muted-foreground font-bold">
                      {entry.borough}
                    </div>
                    <div className="font-mono font-bold text-sm bg-secondary px-2 py-1 border-2 border-border">
                      {Math.round(entry.confidence)}% CF
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display font-black text-3xl uppercase border-b-4 border-border pb-4 mb-6">
            Live Check-In
          </h2>
          <div className="border-4 border-border bg-accent text-accent-foreground p-6 shadow-brutal">
            <MapPin className="w-10 h-10 mb-4" />
            <h3 className="font-display font-black text-2xl uppercase mb-2">I'm Here Now</h3>
            <p className="font-mono text-sm font-bold mb-6 opacity-90">
              Instantly boost your confidence score for your current location.
            </p>
            
            {checkinSuccess && (
              <div className="bg-background text-foreground p-3 border-2 border-border font-mono text-sm font-bold mb-4 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <span>Verified: {checkinSuccess.hood}</span>
              </div>
            )}

            <Button 
              onClick={handleCheckin}
              disabled={locating || submitCheckin.isPending}
              className="w-full h-14 bg-background text-foreground hover:bg-secondary border-2 border-border shadow-brutal font-display text-xl uppercase font-black"
            >
              {locating || submitCheckin.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                "PING GPS"
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12 border-4 border-border bg-card p-6 shadow-brutal">
        <h3 className="font-display font-black text-xl uppercase mb-4 flex items-center gap-2">
          <Info className="w-6 h-6 text-primary" /> Where to get exports
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border-2 border-border p-4 bg-background">
            <h4 className="font-mono font-bold uppercase mb-2 flex items-center gap-2"><MapPin className="w-4 h-4"/> Google Maps</h4>
            <p className="font-mono text-xs text-muted-foreground">Mobile app → Your Timeline → Settings → Export Timeline Data (JSON).</p>
          </div>
          <div className="border-2 border-border p-4 bg-background">
            <h4 className="font-mono font-bold uppercase mb-2 flex items-center gap-2"><FileJson className="w-4 h-4"/> Fitness Apps</h4>
            <p className="font-mono text-xs text-muted-foreground">Strava, Garmin, or Apple Health → Export Activity (GPX/KML formats supported).</p>
          </div>
          <div className="border-2 border-border p-4 bg-background">
            <h4 className="font-mono font-bold uppercase mb-2 flex items-center gap-2"><Camera className="w-4 h-4"/> Photos</h4>
            <p className="font-mono text-xs text-muted-foreground">Select multiple photos taken in NYC → Share → Save to Files. Upload them directly.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
