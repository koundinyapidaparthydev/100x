import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import { colors, commonStyles, PrimaryButton } from '@/src/ui';

export default function SplashScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="shield-check" size={52} color={colors.primary} />
        </View>
        <Text style={commonStyles.title}>AplifyAI</Text>
        <Text style={commonStyles.body}>AI-first work delegation</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.trust}>Every ticket passes the PII firewall before AI runs</Text>
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
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  footer: { gap: 18 },
  trust: { ...commonStyles.meta, textAlign: 'center' },
});
