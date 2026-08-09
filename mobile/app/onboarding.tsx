import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { markOnboardingSeen } from '@/src/onboarding';
import { Card, colors, commonStyles, PrimaryButton, SecondaryButton } from '@/src/ui';

const MARK = require('../assets/brand/aai-mark.png');

const SCREENS = [
  {
    eyebrow: 'Decisions',
    title: 'What AplifyAI decides',
    body: 'Triage each ticket for AI or a person. Mobile is built for those fast routing calls—not for workspace setup.',
  },
  {
    eyebrow: 'Flow',
    title: 'How work moves',
    body: 'Board items land in Triage, become AI Jobs when sent to the model, then surface in Approvals or PII when something needs a human check.',
  },
  {
    eyebrow: 'Setup',
    title: 'Where connections live',
    body: 'Connect boards and MCP services from the desktop web app. On mobile you review status and make decisions.',
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromAccount = params.from === 'account';
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];
  const isLast = index === SCREENS.length - 1;

  const finish = async () => {
    await markOnboardingSeen();
    if (fromAccount) {
      router.replace('/(tabs)/account');
      return;
    }
    router.replace('/(tabs)/triage');
  };

  return (
    <SafeAreaView style={commonStyles.screen} testID="onboarding-screen">
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <Image source={MARK} style={styles.mark} resizeMode="contain" accessibilityLabel="AplifyAI" />
          <Text style={styles.brand}>AplifyAI</Text>
        </View>

        <Card style={styles.card} testID={`onboarding-step-${index}`}>
          <Text style={commonStyles.meta}>{screen.eyebrow}</Text>
          <Text style={commonStyles.title}>{screen.title}</Text>
          <Text style={commonStyles.body}>{screen.body}</Text>
        </Card>

        <View style={styles.dots}>
          {SCREENS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.actions}>
          {!isLast ? (
            <>
              <PrimaryButton
                testID="onboarding-next"
                label="Next"
                onPress={() => setIndex((value) => Math.min(value + 1, SCREENS.length - 1))}
              />
              <SecondaryButton testID="onboarding-skip" label="Skip" onPress={() => void finish()} />
            </>
          ) : (
            <PrimaryButton testID="onboarding-done" label="Done" onPress={() => void finish()} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 28, height: 28, borderRadius: 7 },
  brand: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  card: { gap: 8, minHeight: 160, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  actions: { gap: 8 },
});
