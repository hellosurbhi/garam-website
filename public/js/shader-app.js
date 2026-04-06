// ============================================
// HARDCODED CONFIG — edit these values
// ============================================
const CONFIG = {
    size: 1200,
    intensity: 1.45,
    speed: 1.23,
    complexity: 5,
    flowStrength: 0.2,
    pushDistance: 0.0045,
    edgeGlow: 1.0,
    zoom: 1.0,

    colorA: [0xE9 / 255, 0x1E / 255, 0x76 / 255],  // #E91E76 hot pink
    colorB: [0xAD / 255, 0x14 / 255, 0x57 / 255],  // #AD1457 deep magenta
    colorC: [0xFF / 255, 0xD6 / 255, 0x00 / 255],  // #FFD600 electric yellow
};

// ============================================
// SVG embedded as data URI
// ============================================
const SVG_DATA_URI = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMiIgZGF0YS1uYW1lPSJMYXllciAyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2ODkuMTEgMzYzLjkzIj4KICA8ZGVmcz4KICAgIDxzdHlsZT4KICAgICAgLmNscy0xIHsKICAgICAgICBmaWxsOiAjZmZmOwogICAgICB9CiAgICA8L3N0eWxlPgogIDwvZGVmcz4KICA8ZyBpZD0iTGF5ZXJfMS0yIiBkYXRhLW5hbWU9IkxheWVyIDEiPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNjg5LjExLDI2MC43OGwtOC40Ni04MC45Mkw2ODMuMDUuMDlsLTI5OC40MS42LjU3LDEyLjUxYy4yOCw2LjEuMjgsMTIuMjIuMjgsMjAuNjl2NS41MWMwLDEuOTQtMi44MSwyLjItMy4xOC4zLTIuMjgtMTEuNzMtNC4yMy0yMS45OC01LjU1LTI5LjE1bC0xLjgyLTkuODUtMTEwLjU1LjIyLTEuNzQsOS45MWMtLjI4LDEuNTctLjU4LDMuMjgtLjkxLDUuMTItLjU4LDMuMjctNC43LDQuMjgtNi44LDEuNzJzLTQuNi00Ljg0LTcuNDctNi44MmMtOS44MS02Ljc4LTIzLjQxLTkuOC00NC4wOS05LjhsLTU0LjA0LjEtNzUuMjQuMTUtLjM0LDIuNDZjLS4zLDIuMi0yLjc3LDMuMzItNC42NSwyLjE1QzYxLjM1LDEuMDcsNTEuNCwwLDQxLjU1LDBoLS41NUMxMi4yOS4xMi41NywxMS4xMS41NywzNy45MnYyOC4zMWMwLDQuNy4yOSwxMC4wNCwxLjY1LDE1LjI4LjE3LjY0LS4zNiwxLjI1LTEuMDEsMS4xNmgwYy0uNjYtLjA5LTEuMjQuNDUtMS4yLDEuMTJsLjc2LDEzLjI1Yy40Myw3LjcxLjQzLDE1LjM5LjQzLDI2LjAxdjEwMi43NmMwLDExLjI4LDAsMTkuNDMtLjQ0LDI3LjU0bC0uMDYsMS4xaC0uMTlsLjA3LDIuMzQtLjUsOS4xOGguNzdzLjAyLjgzLjAyLjgzYy4xMiwzLjg1LjEyLDguMTYuMTIsMTMuNjJ2NDguNzhjMCw5LjI2LDAsMTUuMzgtLjEyLDIxLjA2bC0uMjUsMTIuMjVoNDEuNzNjNS4zNCwwLDExLjAxLS4yNiwxNi40Mi0xLjQzbC0uMjEsMS40M3MyNDkuMzEsMS40MiwyNTguNDcsMS40MmMxLjc1LDAsMy40NC0uMDQsNS4wNy0uMTN2LjEzaDkwLjU0di0uMjdjNi41Ny0uMTQsMTIuODktLjg0LDE4LjQ1LTIuOGwtLjA1LDEuNjVoODMuNmwtLjAyLS43MWMtLjAyLS42Ni42My0xLjExLDEuMjUtLjg4LDYuOTMsMi41NCwxNC42OSwzLjAxLDIxLjg1LDMuMDEsOC41MywwLDE3LjktLjY2LDI1LjcxLTQuNzEsMS44NS0uOTYsNC4wOS4yMyw0LjMyLDIuM2wuMTEuOThoMTA3Ljk5bDEzLjI3LTEwMS43M1pNNTA0LjQ1LDE2My43MWMtLjAzLS4wNi0uMDctLjExLS4xMS0uMTdsLjE0LjAycy0uMDIuMS0uMDMuMTVaIi8+CiAgICA8Zz4KICAgICAgPGc+CiAgICAgICAgPHBhdGggZD0iTTEyLjU3LDY2LjIzdi0yOC4zMWMwLTIwLjI1LDYuNzEtMjUuODMsMjguNDgtMjUuOTIsMjIuNDQtLjA5LDMwLjcxLDUuOTYsMzAuNzEsMjguMTZ2Mi42M2wtMjYuNTItLjY1di00LjEzYzAtMy41NS0uNzItNC45NS0zLjYtNS4wM3MtNC4yNywxLjI0LTQuMjcsNS4wOXYzMi4wNWMwLDMuODUsMS40Miw1LjM0LDQuMjcsNS42MSwzLjYuMzQsNC45My0uOTEsNC45My00Ljgydi0yLjNsLTQuOTMtLjQxdi0xNy45bDMwLjY0LDEuNjljLS4xMyw1Ljg0LS4xMyw5LjQzLS4xMywxOS4yMiwwLDIyLjIxLTcuODksMjcuMzEtMzEuMTEsMjQuMzktMjEuNzYtMi43My0yOC40OC05LjEzLTI4LjQ4LTI5LjM4WiIvPgogICAgICAgIDxwYXRoIGQ9Ik0xMzguOTIsMTMuMTdjMy4wMiwyMS4zNCwxMC43NSw3Mi4zOSwxNC41MSw5NC45NWwtMzcuMDUtNC41Ny0uODktMTEuOTMtMTEuMS0xLjE5LS44NiwxMS41My0zMS4zOC0zLjg3YzMuMTYtMTkuNTIsOS43LTY1LjE4LDEyLjQtODQuOGw1NC4zNi0uMTFaTTEwNS44NCw2OC41Mmw3Ljg4LjYtLjQ0LTUuODZjLS41OS04LjY1LTEuNDctMTcuOTItMi4yLTI2LjU0bC0yLjc3LS4wOWMtLjczLDguNjUtMS40NSwxNy45MS0yLjAzLDI2LjUzbC0uNDMsNS4zNloiLz4KICAgICAgICA8cGF0aCBkPSJNMTU3Ljg5LDI5LjU1YzAtNi41OSwwLTExLjcxLS4xNy0xNi40Mmw0NS4yNi0uMDljMzUuMDQtLjA3LDQ4Ljg4LDkuMTIsNDguODgsMzMuNzZ2OC4wMWMwLDE0LjUxLTQuNTksMjMuMDktMTcuMDcsMjYuNjEsMi40MywzLjkxLDQuNDYsOC4yNSw2LjcxLDEyLjkzLDQuMzIsOS4yNiw5LjExLDE4Ljk3LDEyLjY4LDI2LjIxbC00NS4xOC01LjU4Yy0xLjctNC4wOC0zLjk2LTEwLjItNi4zOS0xNi4zMmwtNC4yNi0xMS4wNy0zLjEyLS4yOHY3LjYyYzAsNy40OCwwLDEyLjk5LjE4LDE4LjM3bC0zNy42OC00LjY1Yy4xNy00Ljk2LjE3LTEwLjQ3LjE3LTE3LjQ3VjI5LjU1Wk0xOTUuMjIsMzcuOXYyNC44NHM2LjQ2LjM5LDYuNDYuMzljNC40OS4yNyw2Ljc1LTEuMzIsNi43NS02LjE5di0xMi4wNWMwLTQuODgtMi4yNi02LjY3LTYuNzUtNi44bC02LjQ2LS4xOVoiLz4KICAgICAgICA8cGF0aCBkPSJNMzY0Ljk2LDEyLjcyYzUuMTQsMjcuODYsMTguMzcsOTQuODMsMjQuODMsMTI0LjU4bC02Mi44My03Ljc2LTEuNDktMTUuNDUtMTguNDQtMS45Ny0xLjQyLDE0Ljc5LTUxLjIzLTYuMzNjNS4xLTI0LjY5LDE1LjY5LTgyLjY2LDIwLjA5LTEwNy42OGw5MC40OS0uMThaTTMwOS40Miw4My45OGwxMy4wOS45OS0uNzQtNy41OGMtLjk4LTExLjE3LTIuNDUtMjMuMTYtMy42Ny0zNC4yOWwtNC42MS0uMTRjLTEuMiwxMS4xMy0yLjQxLDIzLjA0LTMuMzYsMzQuMTNsLS43Miw2Ljg5WiIvPgogICAgICAgIDxwYXRoIGQ9Ik0zOTcuNDksMTE1Ljc5VjMzLjg5YzAtOC40OSwwLTE0Ljg2LS4yOS0yMS4yM2wxMTIuNDgtLjIyLDYuMDgsMzcuMTdjMi41MiwxNi4zMyw0LjMzLDM0Ljg4LDUuNDEsNTEuODQsMS4wOS0xNy4wMywyLjU1LTM1LjQ2LDUuMS01MS45Mmw1Ljg5LTM3LjE1LDEzOC4xOC0uMjdjLS40Nyw4LjEtLjQ3LDE2LjQzLS40NywyNy40NXYxMDMuMjljMCwxMS43LDAsMjAuNDguNDcsMjkuMDlsLTkwLjM4LTExLjE2di0yMS45NmMwLTE0LjIyLDIuMDEtNTIuMzcsMy4yMi04My43NmwtNC4wMy0uMTRjLTQuNCwyMC4yNi05LjU1LDQzLjQyLTE0LjY2LDYyLjg3bC0xMC4wOSwzOS44My03NC40OS05LjItOC4zNS0zOS4yMmMtMy45Ni0xOC4zMy04LjIyLTM5Ljc1LTEyLjEzLTU4LjM2bC00LjItLjE0YzEuMjksMjYuNjUsMi41OCw1OS43MywyLjU4LDc1LjN2MTkuNjlsLTYwLjYzLTcuNDljLjI5LTYuNjkuMjktMTMuNDEuMjktMjIuNDNaIi8+CiAgICAgIDwvZz4KICAgICAgPGc+CiAgICAgICAgPHBhdGggZD0iTTEzLjE5LDIyNS44MXYtMTAyLjc2YzAtMTAuNjUsMC0xOC42NC0uNDYtMjYuN2wxNDEuNDIsMTkuMzEsNS45NywzNy4zYzIuNDQsMTYuMTIsNC4xNywzNC4yNSw1LjIxLDUwLjczLDEuMDMtMTYuNTQsMi40MS0zNC4zNiw0LjgyLTUwLjFsNS40NS0zNSwxMDEuNDMsMTMuODVjLS4yNyw2LjE1LS4yNywxMi41Mi0uMjcsMjAuOTR2NzguOTNjMCw4Ljk0LDAsMTUuNjUuMjcsMjIuMThsLTYxLjEyLS4xMnYtMTkuMjdjMC0xMi40OCwxLjU2LTQ1Ljk1LDIuNDktNzMuMzRsLTMuMTItLjNjLTMuNDUsMTcuNzItNy41NiwzOC4zMS0xMS43LDU1LjkxbC04LjM5LDM2Ljk3LTcyLjM0LS4xNC05LjQ2LTQwLjgxYy00LjYtMTkuNTUtOS42My00Mi43Ny0xNC4zMS02My4zbC01LjEyLS41YzEuNTgsMjkuNDUsMy4xNiw2NS44MywzLjE2LDgyLjkzdjIxLjYzbC04NC4zOC0uMTZjLjQ2LTguNDMuNDYtMTYuODcuNDYtMjguMTlaIi8+CiAgICAgICAgPHBhdGggZD0iTTM5My45NiwxNDguNGMzLjkzLDI0LjY4LDEzLjY5LDgxLjkyLDE4LjI4LDEwNi4zNmwtNTAuMDYtLjA5LTEuMzUtMTQuNTEtMTcuNTItLjM0LTEuNDEsMTQuODItNTcuOC0uMTFjNi40My0yOC4xLDE5LjI3LTkxLjQ0LDI0LjQtMTE3Ljc4bDg1LjQ2LDExLjY3Wk0zNDUuNjUsMjExLjg4bDEyLjQ1LjY2LS42OC03LjI0Yy0uOTEtMTAuNzItMi4yOC0yMi4yOS0zLjQzLTMzLjA5bC00LjM4LS40NGMtMS4xNiwxMC44MS0yLjMyLDIyLjQ0LTMuMjYsMzMuMzNsLS43LDYuNzlaIi8+CiAgICAgICAgPHBhdGggZD0iTTQxMi42MywyMjQuNjR2LTIuNzhsNDAuOTEsMS4yN3Y0LjE1YzAsMy43NCwxLjc3LDUuMzIsNi41Miw1LjQ3czYuMjMtMS4yOSw2LjIzLTQuODMtMi4wNi01LjU0LTIxLjM3LTEzLjAzYy0yNS40LTkuODMtMzEuNDgtMTYuMDctMzEuNDgtMzQuNjIsMC0yMi42NCwxMi44My0yOC45LDQ0LjE4LTI0LjU2LDM0LjgsNC44Miw0MC42NCwxMi4zOCw0MC42NCwzMi45MnYyLjIxbC0zNS45My0yLjg4di00LjUxYzAtMy4wMS0xLjM5LTQuMjUtNC4xOS00LjU1cy00LjA2LjY3LTQuMDYsMy43MnYuMTRjMCw0LjQzLDIuMTIsNS44NywxOS42OCwxMy4yOSwyMi4yOSw5LjMyLDI3Ljc2LDE1LjAzLDI3Ljc2LDMyLjIzLDAsMjEuOTktOC45NiwyNy45NC0zOS44OSwyNy45NC0zOS41OSwwLTQ4Ljk5LTYuNzMtNDguOTktMzEuNThaIi8+CiAgICAgICAgPHBhdGggZD0iTTU2Ny4yNCwxNzIuMDVjMi40LDE5LjE5LDguMzcsNjMuODcsMTEuMTksODMuMDJsLTMwLjM5LS4wNi0uODEtMTEuMjMtMTAuNDMtLjItLjg0LDExLjQxLTMzLjY5LS4wNmMzLjY5LTIxLjMzLDExLjExLTY5LjYzLDE0LjA5LTg5LjgybDUwLjg3LDYuOTRaTTUzOC4yLDIyMi4wN2w3LjQxLjM5LS40MS01LjU5Yy0uNTQtOC4yNy0xLjM2LTE3LjE5LTIuMDQtMjUuNTFsLTIuNjEtLjI2Yy0uNjksOC4zNS0xLjM4LDE3LjM0LTEuOTQsMjUuNzRsLS40Miw1LjI0WiIvPgogICAgICAgIDxwYXRoIGQ9Ik01ODEuNTksMjU1LjA4Yy4xMi01LjcxLjEyLTExLjc2LjEyLTIwLjg5di00Ni42OWMwLTUuMzYsMC05LjQ3LS4xMi0xMy40OWwyNS4wMiwzLjQxYy0uMTEsNC4wMy0uMTEsOC4wOC0uMTEsMTMuNTZ2NDMuMjNsNi4wNC4yM2MzLjI0LjEyLDUuNDkuMjEsMTAuNTcuM3YyMC40MWwtNDEuNTEtLjA4WiIvPgogICAgICAgIDxwYXRoIGQ9Ik02NjguMzYsMTg1Ljg2YzEuNjgsMTYuMDEsNS44Niw1My4zNiw3Ljg1LDY5LjRsLTIxLjE5LS4wNC0uNTYtOS4zMy03LjE5LS4xNC0uNTgsOS40Ni0yMi45NS0uMDRjMi41LTE3LjU0LDcuNTMtNTcuMzksOS41NS03NC4wOWwzNS4wNyw0Ljc5Wk02NDguMjEsMjI3Ljg5bDUuMTEuMjctLjI4LTQuNjRjLS4zOC02Ljg3LS45NC0xNC4yNy0xLjQxLTIxLjE3bC0xLjgtLjE4Yy0uNDgsNi45NC0uOTUsMTQuNDEtMS4zMywyMS4zOGwtLjI5LDQuMzVaIi8+CiAgICAgIDwvZz4KICAgICAgPHBhdGggZD0iTTEyLjk3LDI4MC40MmMwLTUuNTYsMC05Ljk1LS4xMi0xMy45N2gyOS40OGMyMi45NywwLDMwLjE5LDUuOTIsMzAuMTksMjcuOTR2MjguMThjMCwyMi4wMi03LjIyLDI3Ljk0LTMwLjE5LDI3Ljk0SDEyLjg2Yy4xMi01LjguMTItMTEuOTYuMTItMjEuMzF2LTQ4Ljc4Wk0zOC4zMSwyODguMjN2NDAuNDloNC4wM2MyLjg0LDAsNC4yNi0xLjQyLDQuMjYtNS40NXYtMjkuNmMwLTQuMDMtMS40Mi01LjQ1LTQuMjYtNS40NWgtNC4wM1oiLz4KICAgICAgPHBhdGggZD0iTTEyNy4zNSwyNjYuNDVjMi4yNSwxOS4xOCw3LjkzLDY0LjQxLDEwLjY2LDg0LjA2aC0yOC4wNmwtLjcxLTExLjAxaC05bC0uNzEsMTEuMDFoLTI3LjExYzIuODQtMTkuNjUsOC42NC02NC44OCwxMS4wMS04NC4wNmg0My45M1pNMTAxLjQyLDMxOC42Nmg2LjM5bC0uMzYtNS40NWMtLjQ3LTguMDUtMS4xOC0xNi42OS0xLjc4LTI0Ljc0aC0yLjI1Yy0uNTksOC4xNy0xLjE4LDE2LjkzLTEuNjYsMjUuMWwtLjM2LDUuMDlaIi8+CiAgICAgIDxwYXRoIGQ9Ik0xNDUuOTQsMjg5LjA2aC0xNC4zM3YtMjIuNjFoNTMuNzV2MjIuNjFoLTE0LjA5djQ2LjA2YzAsNi4yNywwLDEwLjc3LjEyLDE1LjM5aC0yNS41N2MuMTItNC41LjEyLTkuMjQuMTItMTUuMzl2LTQ2LjA2WiIvPgogICAgICA8cGF0aCBkPSJNMTg5Ljc0LDI4MC44OWMwLTUuOCwwLTEwLjE4LS4xMi0xNC40NGgyNS41N2MtLjEyLDQuMjYtLjEyLDguNjQtLjEyLDE0LjQ0djU0LjIzYzAsNi4yNywwLDEwLjc3LjEyLDE1LjM5aC0yNS41N2MuMTItNC41LjEyLTkuMjQuMTItMTUuMzl2LTU0LjIzWiIvPgogICAgICA8cGF0aCBkPSJNMjIxLjk0LDMzNS4xMnYtNTQuNDZjMC01LjY4LDAtOS43MS0uMTItMTQuMjFoMzEuNjFsMy40MywyMC40OGMxLjc4LDEwLjg5LDMuNjcsMjIuODUsNC45NywzMi4yLS4xMi0xMC44OS0uMzYtMjUuOTMtLjM2LTMzLjE1di0xOS41NGgyMC43MmMtLjEyLDQuNS0uMTIsOC4yOS0uMTIsMTQuMjF2NTQuNDZjMCw0Ljc0LDAsOS41OS4xMiwxNS4zOWgtMzIuMzJsLTIuOTYtMTguMzVjLTEuNTQtOS4xMi0zLjItMTkuMTgtNC42Mi0yOC4zLjEyLDExLjAxLjI0LDIyLjAyLjI0LDI3LjExdjE5LjU0aC0yMC43MmMuMTItNC43NC4xMi05LC4xMi0xNS4zOVoiLz4KICAgICAgPHBhdGggZD0iTTI4Ny40MiwzMjMuODd2LTMwLjc4YzAtMjIuMDIsNy4yMi0yOC4wNiwyOS42LTI4LjA2czI5LjEzLDYuMDQsMjkuMTMsMjguMDZ2Mi42bC0yNC45OC40N3YtNC4yNmMwLTMuNjctLjcxLTUuMDktMy41NS01LjA5cy00LjI2LDEuNDItNC4yNiw1LjQ1djMzLjUxYzAsNC4wMywxLjQyLDUuNDUsNC4yNiw1LjQ1LDMuNTUsMCw0Ljg1LTEuNDIsNC44NS01LjQ1di0yLjM3aC00Ljg1di0xOC41OWgyOS4wMWMtLjEyLDUuOC0uMTIsOS4zNS0uMTIsMTkuMDYsMCwyMi4wMi03LjIyLDI4LjA2LTI5LjQ4LDI4LjA2cy0yOS42LTYuMDQtMjkuNi0yOC4wNloiLz4KICAgICAgPHBhdGggZD0iTTM3OC41OSwzMjYuMTJ2LTIuMjVsMjUuODEtLjQ3djMuNTVjMCwzLjIsMS4xOCw0LjUsNC4zOCw0LjVzNC4yNi0xLjMsNC4yNi00LjM4LTEuNDItNC43NC0xNC4zMy0xMC4zYy0xNS45OC02Ljg3LTE5LjY1LTExLjYtMTkuNjUtMjYuNjQsMC0xOC4zNSw3LjgxLTI0Ljg2LDI4LjA2LTI0Ljg2LDI0LjYzLDAsMjkuMDEsNi4xNiwyOS4wMSwyNC44NnYyLjAxbC0yNS44MS40N3YtMy45MWMwLTIuNi0uOTUtMy41NS0yLjg0LTMuNTVzLTIuNzIuOTUtMi43MiwzLjU1di4xMmMwLDMuNzksMS40Miw0Ljg1LDEzLjUsOS45NSwxNi4yMiw2Ljc1LDIwLjM2LDExLjYsMjAuMzYsMjcuMzUsMCwyMC4xMy02Ljc1LDI1LjU3LTI4Ljc3LDI1LjU3LTI1LjU3LDAtMzEuMjYtNS40NS0zMS4yNi0yNS41N1oiLz4KICAgICAgPHBhdGggZD0iTTQ0My40NywzMzUuMTJ2LTU0LjIzYzAtNS44LDAtMTAuMTgtLjEyLTE0LjQ0aDI1LjU3Yy0uMTIsNC4yNi0uMTIsOC42NC0uMTIsMTQuNDR2MTUuNTFoOC4wNXYtMTUuNTFjMC01LjgsMC0xMC4xOC0uMTItMTQuNDRoMjUuNTdjLS4xMiw0LjI2LS4xMiw4LjY0LS4xMiwxNC40NHY1NC4yM2MwLDYuMjcsMCwxMC43Ny4xMiwxNS4zOWgtMjUuNTdjLjEyLTQuNS4xMi05LjI0LjEyLTE1LjM5di0xNi45M2gtOC4wNXYxNi45M2MwLDYuMjcsMCwxMC43Ny4xMiwxNS4zOWgtMjUuNTdjLjEyLTQuNS4xMi05LjI0LjEyLTE1LjM5WiIvPgogICAgICA8cGF0aCBkPSJNNTA3LjUyLDMyMy44N3YtMzAuNzhjMC0yMi4wMiw3LjIyLTI4LjA2LDMwLjE5LTI4LjA2czMwLjE5LDYuMDQsMzAuMTksMjguMDZ2MzAuNzhjMCwyMi4wMi03LjIyLDI4LjA2LTMwLjE5LDI4LjA2cy0zMC4xOS02LjA0LTMwLjE5LTI4LjA2Wk01NDEuOTcsMzI0LjM0di0zMS42MWMwLTQuMDMtMS40Mi01LjQ1LTQuMjYtNS40NXMtNC4yNiwxLjQyLTQuMjYsNS40NXYzMS42MWMwLDQuMDMsMS40Miw1LjQ1LDQuMjYsNS40NXM0LjI2LTEuNDIsNC4yNi01LjQ1WiIvPgogICAgICA8cGF0aCBkPSJNNjE3Ljg3LDM1MC41MWgtMzkuMzFjLTIuNDktMjEuOS03LjQ2LTYyLjA0LTEwLjE4LTg0LjA2aDI4LjE4bC45NSwyOS44NGMuMzYsMTAuNDIuNTksMjEuMzEsMS4xOCwzMi4yaDEuODljLjk1LTEwLjc3LDEuODktMjEuNTUsMi43Mi0zMS44NWwyLjYxLTMwLjE5aDMzLjYybDIuODQsMjkuNDhjLjk1LDEwLjQyLDIuMDEsMjEuNDMsMy4wOCwzMi41NmgxLjU0Yy40Ny0xMS4xMy43MS0yMi4yNiwxLjA3LTMyLjhsLjgzLTI5LjI0aDI3LjIzYy0yLjg0LDIyLjAyLTguMTcsNjIuMDQtMTAuODksODQuMDZoLTM4Ljk1bC0xLjU0LTIyLjYxYy0uNTktOS44My0xLjMtMjIuMjYtMi4yNS0zNS4yOC0uOTUsMTMuMDItMS44OSwyNS40Ni0yLjcyLDM1LjRsLTEuODksMjIuNVoiLz4KICAgIDwvZz4KICA8L2c+Cjwvc3ZnPg==";

