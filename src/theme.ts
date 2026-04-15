import { createTheme, type PaletteMode } from '@mui/material';
import { createContext } from 'react';

export const ColorModeContext = createContext({ toggleColorMode: () => {} });

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'dark'
      ? {
          // Dark Mode Tokens
          primary: {
            main: '#3182ce',
          },
          background: {
            default: '#0B0E14',
            paper: '#0F1219',
          },
          text: {
            primary: '#E2E8F0',
            secondary: '#A0AEC0',
          },
          divider: '#1A202C',
        }
      : {
          // Light Mode Tokens (Premium Aesthetic)
          primary: {
            main: '#3182ce',
          },
          background: {
            default: '#F7FAFC',
            paper: '#FFFFFF',
          },
          text: {
            primary: '#1A202C',
            secondary: '#4A5568',
          },
          divider: '#EDF2F7',
        }),
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h6: {
      fontWeight: 900,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export const theme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));
