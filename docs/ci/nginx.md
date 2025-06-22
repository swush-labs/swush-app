To host your app at **`app.swush.me`**, here's how you can set it up:

---

## ✅ 1. **Add a DNS Record for `app.swush.me`**

Go to your domain DNS settings and add:

```
Type: A
Host: app
Value: 139.84.164.3
TTL: Automatic or 30 mins
```

> This points `app.swush.me` to your server IP.

---

## ✅ 2. **Update Your NGINX Configuration**

On your server, create or update the NGINX config:

```bash
sudo nano /etc/nginx/sites-available/app-swush
```

Paste the following config:

```nginx
server {
    listen 80;
    server_name app.swush.me;

    location / {
        proxy_pass http://localhost:3000; # Assuming your app is running on port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable the site and restart NGINX:

```bash
sudo ln -s /etc/nginx/sites-available/app-swush /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ✅ 3. **Optional: Enable HTTPS with Let's Encrypt**

If you want to use HTTPS:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d app.swush.me
```

---

## ✅ 4. **Test**

Visit `http://app.swush.me` or `https://app.swush.me` in your browser. You should see your app.

---

### 💡 Notes:

* You can point other subdomains (like `dashboard.swush.me`, `api.swush.me`, etc.) similarly.
* If you're using **Docker**, **PM2**, or **Next.js custom server**, I can help you tweak the proxy settings.

Let me know if you want to host multiple apps on different subdomains or use wildcard certs like `*.swush.me`.


## Firewall rules

sudo ufw allow 80
sudo ufw allow 443
sudo ufw status


Setup help : https://chatgpt.com/share/685808c1-f4a8-8004-a24e-6fadb2986c91