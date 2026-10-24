# Frame Maker – षष्ठी पूर्ति | विश्व कल्याण महोत्सव

A small web app where a user uploads their photo, selects the area they want, and gets a profile picture placed inside the round Shashthipurti Mahotsav frame. The background of the photo is removed automatically, and only the person is placed on the left side of the circle.

**Privacy:** everything runs inside the user's browser. Photos are never uploaded to any server or stored anywhere.

## How it works

1. The user uploads a photo from their phone or computer.
2. The user drags and resizes a free-form crop box over the photo.
3. The background is removed in the browser (AI model, no server needed).
4. The person is placed on the left side of the round frame.
5. The user downloads the final image as a PNG (1080 × 1080).

## Tech stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com) v4
- [react-image-crop](https://github.com/DominicTobias/react-image-crop) for the free crop box
- [@imgly/background-removal](https://github.com/imgly/background-removal-js) for in-browser background removal

## Getting started

Requirements: [Node.js](https://nodejs.org) 18 or newer.

```bash
# install packages
npm install

# start the dev server
npm run dev
```

Open the **Local** link shown in the terminal. To test on your phone, open the **Network** link (phone and computer must be on the same Wi-Fi).

## Build for production

```bash
npm run build
```

The output is created in the `dist` folder.

## Deployment (Vercel + GitHub)

1. Push this project to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com) with GitHub and choose **Add New → Project**.
3. Import the repository. Vercel detects the settings automatically:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**.

After this, every `git push` to the `main` branch updates the live site automatically:

```bash
git add .
git commit -m "describe your change"
git push
```

## Project structure

```
frame-maker/
├── public/
│   └── frame.png        # the round frame (transparent outside the circle)
├── src/
│   ├── App.jsx          # screens: upload, crop, processing, result
│   ├── compose.js       # draws the final image on a canvas
│   ├── index.css        # Tailwind import
│   └── main.jsx         # app entry
├── index.html
├── package.json
└── vite.config.js
```

## Customisation

### Change the frame

Replace `public/frame.png` with a new square PNG of the round frame (transparent outside the circle).

### Change where the person is placed

Open `src/compose.js` and edit the `AREA` values at the top:

```js
export const AREA = {
  x0: 0.04,   // left limit (fraction of frame width)
  x1: 0.52,   // right limit; keep it below where the badge starts
  maxH: 0.93, // maximum height of the person
}
```

### Change the output size

In `src/compose.js`, change the `OUTPUT` value (default `1080`).

## Notes

- The first time a user removes a background, the browser downloads an AI model (roughly 40–80 MB). It is cached afterwards, so later uses are faster. Users need an internet connection for this first download.
- If background removal fails, the app uses the user's cropped photo as it is and shows a short message.
- Very old or low-memory phones may be slow when processing large photos.

## License

All rights reserved. Frame artwork and photographs belong to their respective owners.