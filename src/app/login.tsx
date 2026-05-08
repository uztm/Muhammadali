import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { theme } from '@/constants/theme';
import { defaultUsers, login, roleDescription, roleLabel } from '@/services/auth.service';
import { AppUser, UserRole } from '@/types';

type TabIconName = keyof typeof Ionicons.glyphMap;

const ROLE_ICONS: Record<UserRole, TabIconName> = {
  admin: 'shield-checkmark-outline',
  manager: 'people-outline',
  bozorchi: 'cart-outline',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: theme.colors.accent,
  manager: theme.colors.blue,
  bozorchi: theme.colors.amber,
};

export default function LoginScreen() {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSelectUser = (user: AppUser) => {
    setSelectedUser(user);
    setPin('');
    setError('');
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      void handleLogin(next);
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleLogin = async (enteredPin: string) => {
    if (!selectedUser) return;
    const user = await login(selectedUser.id, enteredPin);
    if (!user) {
      setPin('');
      setError('Incorrect PIN. Try again.');
      return;
    }
    if (user.role === 'admin') router.replace('/(admin)');
    else if (user.role === 'manager') router.replace('/(manager)');
    else router.replace('/(bozorchi)');
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPin('');
    setError('');
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.appName}>Osh Markazi</Text>
          <Text style={styles.subtitle}>Food Supply Planning System</Text>
        </View>

        {!selectedUser ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select your role</Text>
            {defaultUsers.map((user) => {
              const color = ROLE_COLORS[user.role];
              return (
                <Pressable
                  key={user.id}
                  style={styles.roleCard}
                  onPress={() => handleSelectUser(user)}>
                  <View style={[styles.roleIcon, { backgroundColor: color + '18' }]}>
                    <Ionicons name={ROLE_ICONS[user.role]} size={28} color={color} />
                  </View>
                  <View style={styles.roleText}>
                    <Text style={styles.roleName}>{roleLabel(user.role)}</Text>
                    <Text style={styles.roleDesc}>{roleDescription(user.role)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.subtle} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.section}>
            <Pressable style={styles.backRow} onPress={handleBack}>
              <Ionicons name="chevron-back" size={18} color={theme.colors.muted} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <View style={styles.pinHeader}>
              <View style={[styles.roleIconLg, { backgroundColor: ROLE_COLORS[selectedUser.role] + '18' }]}>
                <Ionicons
                  name={ROLE_ICONS[selectedUser.role]}
                  size={36}
                  color={ROLE_COLORS[selectedUser.role]}
                />
              </View>
              <Text style={styles.pinName}>{roleLabel(selectedUser.role)}</Text>
              <Text style={styles.pinInstruction}>Enter 4-digit PIN</Text>
            </View>

            <View style={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < pin.length && styles.dotFilled,
                    error ? styles.dotError : null,
                  ]}
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.numpad}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => (
                <Pressable
                  key={key}
                  style={[styles.numKey, !key && styles.numKeyEmpty]}
                  onPress={() => {
                    if (key === 'del') handleDelete();
                    else if (key) handleDigit(key);
                  }}>
                  {key === 'del' ? (
                    <Ionicons name="backspace-outline" size={22} color={theme.colors.text} />
                  ) : key ? (
                    <Text style={styles.numKeyText}>{key}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>

            <Text style={styles.hint}>Demo PINs: Admin 1234 · Manager 5678 · Bozorchi 0000</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
  },
  appName: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadow,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    flex: 1,
    gap: 3,
  },
  roleName: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 17,
    fontWeight: '700',
  },
  roleDesc: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 13,
    lineHeight: 18,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backText: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 15,
  },
  pinHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  roleIconLg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pinName: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 22,
    fontWeight: '700',
  },
  pinInstruction: {
    color: theme.colors.muted,
    fontFamily: theme.font,
    fontSize: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  dotError: {
    borderColor: theme.colors.red,
    backgroundColor: theme.colors.red,
  },
  errorText: {
    color: theme.colors.red,
    fontFamily: theme.font,
    fontSize: 13,
    textAlign: 'center',
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  numKey: {
    width: '30%',
    aspectRatio: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    ...theme.shadow,
  },
  numKeyEmpty: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  numKeyText: {
    color: theme.colors.text,
    fontFamily: theme.font,
    fontSize: 22,
    fontWeight: '600',
  },
  hint: {
    color: theme.colors.subtle,
    fontFamily: theme.font,
    fontSize: 12,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});
