/**
 * The displacement map behind the glass.
 *
 * `feTurbulence` makes fractal noise, `feGaussianBlur` softens it into slow
 * swells rather than static, and `feDisplacementMap` pushes the backdrop's
 * pixels around by those swells — which is the refraction. Blur alone is
 * frosted glass; this is glass with a surface.
 *
 * Rendered once, hidden, at the root. An SVG filter has to exist in the
 * document for `url(#…)` to resolve, and one instance serves every element
 * that references it.
 *
 * Chromium only — Safari and Firefox do not accept `url()` inside
 * `backdrop-filter`. They get the plain blur declared before the @supports
 * block in theme.css, which is a perfectly good frosted panel.
 */
export function GlassFilter() {
  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute size-0">
      <filter
        id="liquid-glass"
        // Tight. A generous filter region let the displacement smear the
        // backdrop well past the panel's own edges, so the photograph
        // looked damaged next to the menu rather than seen through it.
        x="-4%"
        y="-4%"
        width="108%"
        height="108%"
        // sRGB, not the linearRGB default: on a near-black page linear
        // space crushes the displacement into invisibility.
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.009 0.013"
          numOctaves="2"
          seed="11"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="6" result="swell" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="swell"
          // Enough to bend an edge, not enough to melt a face. At 22 the
          // refraction read as damage.
          scale="9"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  )
}
