import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { loadPaymentsSnapshotAction } from '@/hooks/usePayments';
import { usePaymentsStore } from '@/store';
import { useEffect } from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { PaymentsActivityCard } from './PaymentsActivityCard';
import { PaymentsRechargeCard } from './PaymentsRechargeCard';
import { PaymentsSummaryCard } from './PaymentsSummaryCard';

/**
 * Payments panel presented as a modal sheet, driven by `paymentsStore.isOpen`.
 * The web client used a side panel; on mobile a bottom-anchored modal fits better.
 */
export function PaymentsSheet() {
  const isOpen = usePaymentsStore((state) => state.isOpen);
  const status = usePaymentsStore((state) => state.status);
  const closePanel = usePaymentsStore((state) => state.closePanel);
  const recoveryMessage = usePaymentsStore((state) => state.recoveryMessage);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      void loadPaymentsSnapshotAction().catch(() => undefined);
    }
  }, [isOpen, status]);

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={closePanel}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background max-h-[85%] rounded-t-2xl">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text variant="large">Payments</Text>
            <Button variant="ghost" size="sm" onPress={closePanel}>
              <Text>Close</Text>
            </Button>
          </View>
          <ScrollView contentContainerClassName="gap-3 p-4">
            {recoveryMessage ? (
              <Text className="text-muted-foreground text-sm">{recoveryMessage}</Text>
            ) : null}
            <PaymentsSummaryCard />
            <PaymentsRechargeCard />
            <PaymentsActivityCard />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
