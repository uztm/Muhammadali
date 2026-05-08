import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { theme } from '@/constants/theme';
import { getCurrentUser } from '@/services/auth.service';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'admin') {
        router.replace('/(admin)');
      } else if (user.role === 'manager') {
        router.replace('/(manager)');
      } else {
        router.replace('/(bozorchi)');
      }
    });
  }, [router]);

  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.background },
});
