import { FlickeringGrid } from '@/components/ui/flickering-grid'
import { useTheme } from '@/components/provider/theme-provider'

export const Background = () => {
  const { theme } = useTheme()
  const color = theme === "dark" ? "#6B7280" : "#9f00d4";
  
  return (
    <FlickeringGrid
      className="fixed inset-0 -z-10"
      squareSize={4}
      gridGap={6}
      color={color}
      maxOpacity={0.5}
      flickerChance={0.1}
    />
  )
}