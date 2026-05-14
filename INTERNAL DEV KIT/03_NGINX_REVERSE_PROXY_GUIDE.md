# NGINX Reverse Proxy Guide

This guide explains how to set up NGINX for DTO bespoke internal applications.

It is written for:
- engineers
- junior technical staff
- operators
- beginners following a step-by-step runbook

## 1. What NGINX is doing

In our standard architecture, NGINX does four jobs:

1. receives web traffic on port `80` and `443`
2. handles TLS / SSL certificates
3. serves built frontend files from disk
4. forwards API requests to the Python backend

## 2. Standard traffic flow

```text
Browser
  -> HTTPS 443
NGINX
  -> serves static frontend files
  -> proxies /api/* to backend on localhost:8000
Backend
  -> talks to PostgreSQL on localhost:5433
```

## 3. Terms explained simply

- reverse proxy
  - a server that sits in front of your application and passes requests to it
- upstream
  - the backend service NGINX forwards requests to
- SSL termination / TLS termination
  - NGINX handles the certificate and encrypted connection so the backend does not need to
- headers
  - extra request information such as host, client IP, or protocol

## 4. Standard route pattern

Recommended routes:
- `/api/` -> backend
- `/dashboard/` -> admin/dashboard SPA if used
- `/app/` -> main user SPA if used
- `/health` or `/api/health` -> application health

If the app has multiple SPAs, make each base path explicit.

## 5. Standard file locations on Ubuntu

Ubuntu is the approved DTO Linux standard for application VMs.

- NGINX site file: `/etc/nginx/sites-available/<app-name>.conf`
- enabled link: `/etc/nginx/sites-enabled/<app-name>.conf`
- certificate: `/etc/ssl/<app-name>/<app-name>.crt`
- key: `/etc/ssl/<app-name>/<app-name>.key`

## 6. Beginner step-by-step: create an NGINX site

### Step 1: confirm NGINX is installed

```bash
nginx -v
```

If command is not found:

```bash
sudo apt update
sudo apt install -y nginx
```

### Step 2: create certificate folder

```bash
sudo mkdir -p /etc/ssl/<app-name>
```

### Step 3: place the certificate and key

Copy the real files into:
- `/etc/ssl/<app-name>/<app-name>.crt`
- `/etc/ssl/<app-name>/<app-name>.key`

### Step 4: copy the NGINX template

Use:
- `templates/nginx/app.conf.template`

Copy it to:

```bash
sudo cp "templates/nginx/app.conf.template" "/etc/nginx/sites-available/<app-name>.conf"
```

### Step 5: edit the placeholders

Replace:
- `__SERVER_NAME__`
- `__APP_ROOT__`
- `__SSL_CERT__`
- `__SSL_KEY__`
- `__BACKEND_UPSTREAM__`

### Step 6: enable the site

```bash
sudo ln -s /etc/nginx/sites-available/<app-name>.conf /etc/nginx/sites-enabled/<app-name>.conf
```

### Step 7: test the config

```bash
sudo nginx -t
```

If the test passes, reload NGINX:

```bash
sudo systemctl reload nginx
```

## 7. Required proxy headers

When proxying `/api/` to the backend, include:

- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

Why:
- backend can log correct source info
- backend knows whether original request was HTTPS
- host-aware logic stays correct

## 8. SSL / TLS termination

### What it means

The browser talks HTTPS to NGINX.

NGINX then talks HTTP to the backend on localhost.

This is normal for internal apps.

### Standard behavior

- listen on `443 ssl`
- redirect `80` to `443`
- keep certificate and key readable by root and NGINX

## 9. Upstream backend configuration

Standard upstream target:

```text
http://127.0.0.1:8000
```

Why:
- backend is local to the same VM
- localhost avoids unnecessary network exposure

## 10. Static frontend serving

Frontend build output should live under:

```text
/opt/<app-name>/frontends-src/
```

Examples:
- `/opt/<app-name>/frontends-src/dashboard/dist`
- `/opt/<app-name>/frontends-src/app/dist`

For SPAs, use `try_files` so route refreshes still load `index.html`.

## 11. Cache handling

The browser must not keep an old HTML shell forever after deployment.

Why this is called out explicitly:
- in CWSCX, stale browser shell behavior and static asset confusion were real deployment troubleshooting issues
- this is not a project-specific quirk to ignore; it is now part of the standard operating guidance

Recommended baseline for `index.html` responses:
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

Why:
- CWSCX hit stale frontend behavior during rollout and troubleshooting

## 12. Example health endpoint exposure

Recommended:
- public inside internal network only
- no authentication required

Examples:
- `https://<app-host>/api/health`
- `https://<app-host>/api/health/ready`

These are used by Uptime Kuma and troubleshooting.

## 13. Common routing mistakes

### Mistake 1: frontend base path does not match NGINX path

Symptom:
- blank page
- JS asset 404
- browser console shows module or asset errors

### Mistake 2: wrong `dist` folder path

Symptom:
- route returns 404 or old content

### Mistake 3: `/api/` proxy missing trailing slash behavior

Symptom:
- backend gets wrong path

### Mistake 4: no SPA `try_files`

Symptom:
- homepage works
- direct refresh on sub-route returns 404

### Mistake 5: SSL file path wrong

Symptom:
- `nginx -t` fails
- service cannot restart

## 14. Troubleshooting for beginners

### Check 1: does NGINX config validate?

```bash
sudo nginx -t
```

### Check 2: is NGINX running?

```bash
sudo systemctl status nginx
```

### Check 3: restart NGINX

```bash
sudo systemctl restart nginx
```

### Check 4: can the backend answer locally?

```bash
curl -fsS http://127.0.0.1:8000/health
```

### Check 5: can the public route answer?

```bash
curl -kfsS https://<app-host>/api/health
```

### Check 6: inspect NGINX logs

```bash
sudo journalctl -u nginx --no-pager -n 100
```

## 15. Common problems and meaning

### Problem: `502 Bad Gateway`

Usually means:
- backend not running
- backend crashed
- wrong upstream port

### Problem: frontend loads but API calls fail

Usually means:
- `/api/` proxy wrong
- backend unhealthy
- auth issue in app, not NGINX

### Problem: JS module MIME error

Usually means:
- HTML is being returned instead of JS asset
- wrong asset path
- wrong base path

### Problem: app still shows old UI after deploy

Usually means:
- browser cached old shell
- wrong build copied
- wrong active `dist/` path

Tell the user to try:
1. refresh
2. hard refresh
3. sign out and sign back in
4. clear browser cache/site data
5. try an incognito window

## 16. Change checklist before saving NGINX config

Confirm all of these:
- server name is correct
- certificate file path is correct
- key file path is correct
- frontend folder path is correct
- backend upstream is correct
- SPA `try_files` exists
- `/api/` proxy block exists
- headers are included

## 17. Template

Use:
- `templates/nginx/app.conf.template`
