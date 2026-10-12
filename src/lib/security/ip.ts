import { clientIp } from "@/lib/risk/ip-address";

export function clientIpFromHeaders(headers: Headers, trustProxy?: boolean): string | null {
  return clientIp(headers, trustProxy);
}
