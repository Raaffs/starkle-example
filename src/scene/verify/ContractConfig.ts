export const CONTRACT_ADDRESS = "0x2884753e6a08f1fB80E7Ef1F3e48f564f10A9975";

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
        "components": [
          {
            "internalType": "enum DocumentRegistry.DocStatus",
            "name": "status",
            "type": "uint8"
          }
        ],
        "internalType": "struct DocumentRegistry.DocStatus[]",
        "name": "stats",
        "type": "uint8[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
