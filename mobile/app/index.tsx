import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { Card, colors, commonStyles, PrimaryButton, StatusBadge, Tag } from '@/src/ui';

export default function SplashScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.atmosphere} />
      <View style={styles.hero}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="shield-check" size={44} color={colors.onMint} />
        </View>
        <Text style={styles.brand}>AplifyAI</Text>
        <Text style={styles.tagline}>Decide where work goes next.</Text>
        <Text style={styles.description}>
          Send tickets to AI, assign them to people, and review output before it moves forward.
        </Text>
      </View>
      <View style={styles.footer}>
        <Card tone="butter">
          <View style={styles.noteHeader}>
            <StatusBadge status="blocked_pii" label="Sensitive data can stop a job" />
            <Tag label="Governance" tone="butter" />
          </View>
          <Text style={commonStyles.body}>
            Model execution begins only after the configured sensitive-data checks complete.
          </Text>
        </Card>
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
  screen: { flex: 1, backgroundColor: colors.background, padding: 20 },
  atmosphere: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.mintSoft,
    opacity: 0.35,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintSoft,
    borderColor: 'rgba(63,122,98,0.22)',
    borderWidth: 1,
  },
  brand: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  footer: { gap: 18 },
  tagline: { ...commonStyles.heading, textAlign: 'center' },
  description: { ...commonStyles.body, maxWidth: 320, textAlign: 'center' },
  noteHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
