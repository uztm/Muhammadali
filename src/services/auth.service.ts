import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser, UserRole } from '@/types';

const KEYS = {
  users: 'osh.users',
  currentUserId: 'osh.currentUserId',
} as const;

export const defaultUsers: AppUser[] = [
  { id: 'admin-1', name: 'Admin', role: 'admin', pin: '1234' },
  { id: 'manager-1', name: 'Manager', role: 'manager', pin: '5678' },
  { id: 'bozorchi-1', name: 'Bozorchi', role: 'bozorchi', pin: '0000' },
  { id: 'warehouseman-1', name: 'Warehouseman', role: 'warehouseman', pin: '1111' },
  { id: 'chef-1', name: 'Chef', role: 'chef', pin: '2222' },
];

export const getUsers = async (): Promise<AppUser[]> => {
  const raw = await AsyncStorage.getItem(KEYS.users);
  if (!raw) return defaultUsers;
  try {
    return JSON.parse(raw) as AppUser[];
  } catch {
    return defaultUsers;
  }
};

export const saveUsers = async (users: AppUser[]) => {
  await AsyncStorage.setItem(KEYS.users, JSON.stringify(users));
};

export const getCurrentUser = async (): Promise<AppUser | null> => {
  const [userId, usersRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.currentUserId),
    AsyncStorage.getItem(KEYS.users),
  ]);
  if (!userId) return null;
  const users: AppUser[] = usersRaw ? (JSON.parse(usersRaw) as AppUser[]) : defaultUsers;
  return users.find((u) => u.id === userId) ?? null;
};

export const login = async (userId: string, pin: string): Promise<AppUser | null> => {
  const users = await getUsers();
  const user = users.find((u) => u.id === userId && u.pin === pin);
  if (!user) return null;
  await AsyncStorage.setItem(KEYS.currentUserId, user.id);
  return user;
};

export const logout = async () => {
  await AsyncStorage.removeItem(KEYS.currentUserId);
};

export const updateUser = async (updated: AppUser) => {
  const users = await getUsers();
  const next = users.map((u) => (u.id === updated.id ? updated : u));
  await saveUsers(next);
};

export const addUser = async (user: AppUser) => {
  const users = await getUsers();
  await saveUsers([...users, user]);
};

export const deleteUser = async (userId: string) => {
  const users = await getUsers();
  await saveUsers(users.filter((u) => u.id !== userId));
};

export const roleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    bozorchi: 'Bozorchi',
    warehouseman: 'Warehouseman',
    chef: 'Chef',
  };
  return labels[role];
};

export const roleDescription = (role: UserRole): string => {
  const desc: Record<UserRole, string> = {
    admin: 'Full system control, analytics, and pricing oversight',
    manager: 'Validates purchases, monitors operations, manages pricing',
    bozorchi: 'Receives daily shopping lists and submits receipts',
    warehouseman: 'Tracks warehouse stock, registers incoming deliveries',
    chef: 'Manages menu meals and sets ingredient quantities per meal',
  };
  return desc[role];
};
