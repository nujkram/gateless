# Gateless brand

An open gateway with light coming through it, and nothing in the opening.

The threshold bar at the foot is load-bearing: without it an arch reads as a
horseshoe. The bar makes it a doorway you step through, and the light inside
makes it an *open* one. That is the whole name in one mark.

## Files

| File | Use |
| --- | --- |
| `gateless-icon-1024.png` | Developer Portal app icon, and the Discord server icon |
| `gateless-icon-512.png` | Same mark, smaller, if anything asks for 512 |
| `gateless-alt-round-*.png` | The round-arch version. Not in use; kept because it is a one-line change away |
| `preview.png` | Contact sheet: square, circle-cropped, and at 48 / 32 / 20px |

Upload the 1024 in both places. Discord wants 1024 for the app icon and at
least 512 for the server, so one file covers both.

## Palette

| | Hex | Where |
| --- | --- | --- |
| Gold, top | `#FAD884` | top of the arch gradient |
| Gold, foot | `#D67C30` | bottom of the arch gradient |
| Indigo, centre | `#202A4A` | background, behind the mark |
| Indigo, edge | `#090C16` | background, at the corners |
| Warm light | `#FFE7B4` | the glow through the opening |

The gold matches the Legion Master role colour in `src/config/roles.js`.

## Regenerating

```bash
python brand/make-logo.py
python brand/make-preview.py
```

Needs Pillow and numpy. Everything is drawn at 4x and downscaled with
LANCZOS, which is what gives clean curves without a vector renderer.

## Two constraints worth keeping

**The circle crop.** A Discord server icon is cropped to a circle. Both marks
sit at a measured max radius of 0.430 from centre, against the 0.500 where
clipping starts. If you move anything outward, re-check it.

**The sidebar.** The icon is seen at about 48px far more often than at 1024.
That is why there is one bold shape and no fine detail, and why `preview.png`
shows 48, 32 and 20px — those cells decide the design, not the big one.
