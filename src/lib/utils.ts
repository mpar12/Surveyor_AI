export function cn(...inputs: Array<string | number | undefined | null | false>) {
  return inputs.filter(Boolean).join(" ");
}
