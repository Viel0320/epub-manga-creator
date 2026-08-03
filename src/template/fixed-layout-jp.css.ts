const getText = (): string => `@charset "UTF-8";

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
    position:  absolute;
    display:   flex;
}
svg {
    margin:    auto;
    padding:   0;
    width:     100%;
    height:    100%;
}
img {
    margin:    auto;
    padding:   0;
    width:     100% !important;
    height:    100% !important;
    display:   block;
}
`

export default getText
