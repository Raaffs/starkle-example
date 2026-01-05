import React, { useState, type ChangeEvent } from 'react';
import type { 
    ProofMap,
    Proof,
    MerkleField
 } from './MerkleUtils';

 import verifyProof from './MerkleUtils';

const ProofVerifier: React.FC = () => {
  const [dataMap, setDataMap] = useState<ProofMap | null>(null);
  const [status, setStatus] = useState<string>('');

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (event) => {
    const rawText = event.target?.result;
    
    if (typeof rawText !== "string") {
      setStatus("Error: File result is not a string.");
      return;
    }

    try {
      // 1. Parse the JSON
      const parsed = JSON.parse(rawText);
      
      // 2. Explicitly log it to see if it's empty in the browser console
      console.log("Raw JSON parsed:", parsed);

      // 3. Set state
      setDataMap(parsed as ProofMap);
      setStatus("File loaded successfully.");
    } catch (err) {
      console.error("JSON Parse Error:", err);
      setStatus("Invalid JSON file format.");
    }
  };

  reader.readAsText(file);
};

  const runVerification = async (fieldKey: string) => {
    if (!dataMap || !dataMap[fieldKey]) return;

    // In a real scenario, the expected root comes from your contract/DB
    const expectedRoot = "94ac7ca53356bf8cf6901d73b747315f10f83426e545ef40a4f3df59ebc11c6c";
    
    // Constructing the Proof object from the map data
    // Note: Ensure your JSON structure contains the full merkleProof array
    const proof: Proof = {
        value: dataMap[fieldKey].value,
        salt: dataMap[fieldKey].salt,
         merkleProof: Object.values(dataMap).map((value: MerkleField)=>{
          return value.hash
        }) || [], // Adjust based on your JSON schema
        rootHash: expectedRoot
    };

    const isValid = await verifyProof(proof, expectedRoot);
    setStatus(isValid ? `✅ ${fieldKey} is Verified!` : `❌ ${fieldKey} Verification Failed.`);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h2>Merkle Proof Verifier</h2>
      <input type="file" accept=".json" onChange={handleFileUpload} />
      
      <p>Status: <strong>{status}</strong></p>

      {dataMap && (
        <div>
          <h4>Fields detected:</h4>
          {Object.keys(dataMap).map(key => (
            <button key={key} onClick={() => runVerification(key)} style={{ marginRight: '8px' }}>
              Verify {key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProofVerifier;