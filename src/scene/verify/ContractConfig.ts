export const CONTRACT_ADDRESS = "0x1Da26345D7d4e24a148C2B49E9b2C8af2e3e5239";

export const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "getDocuments",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "requester",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "verifer",
        "type": "address[]"
      },
      {
        "internalType": "string[]",
        "name": "institute",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "hash",
        "type": "string[]"
      },
      {
        "internalType": "enum Verification.CertificateStatus[]",
        "name": "stats",
        "type": "uint8[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
