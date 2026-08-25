---
layout: default
title: Implementation Guide
permalink: /implement/
---

# Implement the Joshternet

This is a practical, non-normative guide to the participation mechanism that exists today.

[RFC-JOSH-0002][rfc-0002] defines the protocol and remains authoritative. [RFC-JOSH-0001][rfc-0001] defines the Josh identity semantics used by the optional `josh` member.

## What implementation requires today

An origin participates in the Joshternet by publishing a valid version 1 JSON declaration at exactly:

```text
/.well-known/josh
```

There is no trailing slash.

For this origin:

```text
https://example.invalid/
```

the declaration is published at:

```text
https://example.invalid/.well-known/josh
```

The declaration applies only to the origin that serves it. It does not automatically cover other origins or subdomains.

For example, `https://example.invalid/` and `https://www.example.invalid/` must publish their own declarations if both origins intend to declare participation.

## Choose a declaration

### Participate without declaring Josh identity

The minimum valid declaration is:

```json
{
  "version": 1
}
```

Publishing this declaration establishes participation with **Undeclared Josh Identity**.

It does not affirm or decline Josh identity. It must not be described as a Josh declaration, and identity must not be inferred from the site's name or content.

### Affirm Josh identity

A participant affirming Josh identity may publish:

```json
{
  "version": 1,
  "josh": true
}
```

The Boolean value `true` represents **Affirmed Josh Identity** according to RFC-JOSH-0001.

### Participate while declining Josh identity

A participating non-Josh may publish:

```json
{
  "version": 1,
  "josh": false
}
```

The Boolean value `false` represents **Declined Josh Identity** while the declaration still establishes participation.

It does not opt the origin out of the Joshternet.

Omitting `josh` is different from setting it to `false`. An omitted member means Undeclared Josh Identity, not Declined identity, Affirmed identity, or non-participation.

## Publish the declaration

The declaration can be an ordinary static file named `josh` inside a `.well-known` directory at the site's public root.

It does not require an API, database, middleware, framework, or client-side JavaScript. Handwritten sites, static generators, blogs, and web applications can all publish the same resource.

Clients retrieve the declaration using HTTP `GET`.

A valid declaration is normally returned with:

```text
200 OK
```

The server should return:

```text
Content-Type: application/json
```

The declaration must be publicly retrievable without authentication or client-side script execution. Normal HTTP caching may be used.

Serving the declaration directly is preferred. Consumers may follow same-origin redirects. A cross-origin redirect does not count as the declaration for the original origin.

After deployment, replace the fictional domain below with your own origin and inspect the response:

```sh
curl -i https://example.invalid/.well-known/josh
```

Check the status, content type, and JSON body.

## Validate version 1

A valid version 1 declaration must:

- contain valid JSON;
- use a JSON object as the top-level value;
- contain no duplicate member names;
- include `version`;
- set `version` to the JSON integer `1`;
- use a JSON Boolean for `josh` when that member is present.

The following declarations are invalid.

A string is not a valid version:

```json
{
  "version": "1"
}
```

A string is not a valid `josh` value:

```json
{
  "version": 1,
  "josh": "true"
}
```

A number is not a valid `josh` value:

```json
{
  "version": 1,
  "josh": 1
}
```

`null` is not a valid `josh` value:

```json
{
  "version": 1,
  "josh": null
}
```

Consumers must not coerce these values into valid ones.

## Unknown members

Version 1 declarations may contain members not defined by RFC-JOSH-0002.

Consumers should ignore unknown members unless another supported Joshternet specification defines them. Unknown members must not alter the meaning of `version`, `josh`, or participation through publication.

The examples in this guide use only the members defined by RFC-JOSH-0002.

## Stop declaring participation

An origin stops declaring participation by ceasing to publish a valid declaration.

Responses such as:

```text
404 Not Found
```

or:

```text
410 Gone
```

indicate that no declaration is currently published.

Temporary failures do not establish intentional withdrawal. DNS failures, TLS failures, timeouts, and server errors may prevent retrieval without showing that the operator intended to stop participating.

## Implementation checklist

Before considering an origin implemented, verify that:

- the path is exactly `/.well-known/josh`, without a trailing slash;
- the response body is a valid JSON object;
- no duplicate JSON member names are present;
- `version` is present and is the integer `1`;
- `josh`, when present, is a Boolean;
- HTTP `GET` normally returns `200 OK`;
- the response should use `Content-Type: application/json`;
- the resource is public and requires no authentication;
- retrieving the declaration requires no client-side JavaScript;
- any redirect that is followed remains on the same origin;
- the declaration is published separately for every participating origin.

## Authoritative text

Read [RFC-JOSH-0002: `/.well-known/josh`][rfc-0002] for the authoritative protocol requirements.

Read [RFC-JOSH-0001: Josh Identity][rfc-0001] for the authoritative definitions of Affirmed, Declined, and Undeclared Josh Identity.

The [Joshternet specification repository][spec] is the canonical home of the current specifications.

[rfc-0001]: https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md
[rfc-0002]: https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md
[spec]: https://github.com/joshternet/spec
