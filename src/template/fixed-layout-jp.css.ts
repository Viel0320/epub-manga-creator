const getText = (): string => `@charset "UTF-8";

@page {
    margin: 0 !important;
    padding: 0 !important;
}
html,
body {
    margin:    0;
    padding:   0;
    font-size: 0;
    width:     100%;
    height:    100%;
}
div.main {
    margin:    0;
    padding:   0;
    width:     100%;
    height:    100%;
}
svg, img {
    margin:    0;
    padding:   0;
}
img.comic-page {
    margin:          0 !important;
    padding:         0 !important;
    max-width:       100% !important;
    max-height:      100% !important;
    width:           auto !important;
    height:          auto !important;
    display:         inline-block !important;
    vertical-align:  top !important;
    border:          0 !important;
}
`

export default getText
