import { useIsMobile } from "@/hooks/use-mobile"

export function useResponsivePanels() {
  const isMobile = useIsMobile()

  return {
    isMobile,
    showDesktopChatList: !isMobile,
    showDesktopInfoPanel: !isMobile,
    useSheetPanels: isMobile,
  }
}
