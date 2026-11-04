read when replacing a sample photo or checking where one came from

# Sample photos

What the sample pages show until a design has its own photos. People are not here: they stay drawn (`pictures()` in `src/samples.js`), because a stock licence clears no one's face.

| File | Source |
| --- | --- |
| `hero.webp` | <https://images.unsplash.com/photo-1506744038136-46273834b3fb> |
| `panorama.webp` | <https://images.unsplash.com/photo-1501854140801-50d01698950b> |
| `landscape-1.webp` | <https://images.unsplash.com/photo-1497366811353-6870744d04b2> |
| `landscape-2.webp` | <https://images.unsplash.com/photo-1454165804606-c3d57bc86b40> |
| `landscape-3.webp` | <https://images.unsplash.com/photo-1524758631624-e2822e304c36> |
| `landscape-4.webp` | <https://images.unsplash.com/photo-1441974231531-c6227db76b6e> |

Fetched on 2026-11-04 from Unsplash's image server, where the free photos are; its paid Unsplash+ photos are on `plus.unsplash.com`. The [Unsplash License](https://unsplash.com/license) allows commercial use without attribution, and forbids selling a photo without significant modification and compiling photos into a similar or competing service. It says nothing about people or trademarks, so a photo here has no recognisable face or legible brand. Unsplash's site refuses automated browsers, so the photo pages and photographers' names were not read and are not recorded.

A replacement keeps its file name: `cwebp -q 72 -m 6 -metadata none`, 1600 px wide for the panorama and 1200 for the others. The hero shows large and clear above text at the bottom, so it has `-q 82 -sharp_yuv -af` at 1920 px.
