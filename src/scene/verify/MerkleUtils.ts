export interface MerkleField {
  hash: string;
  key: string;
  salt: string;
  value: string;
}

export interface ProofMap {
  [key: string]: MerkleField;
}

export interface Proof {
  value: string;
  salt: string;
  merkleProof: string[]; 
  rootHash: string;
}

/**
 * Mimics Go's HashData([]byte, []byte)
 */
export const hashData = async (val1: string, val2: string): Promise<string> => {
  const encoder = new TextEncoder();
  const d1 = encoder.encode(val1);
  const d2 = encoder.encode(val2);
  
  const combined = new Uint8Array(d1.length + d2.length);
  combined.set(d1);
  combined.set(d2, d1.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Calculates the Merkle Root from an ordered list of leaf hashes
 */
export const calculateMerkleRoot = async (leaves: string[]): Promise<string> => {
  if (leaves.length === 0) return "";
  if (leaves.length === 1) return leaves[0];

  const currentLeaves = [...leaves];
  if (currentLeaves.length % 2 !== 0) {
    currentLeaves.push(currentLeaves[currentLeaves.length - 1]);
  }

  const nextLevel: string[] = [];
  for (let i = 0; i < currentLeaves.length; i += 2) {
    const h1 = currentLeaves[i];
    const h2 = currentLeaves[i + 1];

    // Canonical sorting to ensure parent hash consistency
    const result = h1 < h2 
      ? await hashData(h1, h2) 
      : await hashData(h2, h1);
    nextLevel.push(result);
  }

  return calculateMerkleRoot(nextLevel);
};

/**
 * Main verification function
 */
const verifyProof = async (p: Proof, expectedRoot: string): Promise<boolean> => {
  console.log("called verify")
  const disclosedLeafHash = await hashData(p.value, p.salt);
  const found = p.merkleProof.includes(disclosedLeafHash);
  if (!found) {
    return false
  };

  const calculatedRoot = await calculateMerkleRoot(p.merkleProof);
  return calculatedRoot === expectedRoot;
};

export default verifyProof