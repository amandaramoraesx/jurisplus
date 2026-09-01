export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnexoIcone({ tipo }: { tipo: string }) {
  if (tipo === "application/pdf") return <>📄</>;
  if (tipo.startsWith("image/")) return <>🖼️</>;
  if (tipo.includes("presentation") || tipo.includes("powerpoint")) return <>📊</>;
  return <>📎</>;
}
