
// Function to calculate the dot product of two vectors
function dotProduct(vecA: number[], vecB: number[]): number {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

// Function to calculate the magnitude of a vector
function magnitude(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

// Function to calculate the cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  const product = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return product / (magA * magB);
}
