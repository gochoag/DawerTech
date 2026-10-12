import { networkInterfaces } from 'node:os';

export function lanAddresses(interfaces = networkInterfaces()) {
  return Object.entries(interfaces).flatMap(([name, addresses]) => {
    if (/virtual|vethernet|vmware|vbox|docker|wsl|tailscale|loopback/i.test(name)) return [];
    return (addresses ?? []).filter(address =>
      address.family === 'IPv4' && !address.internal &&
      !/^(?:00:15:5d|00:05:69|00:0c:29|00:50:56|08:00:27|0a:00:27):/i.test(address.mac) &&
      /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address.address)
    ).map(address => address.address);
  });
}

export function apiUrl({ android = false, env = process.env, interfaces } = {}) {
  const explicit = (android ? env.DAWERTECH_ANDROID_API_URL : undefined) || env.DAWERTECH_API_URL || undefined;
  const addresses = lanAddresses(interfaces);
  if (android && !explicit && !addresses.length) {
    throw new Error('No se encontró una IP de red local. Define DAWERTECH_API_URL=http://IP_DEL_PC:5000/api/v1.');
  }
  if (android && !explicit && addresses.length > 1) {
    throw new Error(`Hay varias interfaces de red: ${addresses.join(', ')}. Define DAWERTECH_API_URL con la IP del PC accesible desde el celular.`);
  }
  const url = new URL(explicit ?? `http://${android ? addresses[0] : 'localhost'}:5000/api/v1`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, '') !== '/api/v1') {
    throw new Error('DAWERTECH_API_URL debe ser una URL HTTP o HTTPS terminada en /api/v1.');
  }
  if (android && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('En Android usa la IP local del PC, no localhost, en DAWERTECH_API_URL.');
  }
  return url.href.replace(/\/$/, '');
}
