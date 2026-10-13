const MAX_BYTES = 64 * 1024 * 1024;
const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
const failure = (status = 502) => new Response('No se pudo descargar el APK. Intentalo de nuevo.', { status, headers });

export async function onRequestGet({ request, env }) {
  const code = new URL(request.url).searchParams.get('code');
  const repository = env.DAWERTECH_APK_REPOSITORY || 'gochoag/DawerTech';
  if (!/^[1-9]\d*$/.test(code || '') || Number(code) > 2100000000 || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return failure(400);
  try {
    const metadata = await fetch(`https://api.github.com/repos/${repository}/releases/tags/android-v${code}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DawerTech-APK-Download' },
      signal: AbortSignal.timeout(15000), cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!metadata.ok) return failure(metadata.status === 404 ? 404 : 502);
    const release = await metadata.json();
    const asset = Array.isArray(release.assets) ? release.assets.find(item => item.name === 'dawertech-release.apk' && item.state === 'uploaded') : null;
    if (release.draft || release.prerelease || release.tag_name !== `android-v${code}` || !asset || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_BYTES) return failure();
    const url = new URL(asset.browser_download_url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password ||
      url.pathname.toLowerCase() !== `/${repository}/releases/download/android-v${code}/dawertech-release.apk`.toLowerCase()) return failure();
    const apk = await fetch(url.href, { redirect: 'follow' });
    if (!apk.ok || !apk.body || !apk.url.startsWith('https://')) return failure();
    return new Response(apk.body, { headers: {
      ...headers, 'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="dawertech-release.apk"',
      'X-APK-Size': String(asset.size), 'X-Content-Type-Options': 'nosniff',
      'Access-Control-Expose-Headers': 'X-APK-Size',
    } });
  } catch { return failure(); }
}
