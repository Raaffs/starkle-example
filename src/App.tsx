import { useState, useMemo } from 'react';
import { ThemeProvider, CssBaseline, type PaletteMode } from '@mui/material';
import { getDesignTokens, ColorModeContext } from './theme';
import { createTheme } from '@mui/material/styles';
import './App.css';
import ProofVerifier from './scene/verify';

function App() {
  const [mode, setMode] = useState<PaletteMode>('dark');
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    []
  );

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ProofVerifier />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