// ============================================
// WebGL Setup
// ============================================
const canvas = document.getElementById('glCanvas');
if (!canvas) throw new Error('No canvas#glCanvas found');
const gl = canvas.getContext('webgl');

if (!gl) {
    // Graceful fallback — hide canvas, hero shows dark gradient background
    canvas.style.display = 'none';
    throw new Error('WebGL not supported');
}

gl.getExtension('OES_standard_derivatives');

// ============================================
// Offscreen Canvas for SVG texture
// ============================================
const textCanvas = document.createElement('canvas');
const tctx = textCanvas.getContext('2d');
textCanvas.width = 2048;
textCanvas.height = 2048;

// Load SVG (embedded as data URI so it works from file:// too)
let svgImage = null;
const img = new Image();
img.onload = () => { svgImage = img; };
img.src = SVG_DATA_URI;

function updateTextCanvas() {
    const size = CONFIG.size;
    const cx = textCanvas.width / 2;
    const cy = textCanvas.height / 2;

    tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    tctx.fillStyle = 'black';
    tctx.fillRect(0, 0, textCanvas.width, textCanvas.height);

    if (!svgImage) return;

    const drawSvg = (color, shadowBlur) => {
        tctx.shadowBlur = shadowBlur;
        tctx.shadowColor = color;
        const s = size / 200;
        tctx.drawImage(
            svgImage,
            cx - (svgImage.width * s) / 2,
            cy - (svgImage.height * s) / 2,
            svgImage.width * s,
            svgImage.height * s
        );
    };

    // Red channel: blurred physics map
    drawSvg('red', 60);
    // Green channel: crisp visual mask
    drawSvg('lime', 0);
}

