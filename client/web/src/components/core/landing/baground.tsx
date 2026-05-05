import { FlickeringGrid } from "@/components/ui/flickering-grid"

export const Background = () => {
  return (
    <FlickeringGrid
      className="fixed inset-0 -z-10"
      squareSize={4}
      gridGap={6}
      color="#6B7280"
      maxOpacity={0.5}
      flickerChance={0.1}
    />
  )
}
