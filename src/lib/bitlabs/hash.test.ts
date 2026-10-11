import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { callbackUrlForHash, verifyBitlabsHash } from "@/lib/bitlabs/hash";

const secret = "JLOIAUNMHFli7ZJOQVEzm98rzqnm9";
const unsigned = "https://publisher.com/complete?uid=8cc877ee-af19-488d-b28d-216fb866b996&val=500";
const documentedHash = "dbcd6bb8ca677344592842a52b4fca9bec36cd4b";

describe("BitLabs callback hash", () => {
  it("matches the documented HMAC-SHA1 example", () => {
    const computed = createHmac("sha1", secret).update(unsigned).digest("hex");
    expect(computed).toBe(documentedHash);
    expect(verifyBitlabsHash(`${unsigned}&hash=${documentedHash}`, secret)).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const url = `https://publisher.com/complete?uid=8cc877ee-af19-488d-b28d-216fb866b996&val=501&hash=${documentedHash}`;
    expect(verifyBitlabsHash(url, secret)).toBe(false);
  });

  it("rejects a missing hash", () => {
    expect(verifyBitlabsHash(unsigned, secret)).toBe(false);
  });

  it("rebuilds the public callback URL without changing the query string", () => {
    const requestUrl = "http://internal:3000/api/bitlabs/postback?uid=abc&tx=1&hash=ff";
    expect(callbackUrlForHash(requestUrl, "https://opiniated.example/api/bitlabs/postback")).toBe(
      "https://opiniated.example/api/bitlabs/postback?uid=abc&tx=1&hash=ff",
    );
  });
});
