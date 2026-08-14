import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Image, type ImageStyle, View } from 'react-native';

const NYX_LOGO = require('@/assets/images/nyx.png');

const LOGO_STYLE: ImageStyle = {
  width: 112,
  height: 112,
};

/**
 * Marketing / entry landing screen. `onGetStarted` is wired by the route to
 * navigate into the auth flow.
 */
export function Landing({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-6 p-8">
      <Image source={NYX_LOGO} style={LOGO_STYLE} resizeMode="contain" />
      <View className="items-center gap-2">
        <Text variant="h1">Nyx</Text>
        <Text className="text-muted-foreground text-center">
          End-to-end encrypted messaging and payments on Solana.
        </Text>
      </View>
      <Button size="lg" onPress={onGetStarted}>
        <Text>Get started</Text>
      </Button>
    </View>
  );
}

export default Landing;
