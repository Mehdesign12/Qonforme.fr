/**
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Source : scripts/generate-pwa-assets.mjs
 *
 * iOS n'utilise pas les icônes du manifest pour l'écran de démarrage : il lui faut
 * un <link rel="apple-touch-startup-image"> par combinaison taille/densité/orientation.
 */
export type AppleSplashScreen = {
  /** Chemin du PNG dans /public. */
  href: string
  /** Média-query ciblant exactement un modèle et une orientation. */
  media: string
  /** Modèle correspondant — documentaire uniquement. */
  label: string
}

export const APPLE_SPLASH_SCREENS: AppleSplashScreen[] = [
  {
    "href": "/splash/apple-splash-640-960.png",
    "media": "screen and (device-width: 320px) and (device-height: 480px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPhone 4/4s — portrait"
  },
  {
    "href": "/splash/apple-splash-960-640.png",
    "media": "screen and (device-width: 320px) and (device-height: 480px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPhone 4/4s — landscape"
  },
  {
    "href": "/splash/apple-splash-640-1136.png",
    "media": "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPhone 5/5s/SE 1 — portrait"
  },
  {
    "href": "/splash/apple-splash-1136-640.png",
    "media": "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPhone 5/5s/SE 1 — landscape"
  },
  {
    "href": "/splash/apple-splash-750-1334.png",
    "media": "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPhone 6/7/8/SE 2-3 — portrait"
  },
  {
    "href": "/splash/apple-splash-1334-750.png",
    "media": "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPhone 6/7/8/SE 2-3 — landscape"
  },
  {
    "href": "/splash/apple-splash-1242-2208.png",
    "media": "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 6+/7+/8+ — portrait"
  },
  {
    "href": "/splash/apple-splash-2208-1242.png",
    "media": "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 6+/7+/8+ — landscape"
  },
  {
    "href": "/splash/apple-splash-1125-2436.png",
    "media": "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone X/XS/11 Pro/12 mini — portrait"
  },
  {
    "href": "/splash/apple-splash-2436-1125.png",
    "media": "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone X/XS/11 Pro/12 mini — landscape"
  },
  {
    "href": "/splash/apple-splash-828-1792.png",
    "media": "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPhone XR/11 — portrait"
  },
  {
    "href": "/splash/apple-splash-1792-828.png",
    "media": "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPhone XR/11 — landscape"
  },
  {
    "href": "/splash/apple-splash-1242-2688.png",
    "media": "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone XS Max/11 Pro Max — portrait"
  },
  {
    "href": "/splash/apple-splash-2688-1242.png",
    "media": "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone XS Max/11 Pro Max — landscape"
  },
  {
    "href": "/splash/apple-splash-1080-2340.png",
    "media": "screen and (device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 12/13 mini — portrait"
  },
  {
    "href": "/splash/apple-splash-2340-1080.png",
    "media": "screen and (device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 12/13 mini — landscape"
  },
  {
    "href": "/splash/apple-splash-1170-2532.png",
    "media": "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 12/13/14 — portrait"
  },
  {
    "href": "/splash/apple-splash-2532-1170.png",
    "media": "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 12/13/14 — landscape"
  },
  {
    "href": "/splash/apple-splash-1284-2778.png",
    "media": "screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 12/13 Pro Max/14 Plus — portrait"
  },
  {
    "href": "/splash/apple-splash-2778-1284.png",
    "media": "screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 12/13 Pro Max/14 Plus — landscape"
  },
  {
    "href": "/splash/apple-splash-1179-2556.png",
    "media": "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 14 Pro/15/15 Pro/16 — portrait"
  },
  {
    "href": "/splash/apple-splash-2556-1179.png",
    "media": "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 14 Pro/15/15 Pro/16 — landscape"
  },
  {
    "href": "/splash/apple-splash-1290-2796.png",
    "media": "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 14 Pro Max/15 Plus/16 Plus — portrait"
  },
  {
    "href": "/splash/apple-splash-2796-1290.png",
    "media": "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 14 Pro Max/15 Plus/16 Plus — landscape"
  },
  {
    "href": "/splash/apple-splash-1206-2622.png",
    "media": "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 16 Pro — portrait"
  },
  {
    "href": "/splash/apple-splash-2622-1206.png",
    "media": "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 16 Pro — landscape"
  },
  {
    "href": "/splash/apple-splash-1320-2868.png",
    "media": "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
    "label": "iPhone 16 Pro Max — portrait"
  },
  {
    "href": "/splash/apple-splash-2868-1320.png",
    "media": "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
    "label": "iPhone 16 Pro Max — landscape"
  },
  {
    "href": "/splash/apple-splash-1536-2048.png",
    "media": "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad 9.7\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2048-1536.png",
    "media": "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad 9.7\" — landscape"
  },
  {
    "href": "/splash/apple-splash-1620-2160.png",
    "media": "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad 10.2\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2160-1620.png",
    "media": "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad 10.2\" — landscape"
  },
  {
    "href": "/splash/apple-splash-1640-2360.png",
    "media": "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad Air 10.9\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2360-1640.png",
    "media": "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad Air 10.9\" — landscape"
  },
  {
    "href": "/splash/apple-splash-1668-2224.png",
    "media": "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad Pro 10.5\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2224-1668.png",
    "media": "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad Pro 10.5\" — landscape"
  },
  {
    "href": "/splash/apple-splash-1668-2388.png",
    "media": "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad Pro 11\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2388-1668.png",
    "media": "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad Pro 11\" — landscape"
  },
  {
    "href": "/splash/apple-splash-2048-2732.png",
    "media": "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
    "label": "iPad Pro 12.9\" — portrait"
  },
  {
    "href": "/splash/apple-splash-2732-2048.png",
    "media": "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
    "label": "iPad Pro 12.9\" — landscape"
  }
]