// ============================================
// Shaders — UNTOUCHED
// ============================================
const vsSource = `
    attribute vec4 aVertexPosition;
    void main() { gl_Position = aVertexPosition; }
`;

const fsSource = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform float uTime, uSpeed, uIntensity, uComplexity, uFlowStrength, uPushDistance, uEdgeGlow, uZoom;
    uniform vec2 uResolution;
    uniform vec3 uColorA, uColorB, uColorC, uTextColor;
    uniform sampler2D uTextTexture;

    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

    void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;

        // Correct textUv for aspect ratio to prevent stretching
        vec2 textUv = uv;
        float aspect = uResolution.x / uResolution.y;
        if (aspect > 1.0) {
            textUv.x = (textUv.x - 0.5) * aspect + 0.5;
        } else {
            textUv.y = (textUv.y - 0.5) / aspect + 0.5;
        }

        // Apply Zoom to the text texture coordinates
        textUv = (textUv - 0.5) / uZoom + 0.5;
        textUv.y = 1.0 - textUv.y; // Flip for texture

        vec2 centeredUv = (uv * 2.0 - 1.0);
        centeredUv.x *= aspect;
        centeredUv /= uZoom;

        float t = uTime * uSpeed;

        // 1. Better Gradient Sampling for Flow
        float d = max(uPushDistance, 0.001);
        float mR = texture2D(uTextTexture, textUv + vec2(d, 0.0)).r;
        float mL = texture2D(uTextTexture, textUv - vec2(d, 0.0)).r;
        float mU = texture2D(uTextTexture, textUv + vec2(0.0, d)).r;
        float mD = texture2D(uTextTexture, textUv - vec2(0.0, d)).r;
        vec2 flowGrad = vec2(mR - mL, mU - mD);
        float flowGradLen = length(flowGrad);
        if(flowGradLen > 0.001) flowGrad /= flowGradLen;

        // 2. Warped Domain
        vec2 p = centeredUv + (rand(uv + t) - 0.5) * 0.001;
        for(float i = 1.0; i < 8.0; i++) {
            p.x += 0.3/i * sin(i*3.0*p.y + t) + flowGrad.x * flowGradLen * uFlowStrength;
            p.y += 0.3/i * cos(i*3.0*p.x + t) - flowGrad.y * flowGradLen * uFlowStrength;
        }

        // 3. Fluid Color
        float w1 = sin(p.x * uComplexity + t) * 0.5 + 0.5;
        float w2 = sin(p.y * uComplexity + t * 0.8) * 0.5 + 0.5;
        float w3 = sin((p.x + p.y) * uComplexity + t * 1.2) * 0.5 + 0.5;
        vec3 fluid = (uColorA*w1 + uColorB*w2 + uColorC*w3) / (w1+w2+w3+0.1) * max(uIntensity, 0.01);

        // 4. ANALYTICAL ANTI-ALIASING (The Elegant Solution)
        vec4 texData = texture2D(uTextTexture, textUv);
        float blurredMask = texData.r;
        float crispMask = texData.g;

        // Calculate screen-space gradient of the mask to find the 'pixel-width' of the edge
        // This makes the edge perfectly smooth regardless of how much the domain is warped
        vec2 vGrad = vec2(dFdx(crispMask), dFdy(crispMask));
        float vGradLen = max(length(vGrad), 0.0001);

        // Analytical AA formula: distance / gradient_length
        // We center the edge at 0.5 (since lime green is 1.0 and background is 0.0)
        float dist = crispMask - 0.5;
        float aa_mask = clamp(0.5 + dist / vGradLen, 0.0, 1.0);

        vec3 finalColor = mix(fluid, uTextColor, aa_mask);

        // 5. Smooth Rim
        float rim = smoothstep(0.2, 0.5, blurredMask) * (1.0 - aa_mask);
        finalColor += rim * uColorB * uEdgeGlow;

        // Global Dither
        finalColor += (rand(uv) - 0.5) * 0.01;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// ============================================
