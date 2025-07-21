export function formatQuote(text: string): string {
  return `<blockquote>${text}</blockquote>`;
}

export function formatMultilineQuote(lines: string[]): string {
  return formatQuote(lines.join('\n'));
}
