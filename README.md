# SnapScale Pro

Advanced photo editing website + server.

## Features
- Responsive premium editor UI
- Resize, brightness, saturation, blur
- Rotate, flip and mirror
- JPG / PNG / WebP export
- Public JWT login/register-ready API
- Admin JWT login
- Server health and admin dashboard
- 15 MB image upload
- Sharp server-side image processing
- GitHub Actions-ready

## Run
1. `npm install`
2. Set `ADMIN_USERNAME=aroh097`, `ADMIN_PASSWORD` and a strong `JWT_SECRET` as environment variables.
3. `npm start`
4. Open `http://localhost:3000`

Do not commit real passwords or JWT secrets to GitHub. For Render/Railway, put them in the service's environment variables.
