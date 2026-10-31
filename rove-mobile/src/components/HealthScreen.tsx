import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors.ts';
import { useBackendHealth } from '../hooks/useBackendHealth.ts';

export function HealthScreen() {
  const { configuration, state, check } = useBackendHealth();
  const ready = configuration.state === 'ready';
  const loading = state.status === 'loading';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Rove · Milestone 1</Text>
        <Text style={styles.title}>Development check</Text>
        <Text style={styles.description}>
          The app is running. This screen checks only the backend health endpoint.
        </Text>

        <Text style={styles.label}>Backend configuration</Text>
        <Text style={[styles.value, ready ? styles.success : styles.error]}>
          {ready ? 'Present' : configuration.message}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check backend connection"
          disabled={!ready || loading}
          onPress={check}
          style={[styles.button, (!ready || loading) && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color={colors.actionText} />
            : <Text style={styles.buttonText}>Check backend connection</Text>}
        </Pressable>

        {state.status === 'success' && <Text style={styles.success}>Backend reachable.</Text>}
        {state.status === 'failure' && <Text style={styles.error}>{state.message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 18, padding: 24, gap: 12 },
  eyebrow: { color: colors.action, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 27, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 12 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  value: { fontSize: 15, marginBottom: 12 },
  button: { backgroundColor: colors.action, minHeight: 48, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.actionText, fontSize: 16, fontWeight: '700' },
  success: { color: colors.success, fontSize: 15, fontWeight: '600' },
  error: { color: colors.error, fontSize: 15, fontWeight: '600' },
});
