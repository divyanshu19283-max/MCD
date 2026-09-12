# Fixes applied

## Map
- Fixed the OpenStreetMap Leaflet tile URL. The previous `{a-c}` placeholder is not a valid Leaflet subdomain token and caused the blank map.
- Uses `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with `a/b/c` subdomains.
- Bundles Leaflet CSS locally so map styling does not depend on the external stylesheet loading.
- Keeps a CARTO tile fallback if the primary tile provider returns tile errors.
- Keeps tap-to-drop-pin and selected-location centering.

## Real location
- The report form uses the browser's real `navigator.geolocation` coordinates.
- Coordinates are validated before they can be submitted.
- The selected GPS coordinates are sent to the real complaint API.
- For Chrome, real GPS on a LAN URL such as `http://192.168.x.x:8080` requires a secure context. On the same PC, use `http://localhost:8080`; for other devices, serve the app over HTTPS.

## Submit
- Submit sends the selected MCD category/subcategory, description, verified evidence URL, GPS latitude/longitude, address, and contact fields to the real `/api/complaints` endpoint.
- Non-2xx responses expose the server's actual error/details instead of a generic failure.
- A trailing-slash POST retry is kept for routers that expose `/api/complaints/`.
- Evidence upload is verified before Submit becomes enabled.

## SSR crash
- Fixed the dashboard crash `Element type is invalid ... got undefined`.
- The dashboard contains more MCD issue types than the small icon map. Previously those missing icons rendered as undefined components during SSR.
- Missing issue icons now safely use the `CircleHelp` fallback.
