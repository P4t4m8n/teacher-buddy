// A small valid one-page PDF, for the sample submissions of the seed. No imports: it is plain data like seed-data.ts, and travels light.

// The text is written in the PDF as it is, so it must be plain ASCII without parentheses or backslashes (they confuse the poor PDF).
export const createSamplePdf = (text: string): Uint8Array<ArrayBuffer> => {
  const stream: string = `BT /F1 24 Tf 72 760 Td (${text}) Tj ET`;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body: string, index: number) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart: number = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  // Every character is ASCII, so each one is one byte and the offsets above are byte offsets. Easy counting.
  return Uint8Array.from(pdf, (char: string) => char.charCodeAt(0));
};
