// STUN-only per the constitution's accepted v1 tradeoff: no TURN relay, so
// calls between peers on strict/symmetric NAT networks may fail to connect
// directly. This is a known, accepted limitation, not a bug.
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS })
}
