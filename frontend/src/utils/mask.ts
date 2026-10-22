/**
 * Маскирует IP-адрес или хост для отображения в списках (скрывает вторую половину)
 * Например: 138.124.29.213:56003 -> 138.124.***.***:56003
 */
export function maskPeer(peer: string | undefined): string {
  if (!peer) return '';

  const colonIdx = peer.lastIndexOf(':');
  let host = peer;
  let port = '';
  if (colonIdx > 0 && !peer.includes(']')) {
    host = peer.substring(0, colonIdx);
    port = peer.substring(colonIdx);
  }

  // IPv4 адрес
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    return `${ipv4Match[1]}.${ipv4Match[2]}.***.***${port}`;
  }

  // Доменное имя
  const parts = host.split('.');
  if (parts.length >= 3) {
    return `${parts[0]}.***.${parts[parts.length - 1]}${port}`;
  } else if (parts.length === 2) {
    const name = parts[0];
    const prefix = name.length > 2 ? name.substring(0, 2) : name;
    return `${prefix}***.${parts[1]}${port}`;
  }

  return host.length > 3 ? `${host.substring(0, 3)}***${port}` : `***${port}`;
}
