import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { AplifyLogo } from '@/src/AplifyLogo';
import { colors, commonStyles, PrimaryButton } from '@/src/ui';

export default function SplashScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.atmosphere} />
      <View style={styles.hero}>
        <AplifyLogo size={56} withWordmark stacked />
        <Text style={styles.tagline}>Decide where work goes next.</Text>
        <Text style={styles.description}>
          Send tickets to AI, assign them to people, and review output before it moves forward.
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          testID="get-started-button"
          label="Get started"
          onPress={() => router.push('/login')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 16 },
  atmosphere: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.mintSoft,
    opacity: 0.35,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  footer: { gap: 8, paddingBottom: 6 },
  tagline: { ...commonStyles.heading, textAlign: 'center' },
  description: { ...commonStyles.body, maxWidth: 300, textAlign: 'center' },
});