// WebGL Program & Buffers
// ============================================
function createShader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
    }
    return s;
}

const program = gl.createProgram();
gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);

const posAttrib = gl.getAttribLocation(program, 'aVertexPosition');
const uniforms = {
    uTime: gl.getUniformLocation(program, 'uTime'),
    uRes: gl.getUniformLocation(program, 'uResolution'),
    uSpeed: gl.getUniformLocation(program, 'uSpeed'),
    uInt: gl.getUniformLocation(program, 'uIntensity'),
    uComp: gl.getUniformLocation(program, 'uComplexity'),
    uFlow: gl.getUniformLocation(program, 'uFlowStrength'),
    uPush: gl.getUniformLocation(program, 'uPushDistance'),
    uEdge: gl.getUniformLocation(program, 'uEdgeGlow'),
    uZoom: gl.getUniformLocation(program, 'uZoom'),
    uColA: gl.getUniformLocation(program, 'uColorA'),
    uColB: gl.getUniformLocation(program, 'uColorB'),
    uColC: gl.getUniformLocation(program, 'uColorC'),
    uTextCol: gl.getUniformLocation(program, 'uTextColor'),
    uTextTex: gl.getUniformLocation(program, 'uTextTexture'),
};

const textTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// ============================================
// Responsive Resize
// ============================================
function resize() {
    const dpr = window.innerWidth < 768
      ? Math.min(window.devicePixelRatio, 1.5)
      : window.devicePixelRatio;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ============================================
// Render Loop
// ============================================
function drawFrame(time) {
    updateTextCanvas();

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.uniform1i(uniforms.uTextTex, 0);

    gl.enableVertexAttribArray(posAttrib);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(uniforms.uTime, time);
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uSpeed, CONFIG.speed);
    gl.uniform1f(uniforms.uInt, CONFIG.intensity);
    gl.uniform1f(uniforms.uComp, CONFIG.complexity);
    gl.uniform1f(uniforms.uFlow, CONFIG.flowStrength);
    gl.uniform1f(uniforms.uPush, CONFIG.pushDistance);
    gl.uniform1f(uniforms.uEdge, CONFIG.edgeGlow);
    gl.uniform1f(uniforms.uZoom, CONFIG.zoom);

    gl.uniform3f(uniforms.uColA, CONFIG.colorA[0], CONFIG.colorA[1], CONFIG.colorA[2]);
    gl.uniform3f(uniforms.uColB, CONFIG.colorB[0], CONFIG.colorB[1], CONFIG.colorB[2]);
    gl.uniform3f(uniforms.uColC, CONFIG.colorC[0], CONFIG.colorC[1], CONFIG.colorC[2]);
    gl.uniform3f(uniforms.uTextCol, 0, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function render(time) {
    time *= 0.001;
    drawFrame(time);
    if (!prefersReducedMotion) {
        requestAnimationFrame(render);
    }
}

requestAnimationFrame(render);
