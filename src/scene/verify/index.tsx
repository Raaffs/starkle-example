/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, type ChangeEvent } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
} from "@mui/material";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import GppBadIcon from "@mui/icons-material/GppBad";

// Ethers and Contract Data
import { BrowserProvider, verifyMessage, Contract } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./ContractConfig";
import { useTheme } from "@mui/material/styles";
import { useContext } from "react";
import { ColorModeContext } from "../../theme";

// Types and Mock/Imported Utils
import type { ProofMap, MerkleProof } from "./MerkleUtils";

import verifyProof from "./MerkleUtils";

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface VerificationResult {
  field: string;
  value: string;
  salt: string;
  isValid: boolean;
  error?: string;
}

const ProofVerifier: React.FC = () => {
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isDark = theme.palette.mode === "dark";

  const [dataMap, setDataMap] = useState<ProofMap | null>(null);
  const [status, setStatus] = useState<string>(
    "System initialized. Awaiting data source...",
  );
  const [verifiedFields, setVerifiedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

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
        setStatus(
          `SUCCESS: Indexed ${Object.keys(parsed).length} cryptographic leaves.`,
        );
      } catch (err: any) {
        console.log(err);
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

    setLoadingField(fieldKey);
    setStatus(`Initializing verification for field: ${fieldKey}`);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x539" }], // 0x539 is hex for 1337
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x539",
              chainName: "Ganache Local",
              rpcUrls: ["http://127.0.0.1:7545"], // Match your Ganache port
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: null,
            },
          ],
        });
      }
    }

    try {
      const provider = new BrowserProvider(window.ethereum, "any");
      const network = await provider.getNetwork();
      console.log("Current Provider Chain ID:", network.chainId.toString());
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
        setLoadingField(null);
        return;
      }

      // 2 & 3. Fetch all certificates from contract and filter roots matching wallet address
      setStatus("Fetching active ProofChain certificates...");
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const code = await provider.getCode(CONTRACT_ADDRESS);
      console.log("this is code", code);
      if (code === "0x") {
        throw new Error(
          "Contract not found at this address on the current network!",
        );
      }
      const [requesters, , , hashes] = await contract.getDocuments();

      const userRoots: string[] = requesters
        .map((addr: string, i: number) => ({ addr, hash: hashes[i] }))
        .filter(
          ({ addr }: { addr: string }) =>
            addr.toLowerCase() === userAddress.toLowerCase(),
        )
        .map(({ hash }: { hash: string }) => hash);

      if (userRoots.length === 0) {
        setStatus("ERROR: No certificates found for this wallet address.");
        setResult({
          field: fieldKey,
          value: dataMap[fieldKey].value,
          salt: dataMap[fieldKey].salt,
          isValid: false,
          error: "Wallet Address Mismatch: No matching root on blockchain.",
        });
        setLoadingField(null);
        return;
      }

      // 4. Calculate the local Merkle root from proof
      const merkleProof: MerkleProof = {
        value: dataMap[fieldKey].value,
        salt: dataMap[fieldKey].salt,
        merkleProof: Object.keys(dataMap)
          .sort()
          .map((key) => dataMap[key].hash),
      };
      const computedRoot = await verifyProof(merkleProof);

      // 5. Check if computed root matches any of user's on-chain roots
      const isValid = userRoots.some(
        (r) => r.toLowerCase() === computedRoot.toLowerCase(),
      );

      setVerifiedFields((prev) => ({ ...prev, [fieldKey]: isValid }));
      setResult({
        field: fieldKey,
        value: dataMap[fieldKey].value,
        salt: dataMap[fieldKey].salt,
        isValid: isValid,
      });
      setStatus(
        isValid
          ? `VERIFIED: ${fieldKey} leaf matches root integrity.`
          : `FAILURE: ${fieldKey} data corruption detected.`,
      );
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR: Blockchain communication failure.");
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <>
      {/* 1. GLOBAL RESET: This removes the "left/top edges" and white margins */}
      <GlobalStyles
        styles={{
          body: {
            margin: 0,
            padding: 0,
            backgroundColor: theme.palette.background.default,
            overflow: "hidden",
          },
          html: { width: "100vw", height: "100vh" },
          "*::-webkit-scrollbar": { width: "6px" },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: isDark ? "#2D3748" : "#CBD5E0",
            borderRadius: "10px",
          },
        }}
      />

      {/* 2. ROOT CONTAINER: Fixed positioning ensures it covers the browser 100% */}
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          position: "fixed",
          top: 0,
          left: 0,
          bgcolor: "background.default",
          color: "text.primary",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* LEFT SIDEBAR: Control Panel */}
        <Box
          sx={{
            width: 320,
            borderRight: `1px solid ${theme.palette.divider}`,
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <VerifiedUserIcon sx={{ color: "#3182ce", fontSize: 28 }} />
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{ letterSpacing: -1 }}
            >
              AUDITOR<span style={{ color: "#3182ce" }}>PRO</span>
            </Typography>
          </Box>

          <Divider sx={{ borderColor: "divider" }} />

          <Box sx={{ p: 3, flexGrow: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                opacity: 0.7,
                fontWeight: 800,
                mb: 3,
                display: "block",
                letterSpacing: 1,
              }}
            >
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
                    py: 1.5,
                    bgcolor: "#3182ce",
                    "&:hover": { bgcolor: "#2b6cb0" },
                    textTransform: "none",
                    fontWeight: 700,
                    borderRadius: 2,
                  }}
                >
                  Load Proof JSON
                  <input
                    type="file"
                    hidden
                    accept=".json"
                    onChange={handleFileUpload}
                  />
                </Button>
                {dataMap && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#48BB78",
                      mt: 1,
                      display: "block",
                      textAlign: "center",
                    }}
                  >
                    Active dataset loaded
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>

          {/* STATUS LOG: Cyber terminal look */}
          <Box
            sx={{
              p: 2,
              m: 2,
              bgcolor: isDark ? "#080A0F" : "#EDF2F7",
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <TerminalIcon
                sx={{ fontSize: 14, color: isDark ? "#4FD1C5" : "#3182ce" }}
              />
              <Typography
                variant="caption"
                sx={{ color: isDark ? "#4FD1C5" : "#3182ce", fontWeight: 800 }}
              >
                SYSTEM LOG
              </Typography>
            </Stack>
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: isDark ? "#0bf52eff" : "#2F855A",
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {`> ${status}`}
            </Typography>
          </Box>
        </Box>

        {/* MAIN WORKSPACE */}
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.default",
          }}
        >
          <AppBar
            position="static"
            elevation={0}
            sx={{
              bgcolor: "transparent",
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <StorageIcon sx={{ color: "#4A5568", fontSize: 20 }} />
                <Typography
                  variant="subtitle2"
                  sx={{ color: "text.secondary", fontWeight: 600 }}
                >
                  Verification Workspace
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                {dataMap && (
                  <Chip
                    label="SECURE ENVIRONMENT"
                    size="small"
                    sx={{
                      height: 20,
                      bgcolor: "divider",
                      color: "primary.main",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  />
                )}
                <IconButton
                  onClick={colorMode.toggleColorMode}
                  color="inherit"
                  size="small"
                >
                  {isDark ? (
                    <LightModeOutlinedIcon fontSize="small" />
                  ) : (
                    <DarkModeOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </Stack>
            </Toolbar>
          </AppBar>

          <Box sx={{ flexGrow: 1, p: 4, overflowY: "auto" }}>
            {!dataMap ? (
              <Fade in={true}>
                <Box
                  sx={{
                    height: "80%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed #1A202C",
                    borderRadius: 6,
                  }}
                >
                  <CloudUploadIcon
                    sx={{ fontSize: 60, color: "divider", mb: 2 }}
                  />
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ opacity: 0.3 }}
                    fontWeight={700}
                  >
                    NO DATA SOURCE FOUND
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ opacity: 0.3 }}
                  >
                    Please upload a JSON file to begin verification
                  </Typography>
                </Box>
              </Fade>
            ) : (
              <Grid container spacing={2}>
                {Object.keys(dataMap).map((key) => (
                  <Grid
                    size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}
                    key={key}
                    sx={{ p: 1 }}
                  >
                    <Paper
                      sx={{
                        p: 2.5,
                        bgcolor: "background.paper",
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 3,
                        transition: "all 0.2s",
                        position: "relative",
                        overflow: "hidden",
                        "&:hover": {
                          borderColor: "#3182ce",
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={2}
                      >
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ color: "text.primary" }}
                        >
                          {key.toUpperCase()}
                        </Typography>
                        {verifiedFields[key] === true && (
                          <CheckCircleIcon
                            sx={{ color: "success.main", fontSize: 18 }}
                          />
                        )}
                        {verifiedFields[key] === false && (
                          <ErrorOutlineIcon
                            sx={{ color: "error.main", fontSize: 18 }}
                          />
                        )}
                      </Stack>

                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          opacity: 0.6,
                          display: "block",
                          mb: 2,
                          fontFamily: "monospace",
                        }}
                      >
                        Hash: {dataMap[key].hash.substring(0, 16)}...
                      </Typography>

                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        disabled={loadingField === key}
                        onClick={() => runVerification(key)}
                        sx={{
                          textTransform: "none",
                          borderColor: "divider",
                          color: "text.secondary",
                          "&:hover": {
                            borderColor: "primary.main",
                            color: "primary.main",
                          },
                        }}
                      >
                        {loadingField === key ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          "Reveal & Verify"
                        )}
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>

      {/* VERIFICATION RESULT DIALOG */}
      <Dialog
        open={!!result}
        onClose={() => setResult(null)}
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4,
            minWidth: 450,
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", gap: 2, pb: 1 }}
        >
          {result?.isValid ? (
            <VerifiedUserIcon sx={{ color: "success.main" }} />
          ) : (
            <GppBadIcon sx={{ color: "error.main" }} />
          )}
          <Typography variant="h6" fontWeight={800}>
            {result?.isValid ? "INTEGRITY VERIFIED" : "CANNOT VERIFY INTEGRITY"}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  opacity: 0.8,
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                Field Identifier
              </Typography>
              <Typography
                variant="body1"
                sx={{ fontWeight: 700, color: "text.primary" }}
              >
                {result?.field.toUpperCase()}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                bgcolor: isDark ? "#080A0F" : "#EDF2F7",
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <FingerprintIcon
                  sx={{
                    fontSize: 16,
                    color: result?.isValid
                      ? isDark
                        ? "#4FD1C5"
                        : "#3182ce"
                      : "error.main",
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: result?.isValid
                      ? isDark
                        ? "#4FD1C5"
                        : "#3182ce"
                      : "error.main",
                    fontWeight: 800,
                  }}
                >
                  REVEALED DATA
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "18px",
                  color: "text.primary",
                  fontWeight: 900,
                }}
              >
                {result?.value || "N/A"}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  opacity: 0.8,
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                Cryptographic Salt
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: "monospace",
                  color: "text.secondary",
                  wordBreak: "break-all",
                }}
              >
                {result?.salt}
              </Typography>
            </Box>

            {!result?.isValid && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: isDark ? "rgba(245, 101, 101, 0.1)" : "#FFF5F5",
                  border: "1px solid",
                  borderColor: "error.main",
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: "error.main", fontWeight: 600 }}
                >
                  {result?.error ||
                    "The local proof root does not match any certificate authorized for this wallet on the blockchain."}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setResult(null)}
            fullWidth
            variant="contained"
            sx={{
              bgcolor: result?.isValid ? "primary.main" : "error.main",
              "&:hover": {
                bgcolor: result?.isValid ? "primary.dark" : "error.dark",
              },
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
            }}
          >
            Close Handshake
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProofVerifier;
