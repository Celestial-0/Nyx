import { FlickeringGrid } from "@/components/ui/flickering-grid"

export const Background = () => {
  return (
    <div className="fixed inset-0 -z-10 bg-background">
      <FlickeringGrid
        className="absolute inset-0 opacity-[0.25]"
        squareSize={4}
        gridGap={8}
        color="var(--accent-brand)"
        maxOpacity={0.15}
        flickerChance={0.08}
      />
      {/* Ambient radial glows */}
      <div className="pointer-events-none absolute inset-0 glow-primary opacity-[0.06] dark:opacity-[0.09]" />
      <div className="pointer-events-none absolute inset-0 glow-accent opacity-[0.04] dark:opacity-[0.06]" />
      {/* Dynamic vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--background)_90%)]" />
    </div>
  )
}
