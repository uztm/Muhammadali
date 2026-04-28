import { Platform } from 'react-native';

export const theme = {
  colors: {
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F1EE',
    text: '#171717',
    muted: '#72716D',
    subtle: '#A4A29B',
    line: '#E6E4DE',
    primary: '#111111',
    accent: '#2F6F58',
    blue: '#2D6CDF',
    amber: '#B7791F',
    red: '#B13A2F',
    green: '#2E7D51',
    tab: '#FFFFFF',
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 22,
    xl: 26,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  shadow: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    default: {
      elevation: 2,
    },
  }),
  font: Platform.select({
    ios: 'System',
    android: 'sans',
    default: 'System',
  }),
} as const;
