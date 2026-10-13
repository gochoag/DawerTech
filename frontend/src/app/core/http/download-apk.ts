const MAX_BYTES = 64 * 1024 * 1024;

export async function downloadApkFile(url: string, size: number, sha256: string | undefined,
  signal: AbortSignal, progress: (received: number, total: number) => void): Promise<Blob> {
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) throw new Error('El tamaño del APK no es válido.');
  let response: Response;
  try { response = await fetch(url, { signal, credentials: 'omit', cache: 'no-store' }); }
  catch {
    if (signal.aborted) throw new DOMException('Descarga cancelada', 'AbortError');
    throw new Error('No se pudo descargar el APK. Revisa tu conexión o usa la descarga alternativa.');
  }
  if (!response.ok || !response.body || !['application/vnd.android.package-archive', 'application/octet-stream'].includes(response.headers.get('content-type')?.split(';')[0] || '')) {
    throw new Error('No se pudo descargar el APK. Revisa tu conexión o usa la descarga alternativa.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Descarga cancelada', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > size || received > MAX_BYTES) throw new Error('El APK descargado tiene un tamaño inesperado.');
      chunks.push(new Uint8Array(value));
      progress(received, size);
    }
  } catch (error: any) {
    await reader.cancel().catch(() => {});
    if (signal.aborted) throw new DOMException('Descarga cancelada', 'AbortError');
    if (error?.name === 'TypeError') throw new Error('La conexión se interrumpió. Inténtalo de nuevo.');
    throw error;
  }
  finally { reader.releaseLock(); }
  if (signal.aborted) throw new DOMException('Descarga cancelada', 'AbortError');
  if (received !== size) throw new Error('La descarga quedó incompleta. Inténtalo de nuevo.');
  const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
  if (sha256 && globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== sha256) throw new Error('El APK no pasó la verificación. Inténtalo de nuevo.');
  }
  if (signal.aborted) throw new DOMException('Descarga cancelada', 'AbortError');
  return blob;
}
