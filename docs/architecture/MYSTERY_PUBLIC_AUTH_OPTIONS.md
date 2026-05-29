# Public Mystery Shopper Authentication Options

This document compares the recommended authentication approaches for a public-facing Mystery Shopper survey deployed on a DMZ VM.

Audience:

- Platform Dev (Gregory)
- IT security (Travis)
- Product owners (Maria + Dan)

## 1) Background

The public Mystery Shopper survey will be used by external users who:

- are not on the internal network
- are not organisational staff
- do not have Microsoft Entra ID accounts

Because of that, the current Entra sign-in model used for internal frontends is not appropriate for this public deployment.

The current preferred options are:

- signed invitation links
- one-time passcode (OTP) login
- signed invitation link plus OTP verification

## 2) Option A: Signed Invitation Links

### Plain-language summary

An internal user creates or triggers a survey invitation.
The external user receives a unique secure link.
That link opens the survey directly without needing a username or password.

### User flow

1. internal user creates or schedules a Mystery Shopper invitation
2. system creates a signed token linked to that survey/session
3. system sends the link by email or message
4. external user opens the link
5. backend validates the token
6. user completes the survey
7. token is marked used, expired, or completed according to the rules

### What the link token should contain

- invitation ID
- expiry timestamp
- survey or location scope
- optional allowed number of uses
- integrity signature

### Benefits

- lowest friction for external users
- no password to remember
- no Entra dependency
- easy to scope per invitation or per survey
- good fit for occasional or one-time external users
- easy to revoke by invalidating the invitation record

### Drawbacks

- if the link is forwarded, another person may use it unless extra controls exist
- email delivery becomes important operationally
- link lifecycle must be managed carefully
- requires secure token signing and expiry design

### Good security controls

- short expiry times
- one-time or limited-use tokens
- rate limiting
- optional secondary verification such as email confirmation or OTP fallback
- audit log of invitation creation, open, submit, and expire events

### Best fit

Best when:

- the user journey must be extremely simple
- surveys are invitation-driven
- external users are occasional and not long-term account holders

## 3) Option B: One-Time Passcode (OTP)

### Plain-language summary

The external user enters an identifier such as email or mobile number.
The system sends a one-time code.
The user enters the code and is then allowed into the survey.

### User flow

1. external user opens the public Mystery Shopper page
2. user enters email address or mobile number
3. system sends a short-lived OTP
4. user enters the OTP
5. backend verifies the OTP and opens the survey session
6. user completes the survey

### Benefits

- stronger user possession check than a bare link
- less risk from forwarded invitation URLs alone
- familiar experience for many users
- no permanent password store needed

### Drawbacks

- more friction than magic links
- requires reliable email or SMS delivery
- more steps for the user
- extra backend complexity for OTP issue, resend, expiry, and lockout rules
- SMS may add cost and operational dependency if used

### Good security controls

- short OTP expiry
- resend throttling
- attempt limits and temporary lockout
- audit logging
- IP and session rate limiting

### Best fit

Best when:

- you want stronger proof that the intended recipient is using the survey
- users can tolerate one extra step
- security preference outweighs speed of access

## 4) Option C: Signed Invitation Link Plus OTP

### Plain-language summary

The user receives a secure invitation link, but opening the link is not enough on its own.
After opening it, the user must also complete a one-time passcode check before the survey is unlocked.

### User flow

1. internal user creates or schedules a Mystery Shopper invitation
2. system generates a signed invitation link tied to a specific survey/session
3. external user opens the link
4. backend validates the link token and checks it is still valid
5. system sends an OTP to the invited email address or phone number
6. user enters the OTP
7. backend validates the OTP and opens the survey session
8. user completes the survey

### Benefits

- stronger than signed links alone
- protects better against forwarded or leaked invitation URLs
- still keeps the user flow tied to a deliberate invitation
- avoids permanent user accounts and passwords
- provides a clearer chain of evidence that the intended recipient accessed the survey

### Drawbacks

- more friction than signed link only
- more implementation complexity than either single mechanism alone
- depends on both invitation delivery and OTP delivery
- more moving parts to troubleshoot
- more states to manage: invited, opened, OTP sent, OTP verified, expired, completed

### Best fit

Best when:

- access should remain invitation-only
- forwarding risk is a real concern
- the team wants stronger recipient verification without managing external user accounts

### Comparison against the other two

- compared with signed links only:
  - stronger security
  - more friction
  - more implementation work
- compared with OTP only:
  - more controlled invitation-driven access
  - clearer survey scoping per recipient
  - still slightly more complex overall

## 5) Comparison Summary

| Topic                            | Signed Invitation Link | OTP Login     | Signed Link + OTP    |
| -------------------------------- | ---------------------- | ------------- | -------------------- |
| User friction                    | Lowest                 | Medium        | Medium-high          |
| Security assurance               | Medium                 | Higher        | Highest of the three |
| Reliance on delivery channel     | Yes                    | Yes           | Yes, twice           |
| Best for invitation-only surveys | Yes                    | Yes           | Yes                  |
| Best for repeated users          | Less ideal             | More flexible | Less ideal           |
| Implementation complexity        | Lower                  | Higher        | Highest              |
| Link forwarding risk             | Higher                 | Lower         | Much lower           |

## 6) Recommended decision framing

If the business priority is:

### Fastest, simplest user journey

Choose:

- signed invitation links

### Stronger recipient verification

Choose:

- OTP login

### Invitation-only access with stronger verification

Choose:

- signed invitation link plus OTP

## 7) Shared implementation requirements regardless of option

No matter which option is chosen, the public Mystery Shopper deployment still needs:

- a separate public VM in the DMZ
- HTTPS only
- dedicated deploy workflow and runner
- restricted backend route exposure
- logging and audit trail
- rate limiting
- anti-abuse controls
- documented incident response path

## 8) Recommendation for first team discussion

Use this short framing with stakeholders:

- choose signed links if user simplicity is the top priority
- choose OTP if stronger recipient verification is the top priority
- choose signed link plus OTP if access should stay invitation-only but forwarded-link risk must be reduced

Neither option should use the internal Entra login model for public external users.
