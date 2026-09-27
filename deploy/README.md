# Hosting outside Vercel

The timetable is a static site. It does not require Node.js, Vercel Functions, or a database on the server: the browser reads the public Google Sheet when the page loads.

## Docker deployment

On a VPS or cloud server reachable by the intended users:

```sh
git clone https://github.com/davidip1243-boop/psmb-uroki.git
cd psmb-uroki
docker build -t psmb-uroki .
docker rm -f psmb-uroki 2>/dev/null || true
docker run -d --name psmb-uroki --restart unless-stopped -p 80:80 psmb-uroki
```

The site will be available on the server IP over HTTP. Put a domain in front of it and enable HTTPS before sharing it publicly. Caddy or Nginx + Certbot can terminate HTTPS on ports 80/443 and proxy to the container on a local port.

## Updating the site

After a repository update:

```sh
git pull --ff-only
docker build -t psmb-uroki .
docker rm -f psmb-uroki
docker run -d --name psmb-uroki --restart unless-stopped -p 80:80 psmb-uroki
```

The timetable data itself refreshes from Google Sheets in the browser on every page load, so a schedule edit does not require rebuilding the container.
