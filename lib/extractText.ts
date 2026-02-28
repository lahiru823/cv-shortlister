export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Dynamic import avoids bundling issues with pdf-parse's test file references
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text.trim();
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return extractTextFromPDF(buffer);
  if (lower.endsWith('.docx')) return extractTextFromDOCX(buffer);
  throw new Error(`Unsupported file type: ${filename}`);
}
