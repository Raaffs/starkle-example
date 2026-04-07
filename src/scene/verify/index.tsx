/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, type ChangeEvent } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Paper, 
  Stack, 
  Grid, 
  AppBar, 
  Toolbar, 
  Divider,
  Chip, 
  Fade, 
  GlobalStyles,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// Ethers and Contract Data
import { BrowserProvider, verifyMessage, Contract } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './ContractConfig';

// Types and Mock/Imported Utils
import type { 
    ProofMap,
    MerkleProof,
    MerkleField
 } from './MerkleUtils';

import verifyProof from './MerkleUtils';

declare global {
    interface Window {
        ethereum?: any;
    }
}

const ProofVerifier: React.FC = () => {
  const [dataMap, setDataMap] = useState<ProofMap | null>(null);
  const [status, setStatus] = useState<string>('System initialized. Awaiting data source...');
  const [verifiedFields, setVerifiedFields] = useState<Record<string, boolean>>({});

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = event.target?.result;
      if (typeof rawText !== "string") {
        setStatus("ERROR: File stream invalid.");
        return;
      }
      try {
        const parsed = JSON.parse(rawText);
        setDataMap(parsed as ProofMap);
        setVerifiedFields({}); // Reset verification state
        setStatus(`SUCCESS: Indexed ${Object.keys(parsed).length} cryptographic leaves.`);
      } catch (err:any) {
        console.log(err)
        setStatus("ERROR: JSON Parse failure. Check file format.");
      }
    };
    reader.readAsText(file);
  };

  const runVerification = async (fieldKey: string) => {
    if (!dataMap || !dataMap[fieldKey]) return;
    
    if (!window.ethereum) {
        setStatus("ERROR: MetaMask not detected.");
        return;
    }

    try {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // 1. Random challenge so replayed signatures don't work
        const challenge = `ProofChain verification challenge: ${crypto.randomUUID()}`;
        
        let userAddress: string;
        try {
            const signature = await signer.signMessage(challenge);
            // Recover address from signature — this is the anti-impersonation check
            userAddress = verifyMessage(challenge, signature);
        } catch {
            setStatus("ERROR: User rejected signing or MetaMask error.");
            return;
        }

        // 2 & 3. Fetch all documents from contract and filter roots matching wallet address
        setStatus("Fetching active ProofChain documents...");
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const [requesters, , , hashes, ] = await contract.getDocuments();

        const userRoots: string[] = requesters
            .map((addr: string, i: number) => ({ addr, hash: hashes[i] }))
            .filter(({ addr }: { addr: string }) => addr.toLowerCase() === userAddress.toLowerCase())
            .map(({ hash }: { hash: string }) => hash);

        if (userRoots.length === 0) {
            setStatus("ERROR: No certificates found for this wallet address.");
            return;
        }

        // 4. Calculate the local Merkle root from proof
        const merkleProof: MerkleProof = {
            value: dataMap[fieldKey].value,
            salt: dataMap[fieldKey].salt,
            merkleProof: Object.keys(dataMap).sort().map(key => dataMap[key].hash), 
        };
        const computedRoot = await verifyProof(merkleProof);

        // 5. Check if computed root matches any of user's on-chain roots
        const isValid = userRoots.some(r => r.toLowerCase() === computedRoot.toLowerCase());
        
        setVerifiedFields(prev => ({ ...prev, [fieldKey]: isValid }));
        setStatus(isValid 
            ? `VERIFIED: ${fieldKey} leaf matches root integrity.` 
            : `FAILURE: ${fieldKey} data corruption detected.`
        );
    } catch (err: any) {
        console.error(err);
        setStatus("ERROR: Blockchain communication failure.");
    }
  };

  return (
    <>
      {/* 1. GLOBAL RESET: This removes the "left/top edges" and white margins */}
      <GlobalStyles styles={{ 
        body: { margin: 0, padding: 0, backgroundColor: '#0B0E14', overflow: 'hidden' },
        html: { width: '100vw', height: '100vh' },
        '*::-webkit-scrollbar': { width: '6px' },
        '*::-webkit-scrollbar-thumb': { backgroundColor: '#2D3748', borderRadius: '10px' }
      }} />

      {/* 2. ROOT CONTAINER: Fixed positioning ensures it covers the browser 100% */}
      <Box sx={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100vw', 
        position: 'fixed',
        top: 0,
        left: 0,
        bgcolor: '#0B0E14', 
        color: '#E2E8F0',
        fontFamily: 'Inter, sans-serif'
      }}>
        
        {/* LEFT SIDEBAR: Control Panel */}
        <Box sx={{ 
          width: 320, 
          borderRight: '1px solid #1A202C', 
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: '#0F1219' 
        }}>
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <VerifiedUserIcon sx={{ color: '#3182ce', fontSize: 28 }} />
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: -1 }}>
              AUDITOR<span style={{ color: '#3182ce' }}>PRO</span>
            </Typography>
          </Box>

          <Divider sx={{ borderColor: '#1A202C' }} />

          <Box sx={{ p: 3, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: '#4A5568', fontWeight: 800, mb: 3, display: 'block', letterSpacing: 1 }}>
              AUTHENTICATION CONFIG
            </Typography>
            
            <Stack spacing={4}>
              <Box>
                <Button
                  component="label"
                  variant="contained"
                  fullWidth
                  startIcon={<CloudUploadIcon />}
                  sx={{ 
                    py: 1.5, bgcolor: '#3182ce', '&:hover': { bgcolor: '#2b6cb0' },
                    textTransform: 'none', fontWeight: 700, borderRadius: 2
                  }}
                >
                  Load Proof JSON
                  <input type="file" hidden accept=".json" onChange={handleFileUpload} />
                </Button>
                {dataMap && (
                  <Typography variant="caption" sx={{ color: '#48BB78', mt: 1, display: 'block', textAlign: 'center' }}>
                    Active dataset loaded
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

          {/* STATUS LOG: Cyber terminal look */}
          <Box sx={{ p: 2, m: 2, bgcolor: '#080A0F', borderRadius: 2, border: '1px solid #1A202C' }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <TerminalIcon sx={{ fontSize: 14, color: '#4FD1C5' }} />
                  <Typography variant="caption" sx={{ color: '#4FD1C5', fontWeight: 800 }}>SYSTEM LOG</Typography>
              </Stack>
              <Typography sx={{ 
                fontFamily: "'JetBrains Mono', monospace", 
                fontSize: '11px', 
                color: '#0bf52eff', 
                wordBreak: 'break-all',
                lineHeight: 1.4
              }}>
                {`> ${status}`}
              </Typography>
          </Box>
        </Box>

        {/* MAIN WORKSPACE */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: '#0B0E14' }}>
          
          <AppBar position="static" elevation={0} sx={{ bgcolor: 'transparent', borderBottom: '1px solid #1A202C' }}>
            <Toolbar variant="dense" sx={{ justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <StorageIcon sx={{ color: '#4A5568', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: '#A0AEC0', fontWeight: 600 }}>
                  Verification Workspace
                </Typography>
              </Stack>
              {dataMap && <Chip label="SECURE ENVIRONMENT" size="small" sx={{ height: 20, bgcolor: '#1A202C', color: '#3182ce', fontSize: '10px', fontWeight: 700 }} />}
            </Toolbar>
          </AppBar>

          <Box sx={{ flexGrow: 1, p: 4, overflowY: 'auto' }}>
            {!dataMap ? (
              <Fade in={true}>
                <Box sx={{ 
                  height: '80%', display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', justifyContent: 'center', 
                  border: '1px dashed #1A202C', borderRadius: 6
                }}>
                  <CloudUploadIcon sx={{ fontSize: 60, color: '#1A202C', mb: 2 }} />
                  <Typography variant="h6" color="#2D3748" fontWeight={700}>NO DATA SOURCE FOUND</Typography>
                  <Typography variant="body2" color="#2D3748">Please upload a JSON file to begin verification</Typography>
                </Box>
              </Fade>
            ) : (
              <Grid container spacing={2}>
                {Object.keys(dataMap).map(key => (
                  <Grid size={{ xs: 12, sm: 6, lg: 4, xl: 3 }} key={key} sx={{ p: 1 }}>
                    <Paper sx={{ 
                      p: 2.5, 
                      bgcolor: '#0F1219', 
                      border: '1px solid #1A202C', 
                      borderRadius: 3,
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: '#3182ce', transform: 'translateY(-2px)' }
                    }}>
                       <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#F7FAFC' }}>
                            {key.toUpperCase()}
                          </Typography>
                          {verifiedFields[key] === true && <CheckCircleIcon sx={{ color: '#48BB78', fontSize: 18 }} />}
                          {verifiedFields[key] === false && <ErrorOutlineIcon sx={{ color: '#F56565', fontSize: 18 }} />}
                       </Stack>

                       <Typography variant="caption" sx={{ color: '#718096', display: 'block', mb: 2, fontFamily: 'monospace' }}>
                         Salt: {dataMap[key].salt.substring(0, 16)}...
                       </Typography>

                       <Button 
                        fullWidth 
                        variant="outlined"
                        size="small"
                        onClick={() => runVerification(key)}
                        sx={{ 
                          textTransform: 'none', 
                          borderColor: '#2D3748', 
                          color: '#A0AEC0',
                          '&:hover': { borderColor: '#3182ce', color: '#3182ce' }
                        }}
                       >
                        Verify Node
                       </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default ProofVerifier;