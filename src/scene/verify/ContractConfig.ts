export const CONTRACT_ADDRESS = "0xA57B8a5584442B467b4689F1144D269d096A3daF";

export const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "getCertificates",
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
